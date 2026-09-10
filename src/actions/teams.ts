"use server";

import { and, eq } from "drizzle-orm";
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
import { projects, teamMembers, teams } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  addTeamMemberSchema,
  createTeamSchema,
  deleteTeamSchema,
  setTeamRoleSchema,
  teamMemberSchema,
  updateTeamSchema,
} from "@/lib/validators/team";

/** A club team is tens of people; this is a guard, not a page size. */
const TEAM_ROSTER_LIMIT = 200;

/**
 * Membership changes move a person's read access across every project the team
 * owns, so the sidebar, the admin table and the team page must all reflect it
 * immediately. The layout revalidation covers the navigation tree; the two
 * explicit paths cover the surfaces that render the roster itself.
 */
async function revalidateTeam(teamId: string): Promise<void> {
  const [team] = await db
    .select({ slug: teams.slug })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  revalidatePath("/", "layout");
  revalidatePath("/admin/teams");
  if (team) revalidatePath(`/teams/${team.slug}`);
}

export async function createTeam(
  input: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return guarded("createTeam", async () => {
    const parsed = createTeamSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    // Only workspace administrators create teams, so the guard is the
    // workspace-level one rather than a team scope that does not exist yet.
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);

    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, parsed.data.slug))
      .limit(1);

    if (existing.length > 0) {
      return fail("A team with that slug already exists.", "CONFLICT");
    }

    const [created] = await db
      .insert(teams)
      .values({
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        color: parsed.data.color,
        logoEmoji: parsed.data.logoEmoji || null,
        createdBy: user?.id ?? null,
      })
      .returning({ id: teams.id, slug: teams.slug });

    revalidatePath("/", "layout");
    return ok(created);
  });
}

export async function updateTeam(input: unknown): Promise<ActionResult<null>> {
  return guarded("updateTeam", async () => {
    const parsed = updateTeamSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const { teamId, ...changes } = parsed.data;
    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "team.manage", teamId });
    if (!guard.ok) return denied(guard);

    await db
      .update(teams)
      .set({
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.slug !== undefined && { slug: changes.slug }),
        ...(changes.description !== undefined && {
          description: changes.description || null,
        }),
        ...(changes.color !== undefined && { color: changes.color }),
        ...(changes.logoEmoji !== undefined && {
          logoEmoji: changes.logoEmoji || null,
        }),
      })
      .where(eq(teams.id, teamId));

    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function deleteTeam(input: unknown): Promise<ActionResult<null>> {
  return guarded("deleteTeam", async () => {
    const parsed = deleteTeamSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    // Deletion is administrator-only even though a team lead may edit a team.
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);

    const [team] = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.id, parsed.data.teamId))
      .limit(1);

    if (!team) return fail("That team no longer exists.", "NOT_FOUND");

    // The typed confirmation is checked here, not only in the dialog. A UI
    // check is a courtesy; this is the control.
    if (parsed.data.confirmation !== team.name) {
      return fail("Type the team name exactly to confirm.", "VALIDATION");
    }

    const [remaining] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.teamId, team.id))
      .limit(1);

    if (remaining) {
      return fail(
        "Move or delete this team's projects before deleting the team.",
        "CONFLICT",
      );
    }

    await db.delete(teams).where(eq(teams.id, team.id));

    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "team.deleted",
        entityType: "team",
        entityId: team.id,
        metadata: { name: team.name },
      });
    }

    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function addTeamMember(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("addTeamMember", async () => {
    const parsed = addTeamMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "team.manage",
      teamId: parsed.data.teamId,
    });
    if (!guard.ok) return denied(guard);

    // The unique constraint on (team_id, user_id) decides this, not a prior
    // read: two admins adding the same person at once would both pass a check
    // done in application code. An empty returning() means the row was already
    // there, which is a no-op worth reporting rather than an error.
    const inserted = await db
      .insert(teamMembers)
      .values({
        teamId: parsed.data.teamId,
        userId: parsed.data.userId,
        role: parsed.data.role,
      })
      .onConflictDoNothing()
      .returning({ id: teamMembers.id });

    if (inserted.length === 0) {
      return fail("That person is already in this team.", "ALREADY_MEMBER");
    }

    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "team.member_added",
        entityType: "team_member",
        entityId: parsed.data.userId,
        metadata: {
          teamId: parsed.data.teamId,
          targetUserId: parsed.data.userId,
          role: parsed.data.role,
        },
      });
    }

    await revalidateTeam(parsed.data.teamId);
    return ok(null);
  });
}

export async function removeTeamMember(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("removeTeamMember", async () => {
    const parsed = teamMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "team.manage",
      teamId: parsed.data.teamId,
    });
    if (!guard.ok) return denied(guard);

    const roster = await db
      .select({ userId: teamMembers.userId, role: teamMembers.role })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, parsed.data.teamId))
      .limit(TEAM_ROSTER_LIMIT);

    const target = roster.find((row) => row.userId === parsed.data.userId);
    if (!target) {
      return fail("That person is not in this team.", "NOT_FOUND");
    }

    // A team with members but no lead has nobody who can manage it, and only a
    // workspace admin could then repair it. Emptying a team completely is
    // allowed — there is nothing left to strand.
    const leadCount = roster.filter((row) => row.role === "lead").length;
    if (target.role === "lead" && leadCount === 1 && roster.length > 1) {
      return fail(
        "This is the team's only lead. Promote another member first.",
        "LAST_LEAD",
      );
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, parsed.data.teamId),
          eq(teamMembers.userId, parsed.data.userId),
        ),
      );

    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "team.member_removed",
        entityType: "team_member",
        entityId: parsed.data.userId,
        metadata: {
          teamId: parsed.data.teamId,
          targetUserId: parsed.data.userId,
          previousRole: target.role,
        },
      });
    }

    await revalidateTeam(parsed.data.teamId);
    return ok(null);
  });
}

export async function setTeamRole(input: unknown): Promise<ActionResult<null>> {
  return guarded("setTeamRole", async () => {
    const parsed = setTeamRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "team.manage",
      teamId: parsed.data.teamId,
    });
    if (!guard.ok) return denied(guard);

    // Read the previous role first so the audit entry records the transition
    // rather than only its destination. Multiple leads per team are allowed,
    // so there is no single-lead constraint to enforce here.
    const [existing] = await db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, parsed.data.teamId),
          eq(teamMembers.userId, parsed.data.userId),
        ),
      )
      .limit(1);

    if (!existing) {
      return fail("That person is not in this team.", "NOT_FOUND");
    }

    await db
      .update(teamMembers)
      .set({ role: parsed.data.role })
      .where(
        and(
          eq(teamMembers.teamId, parsed.data.teamId),
          eq(teamMembers.userId, parsed.data.userId),
        ),
      );

    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "team.role_changed",
        entityType: "team_member",
        entityId: parsed.data.userId,
        metadata: {
          teamId: parsed.data.teamId,
          targetUserId: parsed.data.userId,
          previousRole: existing.role,
          role: parsed.data.role,
        },
      });
    }

    await revalidateTeam(parsed.data.teamId);
    return ok(null);
  });
}
