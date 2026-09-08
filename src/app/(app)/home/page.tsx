import { format, formatDistanceToNowStrict } from "date-fns";
import { CircleDot } from "lucide-react";
import Link from "next/link";

import { DateChip } from "@/components/shared/date-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { ProgressRing } from "@/components/shared/progress-ring";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import { Button } from "@/components/ui/button";
import {
  getActiveCycles,
  getHomeStats,
  getMyOpenIssues,
} from "@/db/queries/home";
import { requireUser } from "@/lib/auth/session";

function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-90 px-4 py-3">
      <p className="text-2xs font-medium tracking-wide text-text-400 uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "danger" && value > 0 ? "text-danger" : "text-text-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-90">
      <h2 className="border-b border-border-subtle px-4 py-2.5 text-sm font-medium text-text-200">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const user = await requireUser();
  const now = new Date();

  const [stats, myIssues, activeCycles] = await Promise.all([
    getHomeStats(user.id),
    getMyOpenIssues(user.id),
    getActiveCycles(),
  ]);

  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-4 pb-10">
      <header>
        <h1 className="text-xl font-semibold text-text-100">
          {greeting(now)}, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-text-300">
          {format(now, "EEEE, MMMM d")}
        </p>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Assigned to me" value={stats.assigned} />
        <StatCard label="In progress" value={stats.inProgress} />
        <StatCard label="Overdue" value={stats.overdue} tone="danger" />
        <StatCard label="Completed this week" value={stats.completedThisWeek} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Panel title="Your issues">
          {myIssues.length === 0 ? (
            <EmptyState
              icon={CircleDot}
              title="Nothing assigned yet"
              description="Issues assigned to you across every project will collect here."
              action={
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/my-issues">Browse issues</Link>
                </Button>
              }
            />
          ) : (
            <ul>
              {myIssues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/projects/${issue.projectId}/issues/${issue.id}`}
                    className="flex h-row items-center gap-2.5 px-4 transition-colors duration-[120ms] ease-out hover:bg-bg-80"
                  >
                    <PriorityIcon
                      priority={issue.priority as IssuePriority}
                      size={14}
                    />
                    <StateIcon
                      group={issue.stateGroup as StateGroup}
                      color={issue.stateColor}
                    />
                    <IssueIdBadge
                      identifier={issue.identifier}
                      sequenceId={issue.sequenceId}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-text-100">
                      {issue.name}
                    </span>
                    {issue.targetDate && <DateChip date={issue.targetDate} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Active cycles">
            {activeCycles.length === 0 ? (
              <p className="px-4 py-4 text-xs text-text-300">
                No cycle is running right now.
              </p>
            ) : (
              <ul className="p-2">
                {activeCycles.map((cycle) => (
                  <li key={cycle.id}>
                    <Link
                      href={`/projects/${cycle.projectId}/cycles/${cycle.id}`}
                      className="flex items-center gap-3 rounded-sm px-2 py-2 transition-colors duration-[120ms] ease-out hover:bg-bg-80"
                    >
                      <ProgressRing
                        value={cycle.completed}
                        total={cycle.total}
                        size={32}
                        showLabel
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-100">
                          {cycle.name}
                        </span>
                        <span className="block truncate text-xs text-text-400">
                          {cycle.projectName} · ends in{" "}
                          {formatDistanceToNowStrict(new Date(cycle.endDate))}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity">
            <p className="px-4 py-4 text-xs text-text-300">
              Activity appears here once issues start moving. The feed is built
              in phase 8, alongside the issue lifecycle that writes it.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
