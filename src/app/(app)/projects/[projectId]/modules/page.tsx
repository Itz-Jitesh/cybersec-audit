import { Layers } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CreateModuleDialog } from "@/components/modules/create-module-dialog";
import { ModuleStatusChip } from "@/components/modules/module-status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { ProgressRing } from "@/components/shared/progress-ring";
import { getProjectModules } from "@/db/queries/modules";
import { getProjectMembers } from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) notFound();

  const [rows, members, manageable] = await Promise.all([
    getProjectModules(projectId),
    getProjectMembers(projectId),
    assertCan(user, { kind: "module.manage", projectId }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-medium text-text-100">Modules</h1>
          <p className="mt-0.5 text-xs text-text-400">
            Grouped work that spans cycles.
          </p>
        </div>
        {manageable.ok && (
          <CreateModuleDialog projectId={projectId} members={members} />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No modules yet"
          description="Create a module to group work that outlives a single cycle."
        />
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/projects/${projectId}/modules/${row.id}`}
                className="flex h-full flex-col gap-3 rounded-md border border-border-subtle p-3 transition-colors duration-[120ms] ease-out hover:bg-bg-80/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-100">
                    {row.name}
                  </span>
                  <ModuleStatusChip status={row.status} />
                </div>

                {row.description && (
                  <p className="line-clamp-2 text-2xs text-text-400">
                    {row.description}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-2">
                  <ProgressRing value={row.completed} total={row.total} size={20} />
                  <span className="text-2xs text-text-300">
                    {row.completed}/{row.total}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    {row.targetDate && (
                      <span className="text-2xs text-text-400">
                        {row.targetDate}
                      </span>
                    )}
                    {row.leadId && (
                      <MemberAvatar
                        user={{
                          id: row.leadId,
                          displayName: row.leadName ?? "",
                          avatarUrl: row.leadAvatarUrl,
                        }}
                        size={16}
                      />
                    )}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
