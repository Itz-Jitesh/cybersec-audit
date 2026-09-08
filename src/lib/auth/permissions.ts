import "server-only";

import { and, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cycles,
  issues,
  modules,
  projectMembers,
  projects,
  teamMembers,
  workspaceMembers,
} from "@/db/schema";

/**
 * The application-side mirror of the Postgres policy matrix
 * (supabase/migrations/0004_rls.sql, docs/04-DATA-MODEL.md §9).
 *
 * It exists because server actions reach the database through Drizzle, which
 * connects as the table owner — and an owner bypasses RLS. The policies remain
 * in force for every client-side access through Supabase; this module makes
 * the same matrix hold on the server path. Authorization is therefore enforced
 * twice, once per access path, and neither is optional.
 *
 * Every function answers one question: may this user perform this operation?
 * Callers turn a false answer into `{ ok: false, error, code }`; nothing here
 * throws, and nothing here reads the row it is deciding about.
 */

export type WorkspaceRole = "admin" | "president" | "co_president" | "member";
export type TeamRole = "lead" | "member";
export type ProjectRole = "admin" | "member";

export interface SessionUser {
  /** auth.users id — the same value Postgres sees as auth.uid(). */
  id: string;
  email: string;
}

/** The user has signed in and belongs to this workspace, active. */
export async function isActiveMember(userId: string): Promise<boolean> {
  const rows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.isActive, true),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** admin, president or co_president — the three workspace-level roles. */
export async function isWorkspaceAdmin(userId: string): Promise<boolean> {
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.isActive, true),
        or(
          eq(workspaceMembers.role, "admin"),
          eq(workspaceMembers.role, "president"),
          eq(workspaceMembers.role, "co_president"),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Workspace admin, or lead of this specific team. */
export async function isTeamLead(
  userId: string,
  teamId: string,
): Promise<boolean> {
  if (await isWorkspaceAdmin(userId)) {
    return true;
  }
  const rows = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "lead"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Workspace admin, direct project member, or member of the project's team —
 * the same three-way union the policies compute.
 */
export async function isProjectMember(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .select({ projectId: projects.id })
    .from(projects)
    .leftJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, projects.id),
        eq(projectMembers.userId, userId),
      ),
    )
    .leftJoin(
      teamMembers,
      and(
        eq(teamMembers.teamId, projects.teamId),
        eq(teamMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(projects.id, projectId),
        sql`(${projectMembers.id} is not null or ${teamMembers.id} is not null)`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Workspace admin, the project's team lead, or a project admin. */
export async function canManageProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const rows = await db
    .select({ teamId: projects.teamId, projectRole: projectMembers.role })
    .from(projects)
    .leftJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, projects.id),
        eq(projectMembers.userId, userId),
      ),
    )
    .where(eq(projects.id, projectId))
    .limit(1);

  if (rows.length === 0) {
    return false;
  }

  if (await isWorkspaceAdmin(userId)) {
    return true;
  }

  const { teamId, projectRole } = rows[0];
  if (projectRole === "admin") {
    return true;
  }
  return teamId !== null && isTeamLead(userId, teamId);
}

/** Scope guards beyond the five shared helpers, mirroring their policies. */
export type Ability =
  /** Any active member: the baseline for reading workspace content. */
  | { kind: "workspace.read" }
  /** Admin / president / co_president only operations. */
  | { kind: "workspace.admin" }
  /** Reading a team and its projects. */
  | { kind: "team.read"; teamId: string }
  /** Creating or editing a team. */
  | { kind: "team.manage"; teamId: string }
  /** Reading a project and its issues. */
  | { kind: "project.read"; projectId: string }
  /** Creating, editing, archiving or deleting a project. */
  | { kind: "project.manage"; projectId: string }
  /** Creating or editing issues inside a project. */
  | { kind: "issue.write"; projectId: string }
  /** Hard-deleting issues inside a project. */
  | { kind: "issue.delete"; projectId: string }
  /** Creating or editing a cycle. */
  | { kind: "cycle.manage"; projectId: string }
  /** Creating or editing a module. */
  | { kind: "module.manage"; projectId: string };

export type AbilityResult =
  | { ok: true }
  | { ok: false; error: string; code: "UNAUTHENTICATED" | "FORBIDDEN" };

/**
 * The single entry point every server action calls after zod validation:
 * `const guard = await assertCan(user, { kind: "issue.write", projectId })`.
 * Returns a discriminated union instead of throwing, so actions can turn it
 * straight into their `{ ok: false, error, code }` shape.
 */
export async function assertCan(
  user: SessionUser | null,
  ability: Ability,
): Promise<AbilityResult> {
  if (user === null) {
    return {
      ok: false,
      error: "You must be signed in.",
      code: "UNAUTHENTICATED",
    };
  }

  if (!(await isActiveMember(user.id))) {
    return {
      ok: false,
      error: "Your membership is not active.",
      code: "FORBIDDEN",
    };
  }

  const scope =
    "teamId" in ability
      ? ability.teamId
      : "projectId" in ability
        ? ability.projectId
        : null;

  let allowed: boolean;
  switch (ability.kind) {
    case "workspace.read":
      allowed = true;
      break;
    case "workspace.admin":
      allowed = await isWorkspaceAdmin(user.id);
      break;
    case "team.read":
      allowed = true;
      break;
    case "team.manage":
      allowed = scope !== null && (await isTeamLead(user.id, scope));
      break;
    case "project.read":
    case "issue.write":
      allowed = scope !== null && (await isProjectMember(user.id, scope));
      break;
    case "project.manage":
    case "issue.delete":
    case "cycle.manage":
    case "module.manage":
      allowed = scope !== null && (await canManageProject(user.id, scope));
      break;
  }

  if (!allowed) {
    return {
      ok: false,
      error: "You do not have permission to do that.",
      code: "FORBIDDEN",
    };
  }
  return { ok: true };
}

/**
 * Guard for the two helpers whose write policies also pin the acting user —
 * an issue creator implicitly subscribes, a comment author must be the caller.
 */
export async function canWriteIssue(
  user: SessionUser | null,
  issueId: string,
): Promise<AbilityResult> {
  if (user === null) {
    return {
      ok: false,
      error: "You must be signed in.",
      code: "UNAUTHENTICATED",
    };
  }
  const rows = await db
    .select({ projectId: issues.projectId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  if (rows.length === 0) {
    return { ok: false, error: "Issue not found.", code: "FORBIDDEN" };
  }
  return assertCan(user, { kind: "issue.write", projectId: rows[0].projectId });
}

/**
 * Cycles and modules are read by project members; both resolve the same
 * project guard, exposed here so detail pages can scope themselves.
 */
export async function projectOfCycle(cycleId: string): Promise<string | null> {
  const rows = await db
    .select({ projectId: cycles.projectId })
    .from(cycles)
    .where(eq(cycles.id, cycleId))
    .limit(1);
  return rows.length > 0 ? rows[0].projectId : null;
}

export async function projectOfModule(
  moduleId: string,
): Promise<string | null> {
  const rows = await db
    .select({ projectId: modules.projectId })
    .from(modules)
    .where(eq(modules.id, moduleId))
    .limit(1);
  return rows.length > 0 ? rows[0].projectId : null;
}
