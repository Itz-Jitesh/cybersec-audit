"use server";

import {
  type ActionResult,
  denied,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import { getIssuesForProject, type IssueListItem } from "@/db/queries/issues";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { issueFilterSchema } from "@/lib/validators/issue";

/**
 * The refetch the client uses after a mutation settles. It repeats the same
 * permission check the page did rather than trusting that the client only got
 * here by rendering the page.
 */
export async function listIssues(
  input: unknown,
): Promise<ActionResult<IssueListItem[]>> {
  return guarded("listIssues", async () => {
    const parsed = issueFilterSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);

    return ok(await getIssuesForProject(parsed.data));
  });
}
