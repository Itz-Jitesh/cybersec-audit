import Link from "next/link";
import { notFound } from "next/navigation";

import { ModuleActions } from "@/components/modules/module-actions";
import { ModuleIssuePanel } from "@/components/modules/module-issue-panel";
import { ModuleStatusChip } from "@/components/modules/module-status-chip";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { ProgressRing } from "@/components/shared/progress-ring";
import { getIssuesForProject } from "@/db/queries/issues";
import { getModule } from "@/db/queries/modules";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; moduleId: string }>;
}) {
  const { moduleId } = await params;
  const user = await requireUser();

  const row = await getModule(moduleId);
  if (!row) notFound();

  // The projectId comes from the module row, not the URL segment, so a mismatched
  // segment cannot be used to borrow another project's permissions.
  const projectId = row.projectId;

  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) notFound();

  const [issues, manageable, writable] = await Promise.all([
    getIssuesForProject({
      projectId,
      moduleIds: [moduleId],
      limit: 200,
      offset: 0,
      groupBy: "state",
      orderBy: "sort_order",
      sortDirection: "asc",
    }),
    assertCan(user, { kind: "module.manage", projectId }),
    assertCan(user, { kind: "issue.write", projectId }),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <p className="text-2xs tracking-wide text-text-400 uppercase">
        <Link
          href={`/projects/${projectId}/modules`}
          className="hover:text-text-200"
        >
          Modules
        </Link>
      </p>

      <div className="mt-1 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-medium text-text-100">
              {row.name}
            </h1>
            <ModuleStatusChip status={row.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-text-400">
            {row.startDate ?? "No start date"} → {row.targetDate ?? "no target"}
            {row.leadId && (
              <>
                <span aria-hidden>·</span>
                <MemberAvatar
                  user={{
                    id: row.leadId,
                    displayName: row.leadName ?? "",
                    avatarUrl: row.leadAvatarUrl,
                  }}
                  size={16}
                />
                {row.leadName}
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <ProgressRing
            value={row.completed}
            total={row.total}
            size={32}
            showLabel
          />
          <ModuleActions
            moduleId={moduleId}
            projectId={projectId}
            status={row.status}
            canManage={manageable.ok}
          />
        </div>
      </div>

      {row.description && (
        <p className="mt-4 rounded-md border border-border-subtle p-3 text-xs leading-relaxed text-text-200">
          {row.description}
        </p>
      )}

      <ModuleIssuePanel
        moduleId={moduleId}
        projectId={projectId}
        issues={issues}
        canWrite={writable.ok}
      />
    </div>
  );
}
