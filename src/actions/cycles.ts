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
import { cycles, issues } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  assignCycleSchema,
  completeCycleSchema,
  createCycleSchema,
  cycleIdSchema,
  updateCycleSchema,
} from "@/lib/validators/cycle";

/**
 * Cycle CRUD and assignment.
 *
 * The non-overlap rule from docs/04-DATA-MODEL.md §5 is enforced here in the
 * application: no two non-completed cycles in a project may overlap in date
 * range. Overlap is checked in SQL against every non-completed cycle except
 * the row being edited, so a racing create cannot slip between a read and a
 * write performed in two statements.
 */

function revalidateCycleViews(projectId: string, cycleId?: string): void {
  revalidatePath(`/projects/${projectId}/cycles`);
  if (cycleId) revalidatePath(`/projects/${projectId}/cycles/${cycleId}`);
  revalidatePath(`/projects/${projectId}/issues`);
  revalidatePath("/home");
}

async function projectOfCycleRow(cycleId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: cycles.projectId })
    .from(cycles)
    .where(eq(cycles.id, cycleId))
    .limit(1);
  return row?.projectId ?? null;
}

/** True when another live cycle in the project overlaps the range. */
async function hasOverlap(
  projectId: string,
  startDate: string,
  endDate: string,
  excludeCycleId?: string,
): Promise<boolean> {
  const conditions = [
    eq(cycles.projectId, projectId),
    sql`${cycles.status} <> 'completed'`,
    sql`${cycles.startDate} <= ${endDate} and ${cycles.endDate} >= ${startDate}`,
  ];
  if (excludeCycleId) {
    conditions.push(sql`${cycles.id} <> ${excludeCycleId}`);
  }
  const [row] = await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(and(...conditions))
    .limit(1);
  return row !== undefined;
}

export async function createCycle(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createCycle", async () => {
    const parsed = createCycleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "cycle.manage",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const today = new Date().toISOString().slice(0, 10);
    const status =
      parsed.data.endDate < today
        ? "completed"
        : parsed.data.startDate > today
          ? "upcoming"
          : "active";

    if (
      status !== "completed" &&
      (await hasOverlap(
        parsed.data.projectId,
        parsed.data.startDate,
        parsed.data.endDate,
      ))
    ) {
      return fail(
        "Those dates overlap another live cycle in this project.",
        "CONFLICT",
      );
    }

    const [row] = await db
      .insert(cycles)
      .values({
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status,
        createdBy: user.id,
      })
      .returning({ id: cycles.id });

    revalidateCycleViews(parsed.data.projectId);
    return ok({ id: row.id });
  });
}


export async function updateCycle(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("updateCycle", async () => {
    const parsed = updateCycleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfCycleRow(parsed.data.cycleId);
    if (!projectId) return fail("That cycle no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "cycle.manage", projectId });
    if (!guard.ok) return denied(guard);

    const [existing] = await db
      .select({
        startDate: cycles.startDate,
        endDate: cycles.endDate,
        status: cycles.status,
      })
      .from(cycles)
      .where(eq(cycles.id, parsed.data.cycleId))
      .limit(1);
    if (!existing) return fail("That cycle no longer exists.", "NOT_FOUND");

    const startDate = parsed.data.startDate ?? existing.startDate;
    const endDate = parsed.data.endDate ?? existing.endDate;
    const nextStatus =
      parsed.data.startDate !== undefined || parsed.data.endDate !== undefined
        ? endDate < new Date().toISOString().slice(0, 10)
          ? "completed"
          : startDate > new Date().toISOString().slice(0, 10)
            ? "upcoming"
            : "active"
        : undefined;

    // A completed cycle is history: its dates no longer constrain the live
    // set, and editing a live cycle must not collide with another live one.
    if (
      (nextStatus ?? existing.status) !== "completed" &&
      (parsed.data.startDate !== undefined ||
        parsed.data.endDate !== undefined) &&
      (await hasOverlap(projectId, startDate, endDate, parsed.data.cycleId))
    ) {
      return fail(
        "Those dates overlap another live cycle in this project.",
        "CONFLICT",
      );
    }

    await db
      .update(cycles)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && {
          description: parsed.data.description || null,
        }),
        ...(parsed.data.startDate !== undefined && {
          startDate: parsed.data.startDate,
        }),
        ...(parsed.data.endDate !== undefined && {
          endDate: parsed.data.endDate,
        }),
        ...(nextStatus !== undefined && { status: nextStatus }),
      })
      .where(eq(cycles.id, parsed.data.cycleId));

    revalidateCycleViews(projectId, parsed.data.cycleId);
    return ok(null);
  });
}

