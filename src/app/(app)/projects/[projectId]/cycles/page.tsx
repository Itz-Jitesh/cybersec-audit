import { RefreshCw } from "lucide-react";
import Link from "next/link";

import { CreateCycleDialog } from "@/components/cycles/create-cycle-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { getProjectCycles } from "@/db/queries/cycles";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();
  await assertCan(user, { kind: "project.read", projectId });
  const { active, upcoming, completed } = await getProjectCycles(projectId);
  const total = active.length + upcoming.length + completed.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-medium text-text-100">Cycles</h1>
          <p className="mt-0.5 text-xs text-text-400">
            Time-boxed batches of work with a burndown.
          </p>
        </div>
        <CreateCycleDialog projectId={projectId} />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No cycles yet"
          description="Create a cycle to start time-boxing work."
        />
      ) : (
        (
          [
            ["Active", active],
            ["Upcoming", upcoming],
            ["Completed", completed],
          ] as const
        ).map(([label, rows]) =>
          rows.length > 0 ? (
            <section key={label} className="mt-6">
              <h2 className="text-2xs font-medium uppercase tracking-wide text-text-400">
                {label}
              </h2>
              <ul className="mt-2 overflow-hidden rounded-md border border-border-subtle">
                {rows.map((cycle) => (
                  <li key={cycle.id}>
                    <Link
                      href={`/projects/${projectId}/cycles/${cycle.id}`}
                      className="flex h-11 items-center gap-3 px-3 transition-colors duration-[120ms] ease-out hover:bg-bg-80/50"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-text-100">
                        {cycle.name}
                      </span>
                      <span className="text-2xs text-text-400">
                        {cycle.startDate} → {cycle.endDate}
                      </span>
                      <span className="rounded-full bg-bg-80 px-1.5 text-2xs text-text-300">
                        {cycle.completed}/{cycle.total}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}
