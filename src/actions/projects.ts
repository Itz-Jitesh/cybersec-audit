"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";
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
import { issues, labels, projectMembers, projects, states } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_LABELS, DEFAULT_STATES } from "@/lib/constants/defaults";
import {
  createLabelSchema,
  createProjectSchema,
  createStateSchema,
  deleteProjectSchema,
  identifierSchema,
  labelIdSchema,
  projectIdSchema,
  projectMemberSchema,
  reorderStateSchema,
  setProjectRoleSchema,
  stateIdSchema,
  updateLabelSchema,
  updateProjectSchema,
  updateStateSchema,
} from "@/lib/validators/project";

/** Gap between adjacent states, leaving room to insert between them forever. */
const SEQUENCE_STEP = 1000;

/** Checks a candidate identifier for the create form's debounced lookup. */
export async function isIdentifierAvailable(
  candidate: string,
): Promise<ActionResult<{ available: boolean }>> {
  return guarded("isIdentifierAvailable", async () => {
    const parsed = identifierSchema.safeParse(candidate);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.read" });
    if (!guard.ok) return denied(guard);

    const [taken] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(sql`upper(${projects.identifier}) = ${parsed.data}`)
      .limit(1);

    return ok({ available: !taken });
  });
}

export async function createProject(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createProject", async () => {
    const parsed = createProjectSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    // Projects are created by a workspace administrator or the lead of the
    // team they are going into, which is what team.manage encodes.
    const guard = await assertCan(user, {
      kind: "team.manage",
      teamId: parsed.data.teamId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const [taken] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(sql`upper(${projects.identifier}) = ${parsed.data.identifier}`)
      .limit(1);

    if (taken) {
      return fail(
        `The identifier ${parsed.data.identifier} is already in use.`,
        "CONFLICT",
      );
    }

    // A project with no states cannot hold an issue, and a project whose
    // creator is not a member of it is unusable by the person who just made it.
    // All three inserts therefore succeed together or not at all.
    const created = await db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({
          teamId: parsed.data.teamId,
          name: parsed.data.name,
          identifier: parsed.data.identifier,
          description: parsed.data.description || null,
          iconEmoji: parsed.data.iconEmoji || null,
          leadId: parsed.data.leadId || null,
          createdBy: user.id,
        })
        .returning({ id: projects.id });

      await tx.insert(states).values(
        DEFAULT_STATES.map((state) => ({
          projectId: project.id,
          name: state.name,
          group: state.group,
          color: state.color,
          sequence: state.sequence,
          isDefault: state.isDefault,
        })),
      );

      await tx.insert(labels).values(
        DEFAULT_LABELS.map((label) => ({
          projectId: project.id,
          name: label.name,
          color: label.color,
        })),
      );

      await tx.insert(projectMembers).values({
        projectId: project.id,
        userId: user.id,
        role: "admin",
      });

      // A named lead who is not the creator still needs to be a member.
      if (parsed.data.leadId && parsed.data.leadId !== user.id) {
        await tx
          .insert(projectMembers)
          .values({
            projectId: project.id,
            userId: parsed.data.leadId,
            role: "admin",
          })
          .onConflictDoNothing();
      }

      return project;
    });

    revalidatePath("/", "layout");
    return ok(created);
  });
}

