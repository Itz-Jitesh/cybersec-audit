import { MyIssuesView } from "@/components/my-issues/my-issues-view";
import { getMyIssueProjects, getMyIssues } from "@/db/queries/my-issues";
import { isWorkspaceAdmin } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { DEFAULT_MY_ISSUE_FILTERS } from "@/lib/validators/my-issues";

/**
 * `/my-issues` — everything assigned to this person, across every project they
 * can still see.
 *
 * There is no assertCan here because there is no single project to assert
 * against. The visibility rule lives inside getMyIssues, which refuses rows
 * from projects the user is no longer a member of even when the assignment row
 * survives.
 */
export default async function MyIssuesPage() {
  const user = await requireUser();
  const admin = await isWorkspaceAdmin(user.id);

  const [rows, projects] = await Promise.all([
    getMyIssues(user.id, admin, DEFAULT_MY_ISSUE_FILTERS),
    getMyIssueProjects(user.id),
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center border-b border-border-subtle px-4">
        <h1 className="text-xs font-medium text-text-100">My Issues</h1>
      </div>
      <div className="min-h-0 flex-1">
        <MyIssuesView initialRows={rows} projects={projects} />
      </div>
    </div>
  );
}
