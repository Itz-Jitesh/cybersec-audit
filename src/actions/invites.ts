"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { writeAudit } from "@/actions/audit";
import {
  type ActionResult,
  denied,
  fail,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import { db } from "@/db";
import {
  auditLog,
  invites,
  profiles,
  teams,
  workspaceMembers,
} from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { WORKSPACE_NAME } from "@/lib/constants/defaults";
import { sendInviteEmail } from "@/lib/email/send-invite";
import { bulkInviteSchema, inviteIdSchema } from "@/lib/validators/admin";

/**
 * Invites.
 *
 * The invite row is the gate: handle_new_user refuses to provision a profile
 * for an auth.users insert with no matching open invite, so creating the row is
 * the act that grants access and the email is only a convenience. That ordering
 * is why a mail failure never rolls the invite back — it is reported instead,
 * and the panel shows the link so an admin can pass it on by hand.
 */

/**
 * Rate limits, per admin, per hour.
 *
 * An invite endpoint is an outbound-mail endpoint: whoever can call it can
 * make the club's mailbox send to arbitrary addresses, and a compromised or
 * careless admin account is enough to get that mailbox flagged as a spam
 * source. The club has about thirty members, so these ceilings are far above
 * any legitimate use and still low enough to matter.
 *
 * Counted in Postgres rather than in memory on purpose: an in-process counter
 * resets on every deploy and is per-instance, so on serverless it limits
 * almost nothing. invites.created_at and the audit log are already written for
 * other reasons, which makes them free to count.
 */
const INVITES_PER_HOUR = 60;
const RESENDS_PER_HOUR = 30;

async function countRecent(
  actorId: string,
  what: "created" | "resent",
): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);

  if (what === "created") {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(invites)
      .where(and(eq(invites.invitedBy, actorId), gt(invites.createdAt, since)));
    return Number(row?.value ?? 0);
  }

  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.actorId, actorId),
        eq(auditLog.action, "invite.resent"),
        gt(auditLog.createdAt, since),
      ),
    );
  return Number(row?.value ?? 0);
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  president: "President",
  co_president: "Co-president",
  mentor: "Mentor",
  member: "Member",
};

export interface InviteOutcome {
  email: string;
  status: "invited" | "emailed" | "already-member" | "already-invited" | "error";
  detail?: string;
}

export async function sendInvites(
  input: unknown,
): Promise<ActionResult<{ results: InviteOutcome[]; mailerConfigured: boolean }>> {
  return guarded("sendInvites", async () => {
    const parsed = bulkInviteSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const { emails, role, teamId, teamRole } = parsed.data;

    const recent = await countRecent(user.id, "created");
    if (recent + emails.length > INVITES_PER_HOUR) {
      return fail(
        `That would pass ${INVITES_PER_HOUR} invites in an hour. Wait a while, or ask another admin to send the rest.`,
        "CONFLICT",
      );
    }

    // A team that does not exist would otherwise be written as a dangling
    // reference and silently drop the team assignment on acceptance.
    let teamName: string | null = null;
    if (teamId) {
      const [team] = await db
        .select({ name: teams.name })
        .from(teams)
        .where(eq(teams.id, teamId))
        .limit(1);
      if (!team) return fail("That team no longer exists.", "NOT_FOUND");
      teamName = team.name;
    }

    const results: InviteOutcome[] = [];
    let mailerConfigured = true;

    for (const email of emails) {
      // Already a member: inviting again would create a row that can never be
      // accepted, because the account already exists.
      const [existing] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .innerJoin(workspaceMembers, eq(workspaceMembers.userId, profiles.id))
        .where(eq(profiles.email, email))
        .limit(1);
      if (existing) {
        results.push({ email, status: "already-member" });
        continue;
      }

      const [open] = await db
        .select({ id: invites.id })
        .from(invites)
        .where(and(eq(invites.email, email), isNull(invites.acceptedAt)))
        .limit(1);
      if (open) {
        results.push({ email, status: "already-invited" });
        continue;
      }

      const [row] = await db
        .insert(invites)
        .values({
          email,
          role,
          teamId: teamId ?? null,
          teamRole: teamId ? teamRole : null,
          invitedBy: user.id,
        })
        .returning({ id: invites.id, token: invites.token, expiresAt: invites.expiresAt });

      await writeAudit({
        actorId: user.id,
        action: "invite.sent",
        entityType: "invite",
        entityId: row.id,
        metadata: { email, role, teamId: teamId ?? null },
      });

      const sent = await sendInviteEmail({
        to: email,
        token: row.token,
        inviterName: user.displayName,
        workspaceName: WORKSPACE_NAME,
        roleLabel: ROLE_LABELS[role] ?? role,
        teamName,
        expiresLabel: row.expiresAt.toDateString(),
      });

      if (sent.sent) {
        results.push({ email, status: "emailed" });
      } else if (sent.reason === "not-configured") {
        mailerConfigured = false;
        results.push({ email, status: "invited" });
      } else {
        results.push({ email, status: "error", detail: sent.detail });
      }
    }

    revalidatePath("/admin/invites");
    revalidatePath("/admin");
    return ok({ results, mailerConfigured });
  });
}

