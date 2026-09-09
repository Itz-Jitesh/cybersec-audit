import { notFound } from "next/navigation";

import { ViewsList } from "@/components/views/views-list";
import { getProject } from "@/db/queries/project";
import { getProjectViews } from "@/db/queries/views";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface ViewsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ViewsPage({ params }: ViewsPageProps) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await getProject(projectId);
  if (!project) notFound();

  // Reads through Drizzle bypass RLS, so access is decided here. The list query
  // then applies the per-row rule: public views, plus this user's private ones.
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

  const views = await getProjectViews(projectId, user.id);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <span className="text-xs text-text-300">
          {views.length} {views.length === 1 ? "view" : "views"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ViewsList
          projectId={projectId}
          views={views}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
