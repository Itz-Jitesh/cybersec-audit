import "server-only";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { issues, moduleIssues, modules, profiles, states } from "@/db/schema";

/** Card grids stay readable; nobody pages two hundred modules. */
const MODULE_LIMIT = 200;

/**
 * Reads for modules.
 *
 * Progress is computed here as SQL aggregates over the live issue set, so the
 * card always reflects the current state distribution without a second query.
 * Callers must have passed assertCan for project.read before calling in.
 */

export interface ModuleRow {
  id: string;
  name: string;
  description: string | null;
  status: "planned" | "in_progress" | "paused" | "completed" | "cancelled";
  leadId: string | null;
  leadName: string | null;
  leadAvatarUrl: string | null;
  startDate: string | null;
  targetDate: string | null;
  total: number;
  completed: number;
}

export async function getProjectModules(
  projectId: string,
): Promise<ModuleRow[]> {
  const rows = await db
    .select({
      id: modules.id,
      name: modules.name,
      description: modules.description,
      status: modules.status,
      leadId: modules.leadId,
      leadName: profiles.displayName,
      leadAvatarUrl: profiles.avatarUrl,
      startDate: modules.startDate,
      targetDate: modules.targetDate,
      total: sql<number>`count(${issues.id})`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
    })
    .from(modules)
    .leftJoin(profiles, eq(profiles.id, modules.leadId))
    .leftJoin(moduleIssues, eq(moduleIssues.moduleId, modules.id))
    .leftJoin(
      issues,
      and(eq(issues.id, moduleIssues.issueId), isNull(issues.archivedAt)),
    )
    .leftJoin(states, eq(states.id, issues.stateId))
    .where(eq(modules.projectId, projectId))
    .groupBy(
      modules.id,
      modules.name,
      modules.description,
      modules.status,
      modules.leadId,
      profiles.displayName,
      profiles.avatarUrl,
      modules.startDate,
      modules.targetDate,
    )
    .orderBy(asc(modules.name))
    .limit(MODULE_LIMIT);

  return rows.map((row) => ({
    ...row,
    total: Number(row.total),
    completed: Number(row.completed),
  }));
}

export interface ModuleDetail extends ModuleRow {
  projectId: string;
}

export async function getModule(moduleId: string): Promise<ModuleDetail | null> {
  const [row] = await db
    .select({
      id: modules.id,
      name: modules.name,
      description: modules.description,
      status: modules.status,
      leadId: modules.leadId,
      leadName: profiles.displayName,
      leadAvatarUrl: profiles.avatarUrl,
      startDate: modules.startDate,
      targetDate: modules.targetDate,
      projectId: modules.projectId,
      total: sql<number>`count(${issues.id})`,
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
    })
    .from(modules)
    .leftJoin(profiles, eq(profiles.id, modules.leadId))
    .leftJoin(moduleIssues, eq(moduleIssues.moduleId, modules.id))
    .leftJoin(
      issues,
      and(eq(issues.id, moduleIssues.issueId), isNull(issues.archivedAt)),
    )
    .leftJoin(states, eq(states.id, issues.stateId))
    .where(eq(modules.id, moduleId))
    .groupBy(
      modules.id,
      modules.name,
      modules.description,
      modules.status,
      modules.leadId,
      profiles.displayName,
      profiles.avatarUrl,
      modules.startDate,
      modules.targetDate,
      modules.projectId,
    )
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    total: Number(row.total),
    completed: Number(row.completed),
  };
}

/** Live progress counts for one module, for the detail header. */
export async function getModuleProgress(
  moduleId: string,
): Promise<{ total: number; completed: number; open: number }> {
  const [row] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${states.group} = 'completed')`,
    })
    .from(moduleIssues)
    .innerJoin(
      issues,
      and(eq(issues.id, moduleIssues.issueId), isNull(issues.archivedAt)),
    )
    .innerJoin(states, eq(states.id, issues.stateId))
    .where(eq(moduleIssues.moduleId, moduleId));

  const total = Number(row?.total ?? 0);
  const completed = Number(row?.completed ?? 0);
  return { total, completed, open: total - completed };
}
