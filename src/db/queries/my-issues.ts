import "server-only";

import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  issueAssignees,
  issueLabels,
  issues,
  labels,
  projectMembers,
  projects,
  states,
  teamMembers,
} from "@/db/schema";
import type { MyIssueFilters } from "@/lib/validators/my-issues";

/**
 * The cross-project assigned view behind `/my-issues`.
 *
 * Visibility is enforced in the query rather than by the caller, because there
 * is no single project to run assertCan against. Being assigned to an issue is
 * not by itself permission to read it: a member removed from a team keeps
 * their assignment rows, and without the membership test below they would keep
 * seeing that team's work here long after losing access to it everywhere else.
 * The rule mirrors `is_project_member`: a member of the project, or a member
 * of the team that owns it, with workspace admins seeing everything.
 */

export interface MyIssueRow {
  id: string;
  sequenceId: number;
  name: string;
  priority: string;
  projectId: string;
  projectName: string;
  projectIdentifier: string;
  projectIconEmoji: string | null;
  stateId: string;
  stateName: string;
  stateGroup: string;
  stateColor: string;
  targetDate: string | null;
  updatedAt: Date;
  createdAt: Date;
  labels: { id: string; name: string; color: string }[];
}

/** Urgent first. Postgres has no ordering on the enum that means anything. */
const PRIORITY_RANK = sql`case ${issues.priority}
  when 'urgent' then 0 when 'high' then 1 when 'medium' then 2
  when 'low' then 3 else 4 end`;

function buildOrderBy(orderBy: MyIssueFilters["orderBy"]): SQL[] {
  switch (orderBy) {
    case "target_date":
      // Nulls last on ascending, so undated work sinks rather than leads.
      return [asc(issues.targetDate), PRIORITY_RANK as SQL];
    case "updated_at":
      return [desc(issues.updatedAt)];
    case "created_at":
      return [desc(issues.createdAt)];
    default:
      return [PRIORITY_RANK as SQL, asc(issues.targetDate)];
  }
}

export async function getMyIssues(
  userId: string,
  readsWholeWorkspace: boolean,
  filters: MyIssueFilters,
): Promise<MyIssueRow[]> {
  const conditions: SQL[] = [
    eq(issueAssignees.userId, userId),
    eq(projects.isArchived, false),
  ];

  if (!readsWholeWorkspace) {
    conditions.push(
      sql`(
        exists (
          select 1 from ${projectMembers} pm
          where pm.project_id = ${projects.id} and pm.user_id = ${userId}
        )
        or exists (
          select 1 from ${teamMembers} tm
          where tm.team_id = ${projects.teamId} and tm.user_id = ${userId}
        )
      )`,
    );
  }

  if (!filters.includeClosed) {
    conditions.push(inArray(states.group, ["backlog", "unstarted", "started"]));
  }

  if (filters.stateGroups?.length) {
    conditions.push(inArray(states.group, filters.stateGroups));
  }

  if (filters.priorities?.length) {
    conditions.push(
      inArray(
        issues.priority,
        filters.priorities as (typeof issues.priority.enumValues)[number][],
      ),
    );
  }

  if (filters.projectIds?.length) {
    conditions.push(inArray(issues.projectId, filters.projectIds));
  }

  if (filters.search) {
    conditions.push(sql`${issues.name} ilike ${`%${filters.search}%`}`);
  }

  const rows = await db
    .select({
      id: issues.id,
      sequenceId: issues.sequenceId,
      name: issues.name,
      priority: issues.priority,
      projectId: issues.projectId,
      projectName: projects.name,
      projectIdentifier: projects.identifier,
      projectIconEmoji: projects.iconEmoji,
      stateId: states.id,
      stateName: states.name,
      stateGroup: states.group,
      stateColor: states.color,
      targetDate: issues.targetDate,
      updatedAt: issues.updatedAt,
      createdAt: issues.createdAt,
      labels: sql<{ id: string; name: string; color: string }[]>`coalesce((
        select json_agg(json_build_object(
          'id', l.id, 'name', l.name, 'color', l.color
        ) order by l.name)
        from ${issueLabels} il
        join ${labels} l on l.id = il.label_id
        where il.issue_id = ${issues.id}
      ), '[]'::json)`,
    })
    .from(issues)
    .innerJoin(issueAssignees, eq(issueAssignees.issueId, issues.id))
    .innerJoin(states, eq(states.id, issues.stateId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(and(...conditions))
    .orderBy(...buildOrderBy(filters.orderBy))
    .limit(filters.limit);

  return rows.map((row) => ({ ...row, labels: row.labels ?? [] }));
}

/** The projects this view can currently show, for the project filter. */
export async function getMyIssueProjects(
  userId: string,
): Promise<{ id: string; name: string; identifier: string }[]> {
  const rows = await db
    .selectDistinct({
      id: projects.id,
      name: projects.name,
      identifier: projects.identifier,
    })
    .from(issues)
    .innerJoin(issueAssignees, eq(issueAssignees.issueId, issues.id))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(
      and(eq(issueAssignees.userId, userId), eq(projects.isArchived, false)),
    )
    .orderBy(asc(projects.name))
    .limit(50);

  return rows;
}
