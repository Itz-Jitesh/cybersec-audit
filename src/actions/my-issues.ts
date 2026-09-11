"use server";

import { type ActionResult, guarded, invalid, ok } from "@/actions/result";
import { getMyIssues, type MyIssueRow } from "@/db/queries/my-issues";
import { readsWholeWorkspace } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { myIssueFilterSchema } from "@/lib/validators/my-issues";

/**
 * Refetch for the assigned view.
 *
 * No assertCan: there is no single project to assert against, and the only
 * rows this can return are ones assigned to the caller inside a project they
 * still belong to — a rule the query enforces itself. Signed out returns an
 * empty list rather than an error, because the middleware has already
 * redirected anyone who is, and a thrown error here would only surface as a
 * broken panel during a session expiry.
 */
export async function listMyIssues(
  input: unknown,
): Promise<ActionResult<MyIssueRow[]>> {
  return guarded("listMyIssues", async () => {
    const parsed = myIssueFilterSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) return ok([]);

    return ok(
      await getMyIssues(
        user.id,
        readsWholeWorkspace(user.role),
        parsed.data,
      ),
    );
  });
}