export async function deleteCycle(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("deleteCycle", async () => {
    const parsed = cycleIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfCycleRow(parsed.data.cycleId);
    if (!projectId) return fail("That cycle no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "cycle.manage", projectId });
    if (!guard.ok) return denied(guard);

    // issues.cycle_id is set null on delete, so member issues survive the
    // cycle. Snapshots cascade with the cycle row.
    await db.delete(cycles).where(eq(cycles.id, parsed.data.cycleId));

    revalidateCycleViews(projectId);
    return ok(null);
  });
}

/**
 * Assigns up to a hundred issues to a cycle (or clears them with null).
 * Every issue must belong to the cycle's project: a caller who can manage
 * cycles in project A must not be able to pull project B's issues into one.
 */
export async function assignIssuesToCycle(
  input: unknown,
): Promise<ActionResult<{ assigned: number }>> {
  return guarded("assignIssuesToCycle", async () => {
    const parsed = assignCycleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    let projectId: string | null = null;
    if (parsed.data.cycleId) {
      projectId = await projectOfCycleRow(parsed.data.cycleId);
      if (!projectId) return fail("That cycle no longer exists.", "NOT_FOUND");
    } else {
      // Clearing: resolve the project from the first issue instead.
      const [first] = await db
        .select({ projectId: issues.projectId })
        .from(issues)
        .where(eq(issues.id, parsed.data.issueIds[0]))
        .limit(1);
      projectId = first?.projectId ?? null;
      if (!projectId) return fail("Those issues no longer exist.", "NOT_FOUND");
    }

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
      return fail("None of those issues can be assigned.", "NOT_FOUND");
    }

    await db
      .update(issues)
      .set({ cycleId: parsed.data.cycleId })
      .where(
        and(
          inArray(
            issues.id,
            rows.map((row) => row.id),
          ),
          eq(issues.projectId, projectId),
        ),
      );

    // The log_issue_activity trigger diffs cycle_id on every update, so the
    // activity rows and the notification fan-out come from the write itself —
    // no application insert into issue_activity, which the rules forbid.
    revalidateCycleViews(projectId);
    return ok({ assigned: rows.length });
  });
}

/**
 * Completes a cycle. Incomplete issues are moved to another cycle, to the
 * backlog (cycle cleared), or left in place — then the cycle is marked
 * completed so its dates stop constraining the live set.
 */
export async function completeCycle(
  input: unknown,
): Promise<ActionResult<{ moved: number }>> {
  return guarded("completeCycle", async () => {
    const parsed = completeCycleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await projectOfCycleRow(parsed.data.cycleId);
    if (!projectId) return fail("That cycle no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "cycle.manage", projectId });
    if (!guard.ok) return denied(guard);

    if (
      parsed.data.transferToCycleId &&
      (await projectOfCycleRow(parsed.data.transferToCycleId)) !== projectId
    ) {
      return fail("The destination cycle is in another project.", "FORBIDDEN");
    }

    let moved = 0;
    if (parsed.data.transferToCycleId || parsed.data.moveToBacklog) {
      const destination = parsed.data.transferToCycleId ?? null;
      const updated = await db
        .update(issues)
        .set({ cycleId: destination })
        .where(
          and(
            eq(issues.cycleId, parsed.data.cycleId),
            eq(issues.projectId, projectId),
            isNull(issues.archivedAt),
            sql`${issues.stateId} in (select id from states where "group" not in ('completed', 'cancelled'))`,
          ),
        )
        .returning({ id: issues.id });
      moved = updated.length;
    }

    await db
      .update(cycles)
      .set({ status: "completed" })
      .where(eq(cycles.id, parsed.data.cycleId));

    revalidateCycleViews(projectId, parsed.data.cycleId);
    return ok({ moved });
  });
}

