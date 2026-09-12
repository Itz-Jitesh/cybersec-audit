import { notFound } from "next/navigation";

import { AppealsList } from "@/components/appeals/appeals-list";
import { getProjectAppeals } from "@/db/queries/appeals";
import { getProject } from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface AppealsPageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * The project's request queue.
 *
 * Readable by everyone on the project — a member needs to see what happened to
 * their own request — and decidable only by a team lead or a workspace admin.
 */
export default async function AppealsPage({ params }: AppealsPageProps) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await getProject(projectId);
  if (!project) notFound();

  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) {
    return (
      <div className="mx-auto max-w-[720px] px-6 pt-8">
        <h1 className="text-lg font-medium text-text-100">
          You do not have access to this project
        </h1>
        <p className="mt-1 text-sm text-text-300">
          {project.name} belongs to {project.teamName}. Ask the team lead or a
          workspace admin to add you.
        </p>
      </div>
    );
  }

  const [appeals, canDecide] = await Promise.all([
    getProjectAppeals(projectId),
    assertCan(user, { kind: "appeal.decide", projectId }),
  ]);

  const pending = appeals.filter(
    (appeal) => appeal.status === "pending",
  ).length;

  return (
    <div className="mx-auto max-w-[880px] px-2 pt-4 pb-10">
      <header className="px-4">
        <h1 className="text-lg font-medium text-text-100">Requests</h1>
        <p className="mt-0.5 text-sm text-text-300">
          {canDecide.ok
            ? "Issues waiting to be opened, and work waiting to be inspected."
            : "What you have asked for, and what the team lead decided."}{" "}
          {pending > 0 && (
            <span className="text-text-200">{pending} pending.</span>
          )}
        </p>
      </header>

      <div className="mt-3 overflow-hidden rounded-md border border-border-subtle">
        <AppealsList
          appeals={appeals}
          projectId={projectId}
          currentUserId={user.id}
          canDecide={canDecide.ok}
        />
      </div>
    </div>
  );
}
