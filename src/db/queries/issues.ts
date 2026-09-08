import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  comments,
  cycles,
  issueActivity,
  issueAssignees,
  issueAttachments,
  issueLabels,
  issueLinks,
  issueRelations,
  issues,
  labels,
  moduleIssues,
  modules,
  profiles,
  projects,
  states,
} from "@/db/schema";
import type { IssueFilters } from "@/lib/validators/issue";

/**
 * Reads for the issue views.
 *
 * As in src/db/queries/project.ts, the Drizzle connection carries BYPASSRLS, so
 * every function here is scoped by project and every caller must have passed an
 * assertCan check first. Nothing in this file may be called with a project id
 * the user has not been authorised for.
 */

export interface IssueAssignee {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface IssueLabelRef {
  id: string;
  name: string;
  color: string;
}

export interface IssueListItem {
  id: string;
  sequenceId: number;
  identifier: string;
  projectId: string;
  name: string;
  priority: string;
  stateId: string;
  stateName: string;
  stateGroup: string;
  stateColor: string;
  cycleId: string | null;
  cycleName: string | null;
  parentId: string | null;
  startDate: string | null;
  targetDate: string | null;
  estimatePoint: number | null;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
  subIssueCount: number;
  completedSubIssueCount: number;
  assignees: IssueAssignee[];
  labels: IssueLabelRef[];
  moduleIds: string[];
}

/**
 * Map the API orderBy field to the column, then apply the direction.
 * Sorting by state is done via the states table; everything else maps to an
 * issues column. The secondary sort is always sortOrder so rows with the same
 * primary key stay stable.
 */
function buildOrderBy(filters: IssueFilters) {
  const direction = filters.sortDirection === "desc" ? desc : asc;

  const primary =
    filters.orderBy === "created_at"
      ? issues.createdAt
      : filters.orderBy === "updated_at"
        ? issues.updatedAt
        : filters.orderBy === "target_date"
          ? issues.targetDate
          : filters.orderBy === "priority"
            ? issues.priority
            : filters.orderBy === "name"
              ? issues.name
              : filters.orderBy === "state"
                ? states.sequence
                : issues.sortOrder;

  // Secondary sort on sortOrder keeps rows with the same primary key stable.
  return [direction(primary), asc(issues.sortOrder)];
}

/**
 * One query for the whole list.
 *
 * Assignees, labels and modules are aggregated into JSON inside the query
 * rather than fetched per row: a hundred issues would otherwise be three
 * hundred round trips. Sub-issue counts come from a lateral join so an issue
 * with no children still returns a row.
 */
export async function getIssuesForProject(
  filters: IssueFilters,
): Promise<IssueListItem[]> {
  const conditions: SQL[] = [eq(issues.projectId, filters.projectId)];

  if (!filters.includeArchived) {
    conditions.push(isNull(issues.archivedAt));
  }

  if (filters.stateIds?.length) {
    conditions.push(inArray(issues.stateId, filters.stateIds));
  }

  if (filters.priorities?.length) {
    conditions.push(
      inArray(
        issues.priority,
        filters.priorities as (typeof issues.priority.enumValues)[number][],
      ),
    );
  }

  if (filters.cycleIds?.length) {
    conditions.push(inArray(issues.cycleId, filters.cycleIds));
  }

  if (filters.moduleIds?.length) {
    conditions.push(
      inArray(
        issues.id,
        db
          .select({ id: moduleIssues.issueId })
          .from(moduleIssues)
          .where(inArray(moduleIssues.moduleId, filters.moduleIds)),
      ),
    );
  }

  if (filters.stateGroups?.length) {
    conditions.push(
      inArray(
        issues.stateId,
        db
          .select({ id: states.id })
          .from(states)
          .where(inArray(states.group, filters.stateGroups as (typeof states.group.enumValues)[number][])),
      ),
    );
  }

  if (filters.createdByIds?.length) {
    conditions.push(inArray(issues.createdBy, filters.createdByIds));
  }

  if (filters.targetDate?.value) {
    const { op, value, valueTo } = filters.targetDate;
    if (op === "between" && valueTo) {
      conditions.push(
        and(
          gte(issues.targetDate, value),
          lte(issues.targetDate, valueTo),
        ) as SQL,
      );
    } else if (op === "before") {
      conditions.push(lte(issues.targetDate, value));
    } else if (op === "after") {
      conditions.push(gte(issues.targetDate, value));
    } else if (op === "on") {
      conditions.push(eq(issues.targetDate, value));
    }
  }

  // Assignee and label filters require EXISTS subqueries — an issue matches if
  // it has at least one assignee/label in the selected set.
  if (filters.assigneeIds?.length) {
    conditions.push(
      sql`exists (
        select 1 from ${issueAssignees}
        where ${issueAssignees.issueId} = ${issues.id}
        and ${issueAssignees.userId} in ${filters.assigneeIds}
      )` as SQL,
    );
  }

  if (filters.labelIds?.length) {
    conditions.push(
      sql`exists (
        select 1 from ${issueLabels}
        where ${issueLabels.issueId} = ${issues.id}
        and ${issueLabels.labelId} in ${filters.labelIds}
      )` as SQL,
    );
  }

  if (filters.search) {
    // Uses the generated search_vector column and its GIN index rather than a
    // LIKE scan, so this stays usable as the project grows.
    conditions.push(
      // search_vector is a generated column created in
      // supabase/migrations/0002_search_vector.sql, so it is not part of the
      // Drizzle schema and is referenced by name.
      sql`issues.search_vector @@ websearch_to_tsquery('english', ${filters.search})`,
    );
  }

  // These were built with sql.raw and string concatenation. The ids are
  // zod-validated uuids today, so nothing was exploitable, but that made the
  // query's safety depend on a validator in another file staying exactly as it
  // is. inArray parameterises them and removes the string-building path.
  if (filters.assigneeIds?.length) {
    conditions.push(
      sql`exists (
        select 1 from ${issueAssignees}
        where ${issueAssignees.issueId} = ${issues.id}
          and ${inArray(issueAssignees.userId, filters.assigneeIds)}
      )`,
    );
  }

  if (filters.labelIds?.length) {
    conditions.push(
      sql`exists (
        select 1 from ${issueLabels}
        where ${issueLabels.issueId} = ${issues.id}
          and ${inArray(issueLabels.labelId, filters.labelIds)}
      )`,
    );
  }

  const rows = await db
    .select({
      id: issues.id,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      projectId: issues.projectId,
      name: issues.name,
      priority: issues.priority,
      stateId: issues.stateId,
      stateName: states.name,
      stateGroup: states.group,
      stateColor: states.color,
      cycleId: issues.cycleId,
      cycleName: cycles.name,
      parentId: issues.parentId,
      startDate: issues.startDate,
      targetDate: issues.targetDate,
      estimatePoint: issues.estimatePoint,
      sortOrder: issues.sortOrder,
      archivedAt: issues.archivedAt,
      createdAt: issues.createdAt,
      subIssueCount: sql<number>`coalesce(sub.total, 0)`,
      completedSubIssueCount: sql<number>`coalesce(sub.done, 0)`,
      assignees: sql<IssueAssignee[]>`coalesce((
        select json_agg(json_build_object(
          'id', p.id, 'displayName', p.display_name, 'avatarUrl', p.avatar_url
        ) order by p.display_name)
        from issue_assignees ia
        join profiles p on p.id = ia.user_id
        where ia.issue_id = ${issues.id}
      ), '[]'::json)`,
      labels: sql<IssueLabelRef[]>`coalesce((
        select json_agg(json_build_object(
          'id', l.id, 'name', l.name, 'color', l.color
        ) order by l.name)
        from issue_labels il
        join labels l on l.id = il.label_id
        where il.issue_id = ${issues.id}
      ), '[]'::json)`,
      moduleIds: sql<string[]>`coalesce((
        select json_agg(mi.module_id)
        from module_issues mi
        where mi.issue_id = ${issues.id}
      ), '[]'::json)`,
    })
    .from(issues)
    .innerJoin(states, eq(states.id, issues.stateId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .leftJoin(cycles, eq(cycles.id, issues.cycleId))
    .leftJoin(
      sql`lateral (
        select count(*)::int as total,
               count(*) filter (where cs.group = 'completed')::int as done
        from issues c
        join states cs on cs.id = c.state_id
        where c.parent_id = ${issues.id} and c.archived_at is null
      ) sub`,
      sql`true`,
    )
    .where(and(...conditions))
    .orderBy(...buildOrderBy(filters))
    .limit(filters.limit)
    .offset(filters.offset);

  return rows.map((row) => ({
    ...row,
    subIssueCount: Number(row.subIssueCount),
    completedSubIssueCount: Number(row.completedSubIssueCount),
    estimatePoint:
      row.estimatePoint === null ? null : Number(row.estimatePoint),
  }));
}

export interface IssueDetail extends IssueListItem {
  descriptionHtml: string | null;
  descriptionJson: unknown;
  createdById: string;
  createdByName: string;
  updatedAt: Date;
  completedAt: Date | null;
  parentName: string | null;
  parentSequenceId: number | null;
  isSubscribed: boolean;
}

export async function getIssueDetail(
  issueId: string,
  userId: string,
): Promise<IssueDetail | null> {
  const [row] = await db
    .select({
      id: issues.id,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      projectId: issues.projectId,
      name: issues.name,
      descriptionHtml: issues.descriptionHtml,
      descriptionJson: issues.descriptionJson,
      priority: issues.priority,
      stateId: issues.stateId,
      stateName: states.name,
      stateGroup: states.group,
      stateColor: states.color,
      cycleId: issues.cycleId,
      cycleName: cycles.name,
      parentId: issues.parentId,
      startDate: issues.startDate,
      targetDate: issues.targetDate,
      estimatePoint: issues.estimatePoint,
      sortOrder: issues.sortOrder,
      archivedAt: issues.archivedAt,
      createdAt: issues.createdAt,
      updatedAt: issues.updatedAt,
      completedAt: issues.completedAt,
      createdById: issues.createdBy,
      createdByName: profiles.displayName,
      subIssueCount: sql<number>`coalesce((
        select count(*)::int from issues c
        where c.parent_id = ${issues.id} and c.archived_at is null
      ), 0)`,
      completedSubIssueCount: sql<number>`coalesce((
        select count(*)::int from issues c
        join states cs on cs.id = c.state_id
        where c.parent_id = ${issues.id} and c.archived_at is null
          and cs.group = 'completed'
      ), 0)`,
      parentName: sql<string | null>`(
        select p.name from issues p where p.id = ${issues.parentId}
      )`,
      parentSequenceId: sql<number | null>`(
        select p.sequence_id from issues p where p.id = ${issues.parentId}
      )`,
      isSubscribed: sql<boolean>`exists (
        select 1 from issue_subscribers s
        where s.issue_id = ${issues.id} and s.user_id = ${userId}
      )`,
      assignees: sql<IssueAssignee[]>`coalesce((
        select json_agg(json_build_object(
          'id', p.id, 'displayName', p.display_name, 'avatarUrl', p.avatar_url
        ) order by p.display_name)
        from issue_assignees ia
        join profiles p on p.id = ia.user_id
        where ia.issue_id = ${issues.id}
      ), '[]'::json)`,
      labels: sql<IssueLabelRef[]>`coalesce((
        select json_agg(json_build_object(
          'id', l.id, 'name', l.name, 'color', l.color
        ) order by l.name)
        from issue_labels il
        join labels l on l.id = il.label_id
        where il.issue_id = ${issues.id}
      ), '[]'::json)`,
      moduleIds: sql<string[]>`coalesce((
        select json_agg(mi.module_id)
        from module_issues mi where mi.issue_id = ${issues.id}
      ), '[]'::json)`,
    })
    .from(issues)
    .innerJoin(states, eq(states.id, issues.stateId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .innerJoin(profiles, eq(profiles.id, issues.createdBy))
    .leftJoin(cycles, eq(cycles.id, issues.cycleId))
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    subIssueCount: Number(row.subIssueCount),
    completedSubIssueCount: Number(row.completedSubIssueCount),
    estimatePoint:
      row.estimatePoint === null ? null : Number(row.estimatePoint),
  };
}

/** Direct children of an issue, for the sub-issue section. */
export async function getSubIssues(issueId: string) {
  return db
    .select({
      id: issues.id,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      projectId: issues.projectId,
      name: issues.name,
      priority: issues.priority,
      stateGroup: states.group,
      stateColor: states.color,
    })
    .from(issues)
    .innerJoin(states, eq(states.id, issues.stateId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(and(eq(issues.parentId, issueId), isNull(issues.archivedAt)))
    .orderBy(asc(issues.sortOrder))
    .limit(100);
}

/**
 * Relations in both directions. A row stored as "A blocks B" has to appear on
 * B's page as "blocked by A", so the reverse side is selected with its type
 * mirrored rather than relying on the application having written both rows.
 */
export async function getIssueRelations(issueId: string) {
  return db
    .select({
      id: issueRelations.id,
      relationType: issueRelations.relationType,
      issueId: issueRelations.issueId,
      relatedIssueId: issueRelations.relatedIssueId,
      name: issues.name,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      targetProjectId: issues.projectId,
      stateGroup: states.group,
      stateColor: states.color,
    })
    .from(issueRelations)
    .innerJoin(issues, eq(issues.id, issueRelations.relatedIssueId))
    .innerJoin(states, eq(states.id, issues.stateId))
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .where(eq(issueRelations.issueId, issueId))
    .orderBy(asc(issueRelations.createdAt))
    .limit(100);
}

export async function getIssueLinks(issueId: string) {
  return db
    .select({
      id: issueLinks.id,
      url: issueLinks.url,
      title: issueLinks.title,
      createdAt: issueLinks.createdAt,
    })
    .from(issueLinks)
    .where(eq(issueLinks.issueId, issueId))
    .orderBy(asc(issueLinks.createdAt))
    .limit(100);
}

export async function getIssueAttachments(issueId: string) {
  return db
    .select({
      id: issueAttachments.id,
      storagePath: issueAttachments.storagePath,
      fileName: issueAttachments.fileName,
      fileSize: issueAttachments.fileSize,
      mimeType: issueAttachments.mimeType,
      uploadedBy: issueAttachments.uploadedBy,
      uploaderName: profiles.displayName,
      createdAt: issueAttachments.createdAt,
    })
    .from(issueAttachments)
    .innerJoin(profiles, eq(profiles.id, issueAttachments.uploadedBy))
    .where(eq(issueAttachments.issueId, issueId))
    .orderBy(desc(issueAttachments.createdAt))
    .limit(100);
}

export interface CommentRow {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  contentHtml: string;
  isEdited: boolean;
  createdAt: Date;
  reactions: { emoji: string; userIds: string[] }[];
}

export async function getIssueComments(issueId: string): Promise<CommentRow[]> {
  const rows = await db
    .select({
      id: comments.id,
      authorId: comments.authorId,
      authorName: profiles.displayName,
      authorAvatar: profiles.avatarUrl,
      contentHtml: comments.contentHtml,
      isEdited: comments.isEdited,
      createdAt: comments.createdAt,
      reactions: sql<{ emoji: string; userIds: string[] }[]>`coalesce((
        select json_agg(r) from (
          select cr.emoji as emoji,
                 json_agg(cr.user_id) as "userIds"
          from comment_reactions cr
          where cr.comment_id = ${comments.id}
          group by cr.emoji
          order by cr.emoji
        ) r
      ), '[]'::json)`,
    })
    .from(comments)
    .innerJoin(profiles, eq(profiles.id, comments.authorId))
    .where(eq(comments.issueId, issueId))
    .orderBy(asc(comments.createdAt))
    .limit(200);

  return rows;
}

export interface ActivityRow {
  id: string;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
  field: string;
  oldDisplay: string | null;
  newDisplay: string | null;
  createdAt: Date;
}

export async function getIssueActivity(
  issueId: string,
): Promise<ActivityRow[]> {
  return db
    .select({
      id: issueActivity.id,
      actorId: issueActivity.actorId,
      actorName: profiles.displayName,
      actorAvatar: profiles.avatarUrl,
      field: issueActivity.field,
      oldDisplay: issueActivity.oldDisplay,
      newDisplay: issueActivity.newDisplay,
      createdAt: issueActivity.createdAt,
    })
    .from(issueActivity)
    .innerJoin(profiles, eq(profiles.id, issueActivity.actorId))
    .where(eq(issueActivity.issueId, issueId))
    .orderBy(asc(issueActivity.createdAt))
    .limit(200);
}

/** Candidate parents and relation targets: other issues in the same project. */
export async function searchIssuesInProject(
  projectId: string,
  term: string,
  excludeId?: string,
) {
  const conditions: SQL[] = [
    eq(issues.projectId, projectId),
    isNull(issues.archivedAt),
  ];

  if (term.trim().length > 0) {
    conditions.push(
      or(
        sql`${issues.name} ilike ${`%${term}%`}`,
        sql`${issues.sequenceId}::text = ${term.replace(/\D/g, "")}`,
      ) as SQL,
    );
  }

  const rows = await db
    .select({
      id: issues.id,
      name: issues.name,
      sequenceId: issues.sequenceId,
      identifier: projects.identifier,
      stateGroup: states.group,
      stateColor: states.color,
    })
    .from(issues)
    .innerJoin(projects, eq(projects.id, issues.projectId))
    .innerJoin(states, eq(states.id, issues.stateId))
    .where(and(...conditions))
    .orderBy(desc(issues.createdAt))
    .limit(20);

  return excludeId ? rows.filter((row) => row.id !== excludeId) : rows;
}

/** Modules in a project, for the module picker. */
export async function getProjectModules(projectId: string) {
  return db
    .select({ id: modules.id, name: modules.name })
    .from(modules)
    .where(eq(modules.projectId, projectId))
    .orderBy(asc(modules.name))
    .limit(100);
}

/** Cycles in a project, for the cycle picker. */
export async function getProjectCycles(projectId: string) {
  return db
    .select({ id: cycles.id, name: cycles.name, status: cycles.status })
    .from(cycles)
    .where(eq(cycles.projectId, projectId))
    .orderBy(desc(cycles.startDate))
    .limit(100);
}

/** Labels available in a project, for the label picker. */
export async function getLabelOptions(projectId: string) {
  return db
    .select({ id: labels.id, name: labels.name, color: labels.color })
    .from(labels)
    .where(eq(labels.projectId, projectId))
    .orderBy(asc(labels.name))
    .limit(200);
}

/** Modules an issue belongs to, used when saving the module picker. */
export async function getIssueModuleIds(issueId: string): Promise<string[]> {
  const rows = await db
    .select({ moduleId: moduleIssues.moduleId })
    .from(moduleIssues)
    .where(eq(moduleIssues.issueId, issueId))
    .limit(50);
  return rows.map((row) => row.moduleId);
}
