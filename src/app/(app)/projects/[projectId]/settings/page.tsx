import { notFound } from "next/navigation";

import { ProjectSettings } from "@/components/projects/project-settings";
import type { StateGroup } from "@/components/shared/state-icon";
import {
  getProject,
  getProjectLabels,
  getProjectMembers,
  getProjectStates,
} from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface SettingsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSettingsPage({
  params,
}: SettingsPageProps) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await getProject(projectId);
  if (!project) notFound();

  // Reading through Drizzle bypasses RLS, so both the read and the manage
  // checks happen here explicitly.
  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) notFound();

  const manageable = await assertCan(user, {
    kind: "project.manage",
    projectId,
  });

  if (!manageable.ok) {
    return (
      <div className="mx-auto max-w-[720px] px-6 pt-4">
        <h1 className="text-xl font-semibold text-text-100">
          Project settings
        </h1>
        <div className="mt-4 rounded-lg border border-border-subtle px-4 py-4">
          <p className="text-sm font-medium text-text-100">
            You do not have access to this project&rsquo;s settings
          </p>
          <p className="mt-1 text-xs text-text-300">
            Settings are managed by the project admins, the lead of{" "}
            {project.teamName}, or a workspace admin. Ask one of them if you
            need something changed here.
          </p>
        </div>
      </div>
    );
  }

  const [members, states, labels] = await Promise.all([
    getProjectMembers(projectId),
    getProjectStates(projectId),
    getProjectLabels(projectId),
  ]);

  const canDelete = await assertCan(user, { kind: "workspace.admin" });

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-4 pb-10">
      <h1 className="text-xl font-semibold text-text-100">
        {project.iconEmoji ? `${project.iconEmoji} ` : ""}
        {project.name}
      </h1>
      <p className="mt-0.5 text-sm text-text-300">
        {project.teamName} ·{" "}
        <span className="font-mono">{project.identifier}</span>
      </p>

      <div className="mt-5">
        <ProjectSettings
          project={project}
          members={members}
          states={states.map((state) => ({
            ...state,
            group: state.group as StateGroup,
          }))}
          labels={labels}
          canDelete={canDelete.ok}
        />
      </div>
    </div>
  );
}
