import "server-only";

import { and, count, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cycles,
  issueAssignees,
  issues,
  notifications,
  projects,
  states,
} from "@/db/schema";

export interface HomeStats {
  assigned: number;
  inProgress: number;
  overdue: number;
  completedThisWeek: number;
}

export interface HomeIssue {
  id: string;
  name: string;
  sequenceId: number;
  identifier: string;
  projectId: string;
  priority: string;
  stateGroup: string;
  stateColor: string;
  targetDate: string | null;
}

export interface ActiveCycle {
  id: string;
  name: string;
  projectId: string;
  projectName: string;
  endDate: string;
  total: number;
  completed: number;
}

const ASSIGNED_LIMIT = 8;
const CYCLE_LIMIT = 5;

/**
 * Four counts for the stat row, computed as SQL aggregates in one round trip.
 * Counting in JavaScript would mean fetching every assigned issue just to
 * discard all but the number, which is the thing docs/03-TRD.md §3 rules out.
 *
 * Every count is scoped to issues assigned to this user and not archived. RLS
 * still applies underneath, so a project the user cannot see contributes
 * nothing even if a stale assignment row survives.
 */
export async function getHomeStats(userId: string): Promise<HomeStats> {
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  const today = new Date().toISOString().slice(0, 10);

  const [row] = await db
    .select({
      assigned: count(),
      inProgress: sql<number>`count(*) filter (where ${states.group} = 'started')`,
      overdue: sql<number>`count(*) filter (
        where ${issues.targetDate} is not null
          and ${issues.targetDate} < ${today}
          and ${states.group} not in ('completed', 'cancelled')
      )`,
      completedThisWeek: sql<number>`count(*) filter (
        where ${issues.completedAt} is not null
          and ${issues.completedAt} >= ${startOfWeek.toISOString()}
      )`,
    })
    .from(issues)
    .innerJoin(issueAssignees, eq(issueAssignees.issueId, issues.id))
    .innerJoin(states, eq(states.id, issues.stateId))
    .where(eq(issueAssignees.userId, userId));

  return {
    assigned: Number(row?.assigned ?? 0),
    inProgress: Number(row?.inProgress ?? 0),
    overdue: Number(row?.overdue ?? 0),
    completedThisWeek: Number(row?.completedThisWeek ?? 0),
  };
}

/** The user's open assignments, most urgent first. */
export async function getMyOpenIssues(userId: string): Promise<HomeIssue[]> {
  const rows = await db
    .select({
      id: issues.id,
      name: issues.name,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      projectId: issues.projectId,
      priority: issues.priority,
      stateGroup: states.group,
      stateColor: states.color,
      targetDate: issues.targetDate,
    })
    .from(issues)
    .innerJoin(issueAssignees, eq(issueAssignees.issueId, issues.id))
    .innerJoin(states, eq(states.id, issues.stateId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(
      and(
        eq(issueAssignees.userId, userId),
        inArray(states.group, ["backlog", "unstarted", "started"]),
      ),
    )
    .orderBy(
      // Urgent first, then the soonest target date. Postgres sorts nulls last
      // on ascending order, which puts undated issues at the bottom already.
      sql`case ${issues.priority}
            when 'urgent' then 0 when 'high' then 1 when 'medium' then 2
            when 'low' then 3 else 4 end`,
      issues.targetDate,
    )
    .limit(ASSIGNED_LIMIT);

  return rows;
}

/** Cycles running right now in the projects this user can see. */
export async function getActiveCycles(): Promise<ActiveCycle[]> {
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: cycles.id,
      name: cycles.name,
      projectId: cycles.projectId,
      projectName: projects.name,
      endDate: cycles.endDate,
      total: sql<number>`count(${issues.id})`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
    })
    .from(cycles)
    .innerJoin(projects, eq(projects.id, cycles.projectId))
    .leftJoin(issues, eq(issues.cycleId, cycles.id))
    .leftJoin(states, eq(states.id, issues.stateId))
    .where(and(lte(cycles.startDate, today), gte(cycles.endDate, today)))
    .groupBy(
      cycles.id,
      cycles.name,
      cycles.projectId,
      projects.name,
      cycles.endDate,
    )
    .orderBy(cycles.endDate)
    .limit(CYCLE_LIMIT);

  return rows.map((row) => ({
    ...row,
    total: Number(row.total),
    completed: Number(row.completed),
  }));
}

/** Unread notification count for the header bell and the sidebar badge. */
export async function getUnreadNotificationCount(
  userId: string,
): Promise<number> {
  const now = new Date();

  const [row] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        sql`(${notifications.snoozedTill} is null or ${notifications.snoozedTill} <= ${now.toISOString()})`,
      ),
    );

  return Number(row?.value ?? 0);
}
