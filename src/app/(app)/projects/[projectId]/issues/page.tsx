import { notFound } from "next/navigation";

import { IssuesClient } from "@/app/(app)/projects/[projectId]/issues/issues-client";
import type { StateGroup } from "@/components/shared/state-icon";
import {
  getIssuesForProject,
  getLabelOptions,
  getProjectCycles,
  getProjectModules,
} from "@/db/queries/issues";
import {
  getProject,
  getProjectMembers,
  getProjectStates,
} from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface IssuesPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function IssuesPage({ params }: IssuesPageProps) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await getProject(projectId);
  if (!project) notFound();

  // Reads through Drizzle bypass RLS, so access is decided here.
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

  const [
    issues,
    states,
    members,
    labels,
    cycles,
    modules,
    canDelete,
    canManage,
    canWrite,
    canCreateDirect,
  ] = await Promise.all([
    getIssuesForProject({
      projectId,
      limit: 200,
      offset: 0,
      groupBy: "state",
      orderBy: "sort_order",
      sortDirection: "asc",
    }),
    getProjectStates(projectId),
    getProjectMembers(projectId),
    getLabelOptions(projectId),
    getProjectCycles(projectId),
    getProjectModules(projectId),
    assertCan(user, { kind: "issue.delete", projectId }),
    assertCan(user, { kind: "project.manage", projectId }),
    assertCan(user, { kind: "issue.write", projectId }),
    assertCan(user, { kind: "issue.create", projectId }),
  ]);

  return (
    <div className="flex h-full flex-col">
      <IssuesClient
        projectId={projectId}
        initialIssues={issues}
        states={states.map((state) => ({
          id: state.id,
          name: state.name,
          group: state.group as StateGroup,
          color: state.color,
        }))}
        members={members}
        labels={labels}
        cycles={cycles}
        modules={modules}
        canDelete={canDelete.ok}
        canModerate={canManage.ok}
        canWrite={canWrite.ok}
        canCreateDirect={canCreateDirect.ok}
        currentUserId={user.id}
      />
    </div>
  );
}
