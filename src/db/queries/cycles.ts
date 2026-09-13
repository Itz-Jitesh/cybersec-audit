import "server-only";

import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { cycles, cycleSnapshots, issues, states } from "@/db/schema";

/** Nobody needs more than two hundred cycles in one project view. */
const CYCLE_LIMIT = 200;
const SNAPSHOT_LIMIT = 400;

/**
 * Reads for cycles.
 *
 * Like every query module, this runs through Drizzle as the table owner and so
 * bypasses RLS. Callers must have passed assertCan for project.read (lists) or
 * cycle.manage (writes) before calling in.
 */

export interface CycleRow {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
  total: number;
  completed: number;
  started: number;
}

/** Cycles grouped by status, each with live issue counts from SQL aggregates. */
export async function getProjectCycles(projectId: string): Promise<{
  active: CycleRow[];
  upcoming: CycleRow[];
  completed: CycleRow[];
}> {
  const rows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      description: cycles.description,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      status: cycles.status,
      total: sql<number>`count(${issues.id})`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
      started: sql<number>`count(*) filter (where ${states.group} = 'started')`,
    })
    .from(cycles)
    .leftJoin(issues, eq(issues.cycleId, cycles.id))
    .leftJoin(states, eq(states.id, issues.stateId))
    .where(eq(cycles.projectId, projectId))
    .groupBy(
      cycles.id,
      cycles.name,
      cycles.description,
      cycles.startDate,
      cycles.endDate,
      cycles.status,
    )
    .orderBy(asc(cycles.startDate))
    .limit(CYCLE_LIMIT);

  const shaped: CycleRow[] = rows.map((row) => ({
    ...row,
    total: Number(row.total),
    completed: Number(row.completed),
    started: Number(row.started),
  }));

  return {
    active: shaped.filter((row) => row.status === "active"),
    upcoming: shaped.filter((row) => row.status === "upcoming"),
    completed: shaped.filter((row) => row.status === "completed"),
  };
}

export interface CycleDetail {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed";
  projectId: string;
  total: number;
  completed: number;
  started: number;
}

export async function getCycle(cycleId: string): Promise<CycleDetail | null> {
  const [row] = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      description: cycles.description,
      startDate: cycles.startDate,
      endDate: cycles.endDate,
      status: cycles.status,
      projectId: cycles.projectId,
      total: sql<number>`count(${issues.id})`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
      started: sql<number>`count(*) filter (where ${states.group} = 'started')`,
    })
    .from(cycles)
    .leftJoin(issues, eq(issues.cycleId, cycleId))
    .leftJoin(states, eq(states.id, issues.stateId))
    .where(eq(cycles.id, cycleId))
    .groupBy(
      cycles.id,
      cycles.name,
      cycles.description,
      cycles.startDate,
      cycles.endDate,
      cycles.status,
      cycles.projectId,
    )
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    total: Number(row.total),
    completed: Number(row.completed),
    started: Number(row.started),
  };
}

export interface CycleSnapshot {
  snapshotDate: string;
  totalIssues: number;
  completedIssues: number;
  startedIssues: number;
  pendingIssues: number;
}

/** Daily snapshots for the burndown chart, oldest first. */
export async function getCycleSnapshots(
  cycleId: string,
): Promise<CycleSnapshot[]> {
  return db
    .select({
      snapshotDate: cycleSnapshots.snapshotDate,
      totalIssues: cycleSnapshots.totalIssues,
      completedIssues: cycleSnapshots.completedIssues,
      startedIssues: cycleSnapshots.startedIssues,
      pendingIssues: cycleSnapshots.pendingIssues,
    })
    .from(cycleSnapshots)
    .where(eq(cycleSnapshots.cycleId, cycleId))
    .orderBy(asc(cycleSnapshots.snapshotDate))
    .limit(SNAPSHOT_LIMIT);
}

/** Incomplete issues in a cycle, for the completion dialog. */
export async function getIncompleteCycleIssues(
  cycleId: string,
): Promise<{ id: string; name: string; sequenceId: number }[]> {
  return db
    .select({ id: issues.id, name: issues.name, sequenceId: issues.sequenceId })
    .from(issues)
    .innerJoin(states, eq(states.id, issues.stateId))
    .where(
      and(
        eq(issues.cycleId, cycleId),
        sql`${states.group} not in ('completed', 'cancelled')`,
      ),
    )
    .orderBy(asc(issues.sequenceId))
    .limit(500);
}

/** Other non-completed cycles in the project, as transfer destinations. */
export async function getTransferTargets(
  projectId: string,
  excludeCycleId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: cycles.id, name: cycles.name })
    .from(cycles)
    .where(
      and(
        eq(cycles.projectId, projectId),
        sql`${cycles.id} <> ${excludeCycleId}`,
        sql`${cycles.status} <> 'completed'`,
      ),
    )
    .orderBy(asc(cycles.startDate))
    .limit(50);
}

/** Snapshot counts for one cycle, for the daily cron. */
export async function snapshotCycleCounts(
  cycleId: string,
): Promise<{
  total: number;
  completed: number;
  started: number;
  pending: number;
}> {
  const [row] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
      started: sql<number>`count(*) filter (where ${states.group} = 'started')`,
      pending: sql<number>`count(*) filter (where ${states.group} in ('backlog', 'unstarted'))`,
    })
    .from(issues)
    .innerJoin(states, eq(states.id, issues.stateId))
    .where(eq(issues.cycleId, cycleId));

  return {
    total: Number(row?.total ?? 0),
    completed: Number(row?.completed ?? 0),
    started: Number(row?.started ?? 0),
    pending: Number(row?.pending ?? 0),
  };
}

/** Active cycle ids in one project as of a date. Used by the cron. */
export async function getActiveCycleIds(
  projectId: string,
  today: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: cycles.id })
    .from(cycles)
    .where(
      and(
        eq(cycles.projectId, projectId),
        lte(cycles.startDate, today),
        gte(cycles.endDate, today),
      ),
    )
    .limit(20);
  return rows.map((row) => row.id);
}

/** Project ids holding at least one cycle, so the cron can sweep them. */
export async function getProjectsWithCycles(): Promise<string[]> {
  const rows = await db
    .select({ projectId: cycles.projectId })
    .from(cycles)
    .groupBy(cycles.projectId)
    .orderBy(desc(sql`max(${cycles.endDate})`))
    .limit(500);
  return rows.map((row) => row.projectId);
}