export async function revokeInvite(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("revokeInvite", async () => {
    const parsed = inviteIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // Accepted invites are history: deleting one would erase the record of how
    // an existing member got in, so only open invites can be revoked.
    const [row] = await db
      .delete(invites)
      .where(
        and(eq(invites.id, parsed.data.inviteId), isNull(invites.acceptedAt)),
      )
      .returning({ email: invites.email });

    if (!row) {
      return fail("That invite is no longer open.", "NOT_FOUND");
    }

    await writeAudit({
      actorId: user.id,
      action: "invite.revoked",
      entityType: "invite",
      entityId: parsed.data.inviteId,
      metadata: { email: row.email },
    });

    revalidatePath("/admin/invites");
    revalidatePath("/admin");
    return ok(null);
  });
}

export async function resendInvite(
  input: unknown,
): Promise<ActionResult<{ sent: boolean; reason?: string }>> {
  return guarded("resendInvite", async () => {
    const parsed = inviteIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const [row] = await db
      .select({
        email: invites.email,
        token: invites.token,
        role: invites.role,
        expiresAt: invites.expiresAt,
        teamName: teams.name,
      })
      .from(invites)
      .leftJoin(teams, eq(teams.id, invites.teamId))
      .where(
        and(eq(invites.id, parsed.data.inviteId), isNull(invites.acceptedAt)),
      )
      .limit(1);

    if (!row) return fail("That invite is no longer open.", "NOT_FOUND");

    const recent = await countRecent(user.id, "resent");
    if (recent >= RESENDS_PER_HOUR) {
      return fail(
        `That is ${RESENDS_PER_HOUR} resends in an hour. Wait a while before sending more.`,
        "CONFLICT",
      );
    }

    // Written before the send rather than after, so a provider that hangs
    // still costs the caller their quota — otherwise the limit is bypassed by
    // whatever fails slowly.
    await writeAudit({
      actorId: user.id,
      action: "invite.resent",
      entityType: "invite",
      entityId: parsed.data.inviteId,
      metadata: { email: row.email },
    });

    const sent = await sendInviteEmail({
      to: row.email,
      token: row.token,
      inviterName: user.displayName,
      workspaceName: WORKSPACE_NAME,
      roleLabel: ROLE_LABELS[row.role] ?? row.role,
      teamName: row.teamName,
      expiresLabel: row.expiresAt.toDateString(),
    });

    return ok(
      sent.sent
        ? { sent: true }
        : { sent: false, reason: sent.reason === "not-configured"
            ? "SMTP is not configured, so nothing was sent. Copy the invite link instead."
            : (sent.detail ?? "The mail provider refused the message.") },
    );
  });
}
