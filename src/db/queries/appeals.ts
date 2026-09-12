import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { issueAppeals, issues, profiles } from "@/db/schema";

/**
 * Reads for the appeal queue.
 *
 * Scoped by project id, and every caller checks project.read first — the Drizzle
 * connection bypasses RLS, so the boundary has to be applied here as well as in
 * the policies.
 */

const APPEAL_LIMIT = 100;

export interface AppealRow {
  id: string;
  kind: "create" | "complete";
  status: "pending" | "approved" | "rejected" | "cancelled";
  title: string | null;
  note: string | null;
  proposedPriority: string;
  issueId: string | null;
  issueName: string | null;
  issueSequenceId: number | null;
  createdIssueId: string | null;
  requestedById: string;
  requestedByName: string;
  requestedByAvatar: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export async function getProjectAppeals(
  projectId: string,
): Promise<AppealRow[]> {
  const decider = sql<string | null>`(
    select d.display_name from profiles d where d.id = ${issueAppeals.decidedBy}
  )`;

  return db
    .select({
      id: issueAppeals.id,
      kind: issueAppeals.kind,
      status: issueAppeals.status,
      title: issueAppeals.title,
      note: issueAppeals.note,
      proposedPriority: issueAppeals.proposedPriority,
      issueId: issueAppeals.issueId,
      issueName: issues.name,
      issueSequenceId: issues.sequenceId,
      createdIssueId: issueAppeals.createdIssueId,
      requestedById: issueAppeals.requestedBy,
      requestedByName: sql<string>`coalesce(${profiles.displayName}, 'Member')`,
      requestedByAvatar: profiles.avatarUrl,
      decidedByName: decider,
      decisionNote: issueAppeals.decisionNote,
      decidedAt: issueAppeals.decidedAt,
      createdAt: issueAppeals.createdAt,
    })
    .from(issueAppeals)
    .leftJoin(profiles, eq(profiles.id, issueAppeals.requestedBy))
    .leftJoin(issues, eq(issues.id, issueAppeals.issueId))
    .where(eq(issueAppeals.projectId, projectId))
    .orderBy(
      // Pending first, because this page exists to be cleared.
      sql`case when ${issueAppeals.status} = 'pending' then 0 else 1 end`,
      desc(issueAppeals.createdAt),
    )
    .limit(APPEAL_LIMIT);
}

/** How many decisions are waiting, for the badge on the sidebar entry. */
export async function countPendingAppeals(projectId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(issueAppeals)
    .where(
      and(
        eq(issueAppeals.projectId, projectId),
        eq(issueAppeals.status, "pending"),
      ),
    );
  return Number(row?.n ?? 0);
}
