import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db";
import {
  cycles,
  issues,
  modules,
  pages,
  projects,
  states,
} from "@/db/schema";
import { teamMembers } from "@/db/schema/teams";

/**
 * Palette search reads.
 *
 * Each entity is one query with an explicit limit, all in SQL, in parallel.
 * Issues use the search_vector GIN index through websearch_to_tsquery, exactly
 * like the issue list's own search box. Visibility matches the rest of the
 * app: workspace admins and mentors see everything, everyone else sees rows in
 * projects they belong to (directly or through the team).
 */

const PER_ENTITY_LIMIT = 8;

export interface PaletteIssue {
  id: string;
  name: string;
  sequenceId: number;
  identifier: string;
  projectId: string;
  stateColor: string;
}

export interface PaletteCycle {
  id: string;
  name: string;
  projectId: string;
}

export interface PaletteModule {
  id: string;
  name: string;
  projectId: string;
}

export interface PalettePage {
  id: string;
  title: string;
  projectId: string;
}

export interface PaletteResults {
  issues: PaletteIssue[];
  cycles: PaletteCycle[];
  modules: PaletteModule[];
  pages: PalettePage[];
}

async function visibleProjectIds(
  userId: string,
  readsWholeWorkspace: boolean,
): Promise<string[] | null> {
  // Null means unrestricted: the caller is an admin or a mentor.
  if (readsWholeWorkspace) return null;
  const memberships = await db
    .select({ id: projects.id })
    .from(projects)
    .leftJoin(teamMembers, eq(teamMembers.teamId, projects.teamId))
    .where(
      or(
        eq(teamMembers.userId, userId),
        sql`exists (select 1 from project_members pm where pm.project_id = ${projects.id} and pm.user_id = ${userId})`,
      ),
    )
    .limit(500);
  return memberships.map((row) => row.id);
}

/** Palette search across every entity the current user can see. */
export async function searchPalette(
  userId: string,
  readsWholeWorkspace: boolean,
  query: string,
): Promise<PaletteResults> {
  const scope = await visibleProjectIds(userId, readsWholeWorkspace);
  if (scope !== null && scope.length === 0) {
    return { issues: [], cycles: [], modules: [], pages: [] };
  }

  const terms = query.trim();
  if (terms.length === 0) {
    return { issues: [], cycles: [], modules: [], pages: [] };
  }
  const pattern = `%${terms.replace(/[%_]/g, "\\$&")}%`;

  const issueVisibility = scope
    ? inArray(issues.projectId, scope)
    : undefined;
  const cycleVisibility = scope
    ? inArray(cycles.projectId, scope)
    : undefined;
  const moduleVisibility = scope
    ? inArray(modules.projectId, scope)
    : undefined;
  // Workspace-level pages have no route until phase 11 delivers the pages UI,
  // so the palette only surfaces pages that belong to a project.
  const pageVisibility = scope
    ? inArray(pages.projectId, scope)
    : isNotNull(pages.projectId);

  const [issueRows, cycleRows, moduleRows, pageRows] = await Promise.all([
    db
      .select({
        id: issues.id,
        name: issues.name,
        sequenceId: issues.sequenceId,
        identifier: projects.identifier,
        projectId: issues.projectId,
        stateColor: states.color,
      })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .innerJoin(states, eq(states.id, issues.stateId))
      .where(
        and(
          isNull(issues.archivedAt),
          issueVisibility,
          or(
            // search_vector is a generated column created in
            // supabase/migrations/0002_search_vector.sql, so it is not part of
            // the Drizzle schema and is referenced by table name.
            sql`issues.search_vector @@ websearch_to_tsquery('english', ${terms})`,
            sql`${issues.name} ilike ${pattern}`,
          ),
        ),
      )
      .orderBy(
        desc(sql`ts_rank(issues.search_vector, websearch_to_tsquery('english', ${terms}))`),
        desc(issues.sequenceId),
      )
      .limit(PER_ENTITY_LIMIT),

    db
      .select({
        id: cycles.id,
        name: cycles.name,
        projectId: cycles.projectId,
      })
      .from(cycles)
      .where(and(cycleVisibility, sql`${cycles.name} ilike ${pattern}`))
      .orderBy(asc(cycles.startDate))
      .limit(PER_ENTITY_LIMIT),

    db
      .select({
        id: modules.id,
        name: modules.name,
        projectId: modules.projectId,
      })
      .from(modules)
      .where(and(moduleVisibility, sql`${modules.name} ilike ${pattern}`))
      .orderBy(asc(modules.sortOrder))
      .limit(PER_ENTITY_LIMIT),

    db
      .select({
        id: pages.id,
        title: pages.title,
        // pageVisibility filters null projectIds out; the assertion is
        // therefore safe and the palette's PalettePage type stays honest.
        projectId: sql<string>`${pages.projectId}`,
      })
      .from(pages)
      .where(
        and(
          eq(pages.isArchived, false),
          pageVisibility,
          sql`${pages.title} ilike ${pattern}`,
        ),
      )
      .orderBy(asc(pages.title))
      .limit(PER_ENTITY_LIMIT),
  ]);

  return {
    issues: issueRows.map((row) => ({
      ...row,
      identifier: `${row.identifier}-${row.sequenceId}`,
    })),
    cycles: cycleRows,
    modules: moduleRows,
    pages: pageRows,
  };
}

