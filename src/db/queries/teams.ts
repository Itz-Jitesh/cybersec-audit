import "server-only";

import { and, asc, eq, exists, sql } from "drizzle-orm";

import { db } from "@/db";
import { profiles, teamMembers, teams, workspaceMembers } from "@/db/schema";
import type { TeamMemberRole } from "@/lib/validators/team";

/** A club team is tens of people. The limit is a guard, not a page size. */
const TEAM_MEMBER_LIMIT = 200;

export interface TeamMemberProfile {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  role: TeamMemberRole;
}

export interface TeamWithMembers {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  logoEmoji: string | null;
  members: TeamMemberProfile[];
}

/** The team and its roster in one round trip. Null when the team is gone. */
export async function getTeamWithMembers(
  teamId: string,
): Promise<TeamWithMembers | null> {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      description: teams.description,
      color: teams.color,
      logoEmoji: teams.logoEmoji,
      userId: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
      memberRole: teamMembers.role,
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .leftJoin(profiles, eq(profiles.id, teamMembers.userId))
    .where(eq(teams.id, teamId))
    // Leads first, then by name, so the people who can act on the team read
    // at the top of the list.
    .orderBy(
      sql`case when ${teamMembers.role} = 'lead' then 0 else 1 end`,
      asc(profiles.displayName),
    )
    .limit(TEAM_MEMBER_LIMIT);

  const first = rows[0];
  if (!first) return null;

  return {
    id: first.id,
    name: first.name,
    slug: first.slug,
    description: first.description,
    color: first.color,
    logoEmoji: first.logoEmoji,
    // The left join yields one row with null member columns for an empty team.
    members: rows.flatMap((row) =>
      row.userId === null || row.displayName === null
        ? []
        : [
            {
              userId: row.userId,
              displayName: row.displayName,
              email: row.email ?? "",
              avatarUrl: row.avatarUrl,
              role: row.memberRole ?? "member",
            },
          ],
    ),
  };
}

/**
 * Active workspace members with no row on this team.
 *
 * Filtered in SQL with a NOT EXISTS rather than by fetching everybody and
 * subtracting in TypeScript: the exclusion is a property of the query, and
 * doing it in the client would mean the limit above applied before the filter.
 */
export async function getWorkspaceMembersNotInTeam(
  teamId: string,
): Promise<Omit<TeamMemberProfile, "role">[]> {
  return db
    .select({
      userId: profiles.id,
      displayName: profiles.displayName,
      email: profiles.email,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, profiles.id))
    .where(
      and(
        eq(workspaceMembers.isActive, true),
        sql`not ${exists(
          db
            .select({ one: sql`1` })
            .from(teamMembers)
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, profiles.id),
              ),
            ),
        )}`,
      ),
    )
    .orderBy(asc(profiles.displayName))
    .limit(TEAM_MEMBER_LIMIT);
}
