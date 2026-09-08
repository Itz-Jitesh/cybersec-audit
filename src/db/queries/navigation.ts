import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { favorites, projects, teamMembers, teams } from "@/db/schema";

export interface NavProject {
  id: string;
  name: string;
  identifier: string;
  iconEmoji: string | null;
}

export interface NavTeam {
  id: string;
  name: string;
  slug: string;
  color: string;
  projects: NavProject[];
}

export interface NavigationTree {
  teams: NavTeam[];
  favoriteProjects: NavProject[];
}

/** Nobody in this club is in fifty teams; the caps exist so no query is unbounded. */
const TEAM_LIMIT = 50;
const PROJECT_LIMIT = 200;
const FAVORITE_LIMIT = 50;

/**
 * The sidebar tree for one user: their teams, the projects inside them, and
 * their starred projects.
 *
 * Read with Drizzle in three flat queries rather than a nested relational one,
 * because the shape needed is a grouping the database cannot return directly
 * and a `with` clause here would fan out into a join per project.
 *
 * A workspace administrator sees every team. Everyone else sees the teams they
 * belong to — the same boundary RLS enforces, applied here so the sidebar does
 * not advertise the existence of teams the user cannot open.
 */
export async function getNavigationTree(
  userId: string,
  isWorkspaceAdmin: boolean,
): Promise<NavigationTree> {
  const visibleTeams = isWorkspaceAdmin
    ? await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          color: teams.color,
        })
        .from(teams)
        .orderBy(asc(teams.name))
        .limit(TEAM_LIMIT)
    : await db
        .select({
          id: teams.id,
          name: teams.name,
          slug: teams.slug,
          color: teams.color,
        })
        .from(teams)
        .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
        .where(eq(teamMembers.userId, userId))
        .orderBy(asc(teams.name))
        .limit(TEAM_LIMIT);

  if (visibleTeams.length === 0) {
    return { teams: [], favoriteProjects: [] };
  }

  const teamIds = visibleTeams.map((team) => team.id);

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      identifier: projects.identifier,
      iconEmoji: projects.iconEmoji,
      teamId: projects.teamId,
    })
    .from(projects)
    .where(
      and(inArray(projects.teamId, teamIds), eq(projects.isArchived, false)),
    )
    .orderBy(asc(projects.name))
    .limit(PROJECT_LIMIT);

  const byTeam = new Map<string, NavProject[]>();
  for (const row of rows) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      identifier: row.identifier,
      iconEmoji: row.iconEmoji,
    });
    byTeam.set(row.teamId, list);
  }

  const starred = await db
    .select({
      id: projects.id,
      name: projects.name,
      identifier: projects.identifier,
      iconEmoji: projects.iconEmoji,
    })
    .from(favorites)
    .innerJoin(projects, eq(projects.id, favorites.entityId))
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.entityType, "project"),
        eq(projects.isArchived, false),
      ),
    )
    .orderBy(asc(favorites.sortOrder))
    .limit(FAVORITE_LIMIT);

  return {
    teams: visibleTeams.map((team) => ({
      ...team,
      projects: byTeam.get(team.id) ?? [],
    })),
    favoriteProjects: starred,
  };
}