export async function updateProject(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("updateProject", async () => {
    const parsed = updateProjectSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const { projectId, ...changes } = parsed.data;
    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.manage", projectId });
    if (!guard.ok) return denied(guard);

    await db
      .update(projects)
      .set({
        ...(changes.name !== undefined && { name: changes.name }),
        ...(changes.description !== undefined && {
          description: changes.description || null,
        }),
        ...(changes.iconEmoji !== undefined && {
          iconEmoji: changes.iconEmoji || null,
        }),
        ...(changes.leadId !== undefined && { leadId: changes.leadId }),
      })
      .where(eq(projects.id, projectId));

    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function archiveProject(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("archiveProject", async () => {
    const parsed = projectIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    await db
      .update(projects)
      .set({ isArchived: true })
      .where(eq(projects.id, parsed.data.projectId));

    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function deleteProject(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("deleteProject", async () => {
    const parsed = deleteProjectSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    // Deletion is irreversible and cascades to every issue, so it is held to
    // the workspace-admin bar rather than project.manage.
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);

    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, parsed.data.projectId))
      .limit(1);

    if (!project) return fail("That project no longer exists.", "NOT_FOUND");

    if (parsed.data.confirmation !== project.name) {
      return fail("Type the project name exactly to confirm.", "VALIDATION");
    }

    await db.delete(projects).where(eq(projects.id, project.id));

    if (user) {
      await writeAudit({
        actorId: user.id,
        action: "project.deleted",
        entityType: "project",
        entityId: project.id,
        metadata: { name: project.name },
      });
    }

    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function addProjectMember(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("addProjectMember", async () => {
    const parsed = projectMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    await db
      .insert(projectMembers)
      .values({
        projectId: parsed.data.projectId,
        userId: parsed.data.userId,
      })
      .onConflictDoNothing();

    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    return ok(null);
  });
}

export async function removeProjectMember(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("removeProjectMember", async () => {
    const parsed = projectMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    // Removing the last administrator would leave the project unmanageable.
    const [remainingAdmins] = await db
      .select({ value: count() })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.role, "admin"),
          ne(projectMembers.userId, parsed.data.userId),
        ),
      );

    const [target] = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.userId, parsed.data.userId),
        ),
      )
      .limit(1);

    if (target?.role === "admin" && Number(remainingAdmins?.value ?? 0) === 0) {
      return fail(
        "Give someone else project admin before removing the last one.",
        "CONFLICT",
      );
    }

    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.userId, parsed.data.userId),
        ),
      );

    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    return ok(null);
  });
}

export async function setProjectRole(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("setProjectRole", async () => {
    const parsed = setProjectRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    await db
      .update(projectMembers)
      .set({ role: parsed.data.role })
      .where(
        and(
          eq(projectMembers.projectId, parsed.data.projectId),
          eq(projectMembers.userId, parsed.data.userId),
        ),
      );

    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    return ok(null);
  });
}

/* -------------------------------------------------------------------------
   States
   ------------------------------------------------------------------------- */

async function projectOfState(stateId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: states.projectId })
    .from(states)
    .where(eq(states.id, stateId))
    .limit(1);
  return row?.projectId ?? null;
}

export async function createState(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createState", async () => {
    const parsed = createStateSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    const [last] = await db
      .select({ sequence: states.sequence })
      .from(states)
      .where(eq(states.projectId, parsed.data.projectId))
      .orderBy(sql`${states.sequence} desc`)
      .limit(1);

    const [created] = await db
      .insert(states)
      .values({
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        group: parsed.data.group,
        color: parsed.data.color,
        sequence: (last?.sequence ?? 0) + SEQUENCE_STEP,
      })
      .returning({ id: states.id });

    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    return ok(created);
  });
}

export async function updateState(input: unknown): Promise<ActionResult<null>> {
  return guarded("updateState", async () => {
    const parsed = updateStateSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfState(parsed.data.stateId);
    if (!projectId) return fail("That state no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.manage", projectId });
    if (!guard.ok) return denied(guard);

    // Exactly one state per project is the default, so promoting one demotes
    // the rest in the same transaction.
    await db.transaction(async (tx) => {
      if (parsed.data.isDefault === true) {
        await tx
          .update(states)
          .set({ isDefault: false })
          .where(eq(states.projectId, projectId));
      }

      await tx
        .update(states)
        .set({
          ...(parsed.data.name !== undefined && { name: parsed.data.name }),
          ...(parsed.data.group !== undefined && { group: parsed.data.group }),
          ...(parsed.data.color !== undefined && { color: parsed.data.color }),
          ...(parsed.data.isDefault !== undefined && {
            isDefault: parsed.data.isDefault,
          }),
        })
        .where(eq(states.id, parsed.data.stateId));
    });

    revalidatePath(`/projects/${projectId}/settings`);
    return ok(null);
  });
}

export async function reorderState(
  input: unknown,
): Promise<ActionResult<{ sequence: number }>> {
  return guarded("reorderState", async () => {
    const parsed = reorderStateSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfState(parsed.data.stateId);
    if (!projectId) return fail("That state no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.manage", projectId });
    if (!guard.ok) return denied(guard);

    const neighbours = await db
      .select({ id: states.id, sequence: states.sequence })
      .from(states)
      .where(eq(states.projectId, projectId));

    const before = neighbours.find((row) => row.id === parsed.data.beforeId);
    const after = neighbours.find((row) => row.id === parsed.data.afterId);

    // Fractional ordering: the moved row takes the midpoint between its new
    // neighbours, so no other row is rewritten and a drag is a single-row
    // update however long the list is.
    let sequence: number;
    if (before && after) {
      sequence = (before.sequence + after.sequence) / 2;
    } else if (before) {
      sequence = before.sequence + SEQUENCE_STEP;
    } else if (after) {
      sequence = after.sequence - SEQUENCE_STEP;
    } else {
      sequence = SEQUENCE_STEP;
    }

    await db
      .update(states)
      .set({ sequence })
      .where(eq(states.id, parsed.data.stateId));

    revalidatePath(`/projects/${projectId}/settings`);
    return ok({ sequence });
  });
}

