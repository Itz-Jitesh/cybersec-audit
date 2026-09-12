import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  favorites,
  labels,
  profiles,
  projectMembers,
  projects,
  states,
  teamMembers,
  teams,
  workspaceMembers,
} from "@/db/schema";

/**
 * IMPORTANT — read this before adding a query to this file.
 *
 * The Drizzle connection uses the Supabase `postgres` role, which carries
 * BYPASSRLS. Row level security therefore does **not** constrain anything read
 * through `db`; it constrains the Supabase client path only. Every function
 * here must scope by membership itself, and every caller must pass an
 * `assertCan` guard first. `docs/03-TRD.md` §3 allows this — "the query
 * explicitly scopes by membership" — but it is a discipline, not a mechanism,
 * so it has to be applied deliberately every time.
 */

const MEMBER_LIMIT = 100;
const STATE_LIMIT = 50;
const LABEL_LIMIT = 100;
const PROJECT_LIMIT = 100;

export interface ProjectSummary {
  id: string;
  name: string;
  identifier: string;
  description: string | null;
  iconEmoji: string | null;
  teamId: string;
  teamName: string;
  teamSlug: string;
  leadId: string | null;
  isArchived: boolean;
}

export async function getProject(
  projectId: string,
): Promise<ProjectSummary | null> {
  const [row] = await db
    .select({
      id: projects.id,
      name: projects.name,
      identifier: projects.identifier,
      description: projects.description,
      iconEmoji: projects.iconEmoji,
      teamId: projects.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      leadId: projects.leadId,
      isArchived: projects.isArchived,
    })
    .from(projects)
    .innerJoin(teams, eq(teams.id, projects.teamId))
    .where(eq(projects.id, projectId))
    .limit(1);

  return row ?? null;
}

export interface MemberRow {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: string;
}

/**
 * Everyone who may work on this project: its explicit project_members rows plus
 * every member of the project's team.
 *
 * The union is the point. Membership of the owning team *is* membership of the
 * project — that is what is_project_member computes in RLS and what assertCan
 * mirrors — but project_members only ever holds the creator and anyone added by
 * hand. Selecting that table alone left the assignee picker, the @mention list
 * and the member list showing the project's creator and nobody else, so a team
 * could not be assigned work on its own project.
 *
 * A direct project row wins on role, since 'admin' there is a real grant that
 * team membership does not confer.
 */
export async function getProjectMembers(
  projectId: string,
): Promise<MemberRow[]> {
  const rows = await db
    .select({
      userId: sql<string>`u.user_id`,
      displayName: sql<string>`coalesce(${profiles.displayName}, 'Member')`,
      email: sql<string>`coalesce(${profiles.email}, '')`,
      avatarUrl: profiles.avatarUrl,
      role: sql<string>`case when bool_or(u.role = 'admin') then 'admin' else 'member' end`,
    })
    .from(
      sql`(
        select pm.user_id, pm.role::text as role
          from ${projectMembers} pm
         where pm.project_id = ${projectId}
        union all
        select tm.user_id, 'member' as role
          from ${teamMembers} tm
          join ${projects} p on p.id = ${projectId} and p.team_id = tm.team_id
      ) as u`,
    )
    .leftJoin(profiles, sql`${profiles.id} = u.user_id`)
    .groupBy(
      sql`u.user_id`,
      profiles.displayName,
      profiles.email,
      profiles.avatarUrl,
    )
    .orderBy(asc(profiles.displayName))
    .limit(MEMBER_LIMIT);

  return rows;
}

export async function getProjectStates(projectId: string) {
  return db
    .select({
      id: states.id,
      name: states.name,
      group: states.group,
      color: states.color,
      sequence: states.sequence,
      isDefault: states.isDefault,
    })
    .from(states)
    .where(eq(states.projectId, projectId))
    .orderBy(asc(states.sequence))
    .limit(STATE_LIMIT);
}

export async function getProjectLabels(projectId: string) {
  return db
    .select({ id: labels.id, name: labels.name, color: labels.color })
    .from(labels)
    .where(eq(labels.projectId, projectId))
    .orderBy(asc(labels.name))
    .limit(LABEL_LIMIT);
}

export interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  logoEmoji: string | null;
}

export async function getTeamBySlug(slug: string): Promise<TeamDetail | null> {
  const [row] = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      description: teams.description,
      color: teams.color,
      logoEmoji: teams.logoEmoji,
    })
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);

  return row ?? null;
}

export async function getTeamMembers(teamId: string): Promise<MemberRow[]> {
  return db
    .select({
      userId: teamMembers.userId,
      displayName: sql<string>`coalesce(${profiles.displayName}, 'Member')`,
      email: sql<string>`coalesce(${profiles.email}, '')`,
      avatarUrl: profiles.avatarUrl,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(profiles.displayName))
    .limit(MEMBER_LIMIT);
}

export interface TeamProjectCard extends ProjectSummary {
  isFavorite: boolean;
}

/** Projects in a team, flagged with whether this user has starred them. */
export async function getTeamProjects(
  teamId: string,
  userId: string,
): Promise<TeamProjectCard[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      identifier: projects.identifier,
      description: projects.description,
      iconEmoji: projects.iconEmoji,
      teamId: projects.teamId,
      teamName: teams.name,
      teamSlug: teams.slug,
      leadId: projects.leadId,
      isArchived: projects.isArchived,
      favoriteId: favorites.id,
    })
    .from(projects)
    .innerJoin(teams, eq(teams.id, projects.teamId))
    .leftJoin(
      favorites,
      and(
        eq(favorites.entityId, projects.id),
        eq(favorites.entityType, "project"),
        eq(favorites.userId, userId),
      ),
    )
    .where(and(eq(projects.teamId, teamId), eq(projects.isArchived, false)))
    .orderBy(asc(projects.name))
    .limit(PROJECT_LIMIT);

  return rows.map(({ favoriteId, ...project }) => ({
    ...project,
    isFavorite: favoriteId !== null,
  }));
}

/**
 * Active workspace members, for the lead and assignee pickers. Deactivated
 * members are excluded: offering them in a picker invites assigning work to
 * someone who can no longer sign in.
 */
export async function getWorkspaceMembers(): Promise<MemberRow[]> {
  return db
    .select({
      userId: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
      role: workspaceMembers.role,
    })
    .from(profiles)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, profiles.id))
    .where(eq(workspaceMembers.isActive, true))
    .orderBy(asc(profiles.displayName))
    .limit(MEMBER_LIMIT);
}
