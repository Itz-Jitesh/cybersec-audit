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
  createTeamSchema,
  deleteTeamSchema,
  setTeamRoleSchema,
  teamMemberSchema,
  updateTeamSchema,
} from "@/lib/validators/team";

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
    const parsed = teamMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "team.manage",
      teamId: parsed.data.teamId,
    });
    if (!guard.ok) return denied(guard);

    await db
      .insert(teamMembers)
      .values({ teamId: parsed.data.teamId, userId: parsed.data.userId })
      .onConflictDoNothing();

    revalidatePath("/", "layout");
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

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, parsed.data.teamId),
          eq(teamMembers.userId, parsed.data.userId),
        ),
      );

    revalidatePath("/", "layout");
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

    const updated = await db
      .update(teamMembers)
      .set({ role: parsed.data.role })
      .where(
        and(
          eq(teamMembers.teamId, parsed.data.teamId),
          eq(teamMembers.userId, parsed.data.userId),
        ),
      )
      .returning({ id: teamMembers.id });

    if (updated.length === 0) {
      return fail("That person is not in this team.", "NOT_FOUND");
    }

    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "team.role_changed",
        entityType: "team_member",
        entityId: parsed.data.userId,
        metadata: { teamId: parsed.data.teamId, role: parsed.data.role },
      });
    }

    revalidatePath("/", "layout");
    return ok(null);
  });
}