export async function deleteState(input: unknown): Promise<ActionResult<null>> {
  return guarded("deleteState", async () => {
    const parsed = stateIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfState(parsed.data.stateId);
    if (!projectId) return fail("That state no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.manage", projectId });
    if (!guard.ok) return denied(guard);

    const [target] = await db
      .select({ isDefault: states.isDefault, name: states.name })
      .from(states)
      .where(eq(states.id, parsed.data.stateId))
      .limit(1);

    if (!target) return fail("That state no longer exists.", "NOT_FOUND");

    if (target.isDefault) {
      return fail(
        "Make another state the default before deleting this one.",
        "DEFAULT_STATE",
      );
    }

    const [total] = await db
      .select({ value: count() })
      .from(states)
      .where(eq(states.projectId, projectId));

    if (Number(total?.value ?? 0) <= 1) {
      return fail("A project needs at least one state.", "LAST_STATE");
    }

    // issues.state_id is not null, so a state holding issues cannot be removed
    // without deciding where those issues go — which is the user's call, not
    // something to guess at here.
    const [inUse] = await db
      .select({ value: count() })
      .from(issues)
      .where(eq(issues.stateId, parsed.data.stateId));

    const issueCount = Number(inUse?.value ?? 0);
    if (issueCount > 0) {
      return fail(
        `${target.name} still holds ${issueCount} issue${issueCount === 1 ? "" : "s"}. Move them to another state first.`,
        "STATE_IN_USE",
      );
    }

    await db.delete(states).where(eq(states.id, parsed.data.stateId));

    revalidatePath(`/projects/${projectId}/settings`);
    return ok(null);
  });
}

/* -------------------------------------------------------------------------
   Labels
   ------------------------------------------------------------------------- */

async function projectOfLabel(labelId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: labels.projectId })
    .from(labels)
    .where(eq(labels.id, labelId))
    .limit(1);
  return row?.projectId ?? null;
}

export async function createLabel(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createLabel", async () => {
    const parsed = createLabelSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    const [existing] = await db
      .select({ id: labels.id })
      .from(labels)
      .where(
        and(
          eq(labels.projectId, parsed.data.projectId),
          sql`lower(${labels.name}) = lower(${parsed.data.name})`,
        ),
      )
      .limit(1);

    if (existing) {
      return fail(
        "This project already has a label with that name.",
        "CONFLICT",
      );
    }

    const [created] = await db
      .insert(labels)
      .values({
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        color: parsed.data.color,
      })
      .returning({ id: labels.id });

    revalidatePath(`/projects/${parsed.data.projectId}/settings`);
    return ok(created);
  });
}

export async function updateLabel(input: unknown): Promise<ActionResult<null>> {
  return guarded("updateLabel", async () => {
    const parsed = updateLabelSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfLabel(parsed.data.labelId);
    if (!projectId) return fail("That label no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.manage", projectId });
    if (!guard.ok) return denied(guard);

    await db
      .update(labels)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.color !== undefined && { color: parsed.data.color }),
      })
      .where(eq(labels.id, parsed.data.labelId));

    revalidatePath(`/projects/${projectId}/settings`);
    return ok(null);
  });
}

export async function deleteLabel(input: unknown): Promise<ActionResult<null>> {
  return guarded("deleteLabel", async () => {
    const parsed = labelIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfLabel(parsed.data.labelId);
    if (!projectId) return fail("That label no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.manage", projectId });
    if (!guard.ok) return denied(guard);

    // issue_labels cascades, so removing a label detaches it from its issues
    // rather than blocking. That is the right default: a label is a tag, and
    // losing it costs nothing that cannot be reapplied.
    await db.delete(labels).where(eq(labels.id, parsed.data.labelId));

    revalidatePath(`/projects/${projectId}/settings`);
    return ok(null);
  });
}
