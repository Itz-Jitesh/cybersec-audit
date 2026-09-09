import "server-only";

import { desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  invites,
  profiles,
  teamMembers,
  teams,
  workspaceMembers,
} from "@/db/schema";

/**
 * Reads for the admin panel. Every one of these is admin-only; the caller
 * asserts workspace.admin before calling in, since these queries deliberately
 * ignore team scoping.
 */

const MEMBER_LIMIT = 200;
const INVITE_LIMIT = 200;

export interface AdminMember {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  joinedAt: Date;
  teams: { id: string; name: string; role: string }[];
}

export async function getAdminMembers(): Promise<AdminMember[]> {
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      email: profiles.email,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      role: workspaceMembers.role,
      isActive: workspaceMembers.isActive,
      joinedAt: workspaceMembers.joinedAt,
      // One row per member with the team list folded in, rather than a second
      // query per member.
      teams: sql<{ id: string; name: string; role: string }[]>`coalesce((
        select json_agg(json_build_object(
          'id', t.id, 'name', t.name, 'role', tm.role
        ) order by t.name)
        from ${teamMembers} tm
        join ${teams} t on t.id = tm.team_id
        where tm.user_id = ${workspaceMembers.userId}
      ), '[]'::json)`,
    })
    .from(workspaceMembers)
    .innerJoin(profiles, eq(profiles.id, workspaceMembers.userId))
    .orderBy(profiles.displayName)
    .limit(MEMBER_LIMIT);

  return rows.map((row) => ({ ...row, teams: row.teams ?? [] }));
}

export interface AdminInvite {
  id: string;
  email: string;
  role: string;
  teamId: string | null;
  teamName: string | null;
  teamRole: string | null;
  token: string;
  invitedByName: string | null;
  expiresAt: Date;
  createdAt: Date;
}

/** Open invites only — accepted ones are history and live in the audit log. */
export async function getOpenInvites(): Promise<AdminInvite[]> {
  return db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      teamId: invites.teamId,
      teamName: teams.name,
      teamRole: invites.teamRole,
      token: invites.token,
      invitedByName: profiles.displayName,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .leftJoin(teams, eq(teams.id, invites.teamId))
    .leftJoin(profiles, eq(profiles.id, invites.invitedBy))
    .where(isNull(invites.acceptedAt))
    .orderBy(desc(invites.createdAt))
    .limit(INVITE_LIMIT);
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
  actorName: string;
  actorAvatarUrl: string | null;
}

export async function getAuditLog(
  limit: number,
  offset: number,
): Promise<AuditEntry[]> {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      actorName: profiles.displayName,
      actorAvatarUrl: profiles.avatarUrl,
    })
    .from(auditLog)
    .innerJoin(profiles, eq(profiles.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Counters for the admin overview. */
export async function getWorkspaceCounts(): Promise<{
  members: number;
  active: number;
  openInvites: number;
  teams: number;
}> {
  const [row] = await db
    .select({
      members: sql<number>`(select count(*) from ${workspaceMembers})`,
      active: sql<number>`(select count(*) from ${workspaceMembers} where is_active)`,
      openInvites: sql<number>`(select count(*) from ${invites} where accepted_at is null)`,
      teams: sql<number>`(select count(*) from ${teams})`,
    })
    .from(sql`(select 1) as one`);

  return {
    members: Number(row?.members ?? 0),
    active: Number(row?.active ?? 0),
    openInvites: Number(row?.openInvites ?? 0),
    teams: Number(row?.teams ?? 0),
  };
}
