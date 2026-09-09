import { notFound } from "next/navigation";

import {
  AssigneeLoadChart,
  OpenClosedTrend,
  StateDistribution,
} from "@/components/analytics/project-charts";
import {
  getAssigneeLoad,
  getOpenClosedTrend,
  getProjectTotals,
  getStateDistribution,
} from "@/db/queries/analytics";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <p
        className={`text-lg font-medium ${tone === "warning" && value > 0 ? "text-warning" : "text-text-100"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-2xs text-text-400">{label}</p>
    </div>
  );
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) notFound();

  const [totals, trend, distribution, load] = await Promise.all([
    getProjectTotals(projectId),
    getOpenClosedTrend(projectId),
    getStateDistribution(projectId),
    getAssigneeLoad(projectId),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="text-sm font-medium text-text-100">Analytics</h1>
      <p className="mt-0.5 text-xs text-text-400">
        Live counts over this project&rsquo;s unarchived issues.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={totals.total} />
        <Stat label="Open" value={totals.open} />
        <Stat label="Completed" value={totals.completed} />
        <Stat label="Overdue" value={totals.overdue} tone="warning" />
        <Stat label="Unassigned" value={totals.unassigned} />
      </div>

      <div className="mt-4 grid gap-3">
        <OpenClosedTrend points={trend} />
        <div className="grid gap-3 md:grid-cols-2">
          <StateDistribution slices={distribution} />
          <AssigneeLoadChart rows={load} />
        </div>
      </div>
    </div>
  );
}
