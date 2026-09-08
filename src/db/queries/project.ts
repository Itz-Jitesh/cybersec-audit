import "server-only";

import { and, asc, eq } from "drizzle-orm";

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

export async function getProjectMembers(
  projectId: string,
): Promise<MemberRow[]> {
  return db
    .select({
      userId: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
      role: projectMembers.role,
    })
    .from(projectMembers)
    .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(profiles.displayName))
    .limit(MEMBER_LIMIT);
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
      userId: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(profiles, eq(profiles.id, teamMembers.userId))
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
