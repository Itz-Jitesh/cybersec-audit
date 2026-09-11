import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { issueAssignees, issues, profiles, states } from "@/db/schema";

/**
 * Project analytics, the four figures docs/07-BUILD-PHASES.md phase 11 names.
 *
 * All four are aggregates computed in Postgres rather than rows shipped to the
 * server and counted there — a project with a few thousand issues would
 * otherwise pull the whole table across the wire to draw four small charts.
 * The caller asserts project.read first.
 */

const TREND_DAYS = 30;
const ASSIGNEE_LIMIT = 20;

export interface TrendPoint {
  day: string;
  created: number;
  completed: number;
}

/**
 * Issues created and issues completed per day for the last thirty days.
 *
 * generate_series supplies the days, so a day with no activity is a zero
 * rather than a gap — a line chart that skips empty days misreads a quiet week
 * as a steep one.
 */
export async function getOpenClosedTrend(
  projectId: string,
): Promise<TrendPoint[]> {
  const rows = await db.execute<{
    day: string;
    created: number;
    completed: number;
  }>(sql`
    with days as (
      select generate_series(
        (current_date - ${TREND_DAYS - 1}::int),
        current_date,
        interval '1 day'
      )::date as day
    )
    select
      to_char(days.day, 'YYYY-MM-DD') as day,
      (
        select count(*) from issues i
        where i.project_id = ${projectId}
          and i.created_at::date = days.day
      )::int as created,
      (
        select count(*) from issues i
        where i.project_id = ${projectId}
          and i.completed_at is not null
          and i.completed_at::date = days.day
      )::int as completed
    from days
    order by days.day
  `);

  return Array.from(rows).map((row) => ({
    day: row.day,
    created: Number(row.created),
    completed: Number(row.completed),
  }));
}

export interface StateSlice {
  stateId: string;
  name: string;
  group: string;
  color: string;
  count: number;
}

export async function getStateDistribution(
  projectId: string,
): Promise<StateSlice[]> {
  const rows = await db
    .select({
      stateId: states.id,
      name: states.name,
      group: states.group,
      color: states.color,
      count: sql<number>`count(${issues.id})`,
    })
    .from(states)
    .leftJoin(
      issues,
      and(eq(issues.stateId, states.id), isNull(issues.archivedAt)),
    )
    .where(eq(states.projectId, projectId))
    .groupBy(states.id, states.name, states.group, states.color, states.sequence)
    .orderBy(states.sequence)
    .limit(50);

  return rows.map((row) => ({ ...row, count: Number(row.count) }));
}

export interface AssigneeLoad {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  open: number;
  completed: number;
}

export async function getAssigneeLoad(
  projectId: string,
): Promise<AssigneeLoad[]> {
  const rows = await db
    .select({
      userId: issueAssignees.userId,
      displayName: sql<string>`coalesce(${profiles.displayName}, 'Member')`,
      avatarUrl: profiles.avatarUrl,
      open: sql<number>`count(*) filter (where ${states.group} not in ('completed', 'cancelled'))`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
    })
    .from(issueAssignees)
    .innerJoin(
      issues,
      and(eq(issues.id, issueAssignees.issueId), isNull(issues.archivedAt)),
    )
    .innerJoin(states, eq(states.id, issues.stateId))
    .leftJoin(profiles, eq(profiles.id, issueAssignees.userId))
    .where(eq(issues.projectId, projectId))
    .groupBy(issueAssignees.userId, profiles.displayName, profiles.avatarUrl)
    .orderBy(sql`count(*) desc`)
    .limit(ASSIGNEE_LIMIT);

  return rows.map((row) => ({
    ...row,
    open: Number(row.open),
    completed: Number(row.completed),
  }));
}

export interface ProjectTotals {
  total: number;
  open: number;
  completed: number;
  overdue: number;
  unassigned: number;
}

export async function getProjectTotals(
  projectId: string,
): Promise<ProjectTotals> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${states.group} not in ('completed', 'cancelled'))`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
      // Overdue means past its target date and not finished. A completed issue
      // with a date in the past is simply late, not outstanding work.
      overdue: sql<number>`count(*) filter (
        where ${issues.targetDate} is not null
          and ${issues.targetDate} < current_date
          and ${states.group} not in ('completed', 'cancelled')
      )`,
      unassigned: sql<number>`count(*) filter (
        where not exists (
          select 1 from ${issueAssignees} ia where ia.issue_id = ${issues.id}
        )
      )`,
    })
    .from(issues)
    .innerJoin(states, eq(states.id, issues.stateId))
    .where(and(eq(issues.projectId, projectId), isNull(issues.archivedAt)));

  return {
    total: Number(row?.total ?? 0),
    open: Number(row?.open ?? 0),
    completed: Number(row?.completed ?? 0),
    overdue: Number(row?.overdue ?? 0),
    unassigned: Number(row?.unassigned ?? 0),
  };
}
