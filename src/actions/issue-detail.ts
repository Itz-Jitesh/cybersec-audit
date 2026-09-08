"use server";

import { eq } from "drizzle-orm";

import {
  type ActionResult,
  denied,
  fail,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import type { IssueDetailBundle } from "@/components/issues/issue-detail";
import { db } from "@/db";
import {
  getIssueActivity,
  getIssueAttachments,
  getIssueComments,
  getIssueDetail,
  getIssueLinks,
  getSubIssues,
} from "@/db/queries/issues";
import { issues } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { issueIdSchema } from "@/lib/validators/issue";

/**
 * Everything the detail view needs, in one call.
 *
 * It exists as an action rather than a page-level read because the peek overlay
 * opens over a list without navigating, so there is no server render to hang
 * the query off. The permission check is the same one the page does — the
 * overlay is not a way around it.
 */
export async function loadIssueDetail(
  input: unknown,
): Promise<ActionResult<IssueDetailBundle>> {
  return guarded("loadIssueDetail", async () => {
    const parsed = issueIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const [row] = await db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, parsed.data.issueId))
      .limit(1);

    if (!row) return fail("That issue no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: row.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const issue = await getIssueDetail(parsed.data.issueId, user.id);
    if (!issue) return fail("That issue no longer exists.", "NOT_FOUND");

    const [subIssues, links, attachments, comments, activity] =
      await Promise.all([
        getSubIssues(parsed.data.issueId),
        getIssueLinks(parsed.data.issueId),
        getIssueAttachments(parsed.data.issueId),
        getIssueComments(parsed.data.issueId),
        getIssueActivity(parsed.data.issueId),
      ]);

    return ok({ issue, subIssues, links, attachments, comments, activity });
  });
}
