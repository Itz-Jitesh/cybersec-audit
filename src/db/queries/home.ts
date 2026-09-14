import "server-only";

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  cycles,
  issueActivity,
  issueAssignees,
  issues,
  notifications,
  profiles,
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
const ACTIVITY_LIMIT = 12;

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
/**
 * Cycles running today, in projects this person can see.
 *
 * It used to take no arguments and return every running cycle in the workspace,
 * so the home page told a member the names of cycles and projects belonging to
 * teams they are not on. The scope is the same union the rest of the app uses:
 * admins and mentors read everything, everyone else reads their own teams and
 * any project they are a direct member of.
 */
export async function getActiveCycles(
  userId: string,
  readsWholeWorkspace: boolean,
): Promise<ActiveCycle[]> {
  const today = new Date().toISOString().slice(0, 10);

  const visible = readsWholeWorkspace
    ? null
    : sql`exists (
        select 1 from team_members tm
         where tm.team_id = ${projects.teamId} and tm.user_id = ${userId}
      ) or exists (
        select 1 from project_members pm
         where pm.project_id = ${projects.id} and pm.user_id = ${userId}
      )`;

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
    .where(
      and(
        lte(cycles.startDate, today),
        gte(cycles.endDate, today),
        ...(visible ? [visible] : []),
      ),
    )
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

export interface ActivityFeedRow {
  id: string;
  field: string;
  oldDisplay: string | null;
  newDisplay: string | null;
  createdAt: Date;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  issueId: string;
  issueName: string;
  sequenceId: number;
  identifier: string;
  projectId: string;
}

/**
 * The workspace's recent activity, scoped to the projects this person can see.
 *
 * The home page carried a placeholder saying this would arrive in phase 8. The
 * lifecycle that writes issue_activity did arrive; the feed reading it never
 * got built. Worth knowing when reading old rows: until withActor() started
 * setting the JWT claim on the server path, auth.uid() was null for every
 * server action and 0007 made the activity triggers skip, so the table holds
 * nothing from before that fix.
 */
export async function getRecentActivity(
  userId: string,
  readsWholeWorkspace: boolean,
): Promise<ActivityFeedRow[]> {
  const visible = readsWholeWorkspace
    ? null
    : sql`exists (
        select 1 from team_members tm
         where tm.team_id = ${projects.teamId} and tm.user_id = ${userId}
      ) or exists (
        select 1 from project_members pm
         where pm.project_id = ${projects.id} and pm.user_id = ${userId}
      )`;

  return db
    .select({
      id: issueActivity.id,
      field: issueActivity.field,
      oldDisplay: issueActivity.oldDisplay,
      newDisplay: issueActivity.newDisplay,
      createdAt: issueActivity.createdAt,
      actorId: issueActivity.actorId,
      actorName: sql<string>`coalesce(${profiles.displayName}, 'System')`,
      actorAvatarUrl: profiles.avatarUrl,
      issueId: issues.id,
      issueName: issues.name,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      projectId: projects.id,
    })
    .from(issueActivity)
    .innerJoin(issues, eq(issues.id, issueActivity.issueId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .leftJoin(profiles, eq(profiles.id, issueActivity.actorId))
    .where(visible ? visible : sql`true`)
    .orderBy(desc(issueActivity.createdAt))
    .limit(ACTIVITY_LIMIT);
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
