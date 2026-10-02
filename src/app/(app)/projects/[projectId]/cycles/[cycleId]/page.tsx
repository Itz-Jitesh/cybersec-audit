import { format } from "date-fns";
import {
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  Loader,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CycleActions } from "@/components/cycles/cycle-actions";
import { CycleIssuePanel } from "@/components/cycles/cycle-issue-panel";
import type { StateGroup } from "@/components/shared/state-icon";
import {
  getCycle,
  getCycleIssues,
  getCycleSnapshots,
  getIncompleteCycleIssues,
  getTransferTargets,
} from "@/db/queries/cycles";
import { assertCan, canManageProject } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface SnapshotPoint {
  date: number;
  remaining: number;
}

/** Inline-SVG burndown: actual remaining vs the straight ideal line. */
function Burndown({
  points,
  total,
}: {
  points: SnapshotPoint[];
  total: number;
}) {
  const W = 560;
  const H = 160;
  const PAD = 24;
  const last = points[points.length - 1];

  const toX = (fraction: number) => PAD + fraction * (W - PAD * 2);
  const toY = (value: number) => H - PAD - (value / total) * (H - PAD * 2);

  const actual = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${toX(point.date)},${toY(point.remaining)}`,
    )
    .join(" ");
  const ideal = `M${toX(0)},${toY(total)} L${toX(1)},${toY(0)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Burndown chart"
      className="w-full"
    >
      <line
        x1={PAD}
        y1={H - PAD}
        x2={W - PAD}
        y2={H - PAD}
        className="stroke-border-subtle"
      />
      <line
        x1={PAD}
        y1={PAD}
        x2={PAD}
        y2={H - PAD}
        className="stroke-border-subtle"
      />
      <path
        d={ideal}
        className="stroke-text-400"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        d={actual}
        className="stroke-brand"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      {last && (
        <circle
          cx={toX(last.date)}
          cy={toY(last.remaining)}
          r={2.5}
          className="fill-brand"
        />
      )}
    </svg>
  );
}

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; cycleId: string }>;
}) {
  const { cycleId } = await params;
  const user = await requireUser();
  const cycle = await getCycle(cycleId);
  if (!cycle) notFound();
  // Same as the cycle list: the check was awaited and its result thrown away,
  // which let any signed-in member open any project's burndown by id.
  const readable = await assertCan(user, {
    kind: "project.read",
    projectId: cycle.projectId,
  });
  if (!readable.ok) notFound();

  const [
    snapshots,
    incomplete,
    cycleIssues,
    transferTargets,
    canManage,
    canWrite,
  ] = await Promise.all([
    getCycleSnapshots(cycleId),
    getIncompleteCycleIssues(cycleId),
    getCycleIssues(cycleId),
    getTransferTargets(cycle.projectId, cycleId),
    canManageProject(user.id, cycle.projectId),
    // Attaching an issue to a cycle edits the issue, so it is issue.write —
    // the same bar as changing its state. Only creating or deleting the cycle
    // itself needs cycle.manage.
    assertCan(user, { kind: "issue.write", projectId: cycle.projectId }),
  ]);

  const pendingNow = cycle.total - cycle.completed;
  const points: SnapshotPoint[] = snapshots.map((snapshot, index) => ({
    date: snapshots.length === 1 ? 0 : index / (snapshots.length - 1),
    remaining: snapshot.totalIssues - snapshot.completedIssues,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xs tracking-wide text-text-400 uppercase">
            <Link
              href={`/projects/${cycle.projectId}/cycles`}
              className="hover:text-text-200"
            >
              Cycles
            </Link>
          </p>
          <h1 className="mt-0.5 text-sm font-medium text-text-100">
            {cycle.name}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-text-400">
            <CalendarRange size={13} strokeWidth={1.5} />
            {format(new Date(cycle.startDate), "d MMM yyyy")} —{" "}
            {format(new Date(cycle.endDate), "d MMM yyyy")}
            <span className="rounded-full bg-bg-80 px-1.5 text-2xs capitalize">
              {cycle.status.replace("_", " ")}
            </span>
          </p>
        </div>
        <CycleActions
          cycleId={cycleId}
          projectId={cycle.projectId}
          canManage={canManage}
          isCompleted={cycle.status === "completed"}
          incompleteCount={incomplete.length}
          transferTargets={transferTargets}
        />
      </div>

      <dl className="mt-6 grid grid-cols-4 gap-3">
        {(
          [
            ["Total", cycle.total, CircleDashed],
            ["Started", cycle.started, Loader],
            ["Completed", cycle.completed, CheckCircle2],
            ["Pending", pendingNow, CircleDashed],
          ] as const
        ).map(([label, value, Icon]) => (
          <div
            key={label}
            className="rounded-md border border-border-subtle px-3 py-2.5"
          >
            <dt className="flex items-center gap-1.5 text-2xs text-text-400">
              <Icon size={12} strokeWidth={1.5} />
              {label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-text-100">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-6">
        <h2 className="text-2xs font-medium tracking-wide text-text-400 uppercase">
          Burndown
        </h2>
        <div className="mt-2 rounded-md border border-border-subtle p-4">
          {snapshots.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-400">
              Snapshots appear once the cycle has started.
            </p>
          ) : (
            <Burndown points={points} total={cycle.total} />
          )}
        </div>
      </section>

      <div className="pb-12">
        <CycleIssuePanel
          cycleId={cycleId}
          projectId={cycle.projectId}
          issues={cycleIssues.map((issue) => ({
            ...issue,
            stateGroup: issue.stateGroup as StateGroup,
          }))}
          canWrite={canWrite.ok}
        />
      </div>
    </div>
  );
}
