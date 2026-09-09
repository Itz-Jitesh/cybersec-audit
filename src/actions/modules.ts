"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  type ActionResult,
  denied,
  fail,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import { db } from "@/db";
import { issues, moduleIssues, modules, states } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  assignModuleIssuesSchema,
  createModuleSchema,
  moduleIdSchema,
  removeModuleIssueSchema,
  updateModuleSchema,
} from "@/lib/validators/module";

/**
 * Module CRUD and issue assignment.
 *
 * Modules group work across cycles, so unlike cycles there is no date-overlap
 * rule — two modules may freely cover the same range. Assignment is a
 * many-to-many through module_issues, and every issue attached must belong to
 * the module's project.
 */

function revalidateModuleViews(projectId: string, moduleId?: string): void {
  revalidatePath(`/projects/${projectId}/modules`);
  if (moduleId) revalidatePath(`/projects/${projectId}/modules/${moduleId}`);
  revalidatePath(`/projects/${projectId}/issues`);
  revalidatePath("/home");
}

async function projectOfModuleRow(moduleId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: modules.projectId })
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);
  return row?.projectId ?? null;
}

export async function createModule(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createModule", async () => {
    const parsed = createModuleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "module.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // Fractional ordering like states: the next sort slot is max + 1000, so
    // inserts never renumber the existing rows.
    const [peak] = await db
      .select({ value: sql<number>`coalesce(max(${modules.sortOrder}), 0)` })
      .from(modules)
      .where(eq(modules.projectId, parsed.data.projectId));
    const sortOrder = Number(peak?.value ?? 0) + 1000;

    const [row] = await db
      .insert(modules)
      .values({
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        leadId: parsed.data.leadId || null,
        status: parsed.data.status,
        startDate: parsed.data.startDate || null,
        targetDate: parsed.data.targetDate || null,
        sortOrder,
        createdBy: user.id,
      })
      .returning({ id: modules.id });

    revalidateModuleViews(parsed.data.projectId);
    return ok({ id: row.id });
  });
}

export async function updateModule(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("updateModule", async () => {
    const parsed = updateModuleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfModuleRow(parsed.data.moduleId);
    if (!projectId) return fail("That module no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "module.manage", projectId });
    if (!guard.ok) return denied(guard);

    await db
      .update(modules)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description || null,
        }),
        ...(parsed.data.leadId !== undefined && {
          leadId: parsed.data.leadId || null,
        }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.startDate !== undefined && {
          startDate: parsed.data.startDate || null,
        }),
        ...(parsed.data.targetDate !== undefined && {
          targetDate: parsed.data.targetDate || null,
        }),
      })
      .where(eq(modules.id, parsed.data.moduleId));

    revalidateModuleViews(projectId, parsed.data.moduleId);
    return ok(null);
  });
}

export async function deleteModule(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("deleteModule", async () => {
    const parsed = moduleIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfModuleRow(parsed.data.moduleId);
    if (!projectId) return fail("That module no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "module.manage", projectId });
    if (!guard.ok) return denied(guard);

    // module_issues cascades, so member issues survive the module.
    await db.delete(modules).where(eq(modules.id, parsed.data.moduleId));

    revalidateModuleViews(projectId);
    return ok(null);
  });
}

/**
 * Attaches issues to a module. Every issue must belong to the module's
 * project, and onConflictDoNothing makes re-adding an attached issue a
 * no-op rather than an error.
 */
export async function addIssuesToModule(
  input: unknown,
): Promise<ActionResult<{ added: number }>> {
  return guarded("addIssuesToModule", async () => {
    const parsed = assignModuleIssuesSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfModuleRow(parsed.data.moduleId);
    if (!projectId) return fail("That module no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "issue.write", projectId });
    if (!guard.ok) return denied(guard);

    const rows = await db
      .select({ id: issues.id })
      .from(issues)
      .where(
        and(
          inArray(issues.id, parsed.data.issueIds),
          eq(issues.projectId, projectId),
          isNull(issues.archivedAt),
        ),
      )
      .limit(100);

    if (rows.length === 0) {
      return fail("None of those issues can be attached.", "NOT_FOUND");
    }

    await db
      .insert(moduleIssues)
      .values(rows.map((row) => ({ moduleId: parsed.data.moduleId, issueId: row.id })))
      .onConflictDoNothing();

    revalidateModuleViews(projectId, parsed.data.moduleId);
    return ok({ added: rows.length });
  });
}

export async function removeIssueFromModule(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("removeIssueFromModule", async () => {
    const parsed = removeModuleIssueSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfModuleRow(parsed.data.moduleId);
    if (!projectId) return fail("That module no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "issue.write", projectId });
    if (!guard.ok) return denied(guard);

    await db
      .delete(moduleIssues)
      .where(
        and(
          eq(moduleIssues.moduleId, parsed.data.moduleId),
          eq(moduleIssues.issueId, parsed.data.issueId),
        ),
      );

    // Deleting a row that was never there is still a success: the end state —
    // the issue not being in the module — is what was asked for.
    revalidateModuleViews(projectId, parsed.data.moduleId);
    return ok(null);
  });
}

/** Live state distribution for one module, for the detail header. */
export async function getModuleStateDistribution(
  input: unknown,
): Promise<ActionResult<{ group: string; count: number }[]>> {
  return guarded("getModuleStateDistribution", async () => {
    const parsed = moduleIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfModuleRow(parsed.data.moduleId);
    if (!projectId) return fail("That module no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "project.read", projectId });
    if (!guard.ok) return denied(guard);

    const rows = await db
      .select({ group: states.group, count: sql<number>`count(*)` })
      .from(moduleIssues)
      .innerJoin(
        issues,
        and(eq(issues.id, moduleIssues.issueId), isNull(issues.archivedAt)),
      )
      .innerJoin(states, eq(states.id, issues.stateId))
      .where(eq(moduleIssues.moduleId, parsed.data.moduleId))
      .groupBy(states.group)
      .limit(10);

    return ok(rows.map((row) => ({ ...row, count: Number(row.count) })));
  });
}

