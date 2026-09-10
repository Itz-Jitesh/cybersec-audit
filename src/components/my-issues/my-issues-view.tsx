"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleDot } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { listMyIssues } from "@/actions/my-issues";
import { EmptyState } from "@/components/shared/empty-state";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { LabelChip } from "@/components/shared/label-chip";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MyIssueRow } from "@/db/queries/my-issues";
import { cn } from "@/lib/utils";
import {
  DEFAULT_MY_ISSUE_FILTERS,
  type MyIssueFilters,
  type MyIssueGroupBy,
} from "@/lib/validators/my-issues";

const STATE_GROUPS: { value: StateGroup; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Todo" },
  { value: "started", label: "In progress" },
  { value: "completed", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

const GROUP_BY: { value: MyIssueGroupBy; label: string }[] = [
  { value: "state_group", label: "State" },
  { value: "priority", label: "Priority" },
  { value: "project", label: "Project" },
];

const ORDER_BY: { value: MyIssueFilters["orderBy"]; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "target_date", label: "Due date" },
  { value: "updated_at", label: "Updated" },
  { value: "created_at", label: "Created" },
];

interface Group {
  id: string;
  label: string;
  rows: MyIssueRow[];
}

/**
 * Group the rows in hand rather than asking the server to.
 *
 * The three groupings are all derived from fields already on every row, so a
 * regroup is a re-sort of an array the client is holding — sending it back to
 * Postgres would mean a round trip to rearrange data that never changed.
 */
function buildGroups(rows: MyIssueRow[], groupBy: MyIssueGroupBy): Group[] {
  if (groupBy === "priority") {
    return PRIORITIES.map((priority) => ({
      id: priority,
      label: priority === "none" ? "No priority" : priority,
      rows: rows.filter((row) => row.priority === priority),
    })).filter((group) => group.rows.length > 0);
  }

  if (groupBy === "project") {
    const seen = new Map<string, Group>();
    for (const row of rows) {
      const group = seen.get(row.projectId) ?? {
        id: row.projectId,
        label: row.projectName,
        rows: [],
      };
      group.rows.push(row);
      seen.set(row.projectId, group);
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }

  return STATE_GROUPS.map((group) => ({
    id: group.value,
    label: group.label,
    rows: rows.filter((row) => row.stateGroup === group.value),
  })).filter((group) => group.rows.length > 0);
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-2xs transition-colors duration-[120ms] ease-out",
        active
          ? "border-brand bg-brand-subtle text-brand"
          : "border-border-subtle text-text-400 hover:text-text-200",
      )}
    >
      {children}
    </button>
  );
}

/**
 * `/my-issues`: every issue assigned to this person, across every project they
 * can still see (docs/06-UX-LAYOUT-SPEC.md §6).
 *
 * Inline editing is deliberately absent, unlike the project view. A state
 * dropdown needs that project's state list, and this list spans projects whose
 * state ladders differ — offering one would either show the wrong options or
 * quietly move an issue to a state from somewhere else. Rows link to the issue
 * instead, where the whole context is present.
 */
export function MyIssuesView({
  initialRows,
  projects,
}: {
  initialRows: MyIssueRow[];
  projects: { id: string; name: string; identifier: string }[];
}) {
  const [filters, setFilters] = useState<MyIssueFilters>(
    DEFAULT_MY_ISSUE_FILTERS,
  );

  const isDefault = useMemo(
    () =>
      JSON.stringify({ ...filters, groupBy: null, orderBy: null }) ===
      JSON.stringify({
        ...DEFAULT_MY_ISSUE_FILTERS,
        groupBy: null,
        orderBy: null,
      }),
    [filters],
  );

  const { data: rows = initialRows } = useQuery({
    queryKey: ["my-issues", filters],
    queryFn: async () => {
      const result = await listMyIssues(filters);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    // The server already delivered exactly the default set. Seeding a filtered
    // key with it would show the wrong rows and count as fresh, so the fetch
    // would never run.
    initialData: isDefault ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const groups = useMemo(
    () => buildGroups(rows, filters.groupBy),
    [rows, filters.groupBy],
  );

  const patch = (next: Partial<MyIssueFilters>) =>
    setFilters((current) => ({ ...current, ...next }));

  const toggle = <T,>(list: T[] | undefined, value: T): T[] | undefined => {
    const set = new Set(list ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return set.size === 0 ? undefined : [...set];
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2">
        <Input
          value={filters.search ?? ""}
          placeholder="Search your issues…"
          onChange={(event) =>
            patch({ search: event.target.value || undefined })
          }
          className="h-7 w-48 text-xs"
        />

        <Popover>
          <PopoverTrigger className="h-7 rounded-md px-2 text-xs text-text-300 hover:bg-bg-80 hover:text-text-100">
            State
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-52 p-2">
            <div className="flex flex-wrap gap-1">
              {STATE_GROUPS.map((group) => (
                <Chip
                  key={group.value}
                  active={Boolean(filters.stateGroups?.includes(group.value))}
                  onClick={() =>
                    patch({
                      stateGroups: toggle(filters.stateGroups, group.value),
                    })
                  }
                >
                  {group.label}
                </Chip>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="h-7 rounded-md px-2 text-xs text-text-300 hover:bg-bg-80 hover:text-text-100">
            Priority
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-52 p-2">
            <div className="flex flex-wrap gap-1">
              {PRIORITIES.map((priority) => (
                <Chip
                  key={priority}
                  active={Boolean(filters.priorities?.includes(priority))}
                  onClick={() =>
                    patch({ priorities: toggle(filters.priorities, priority) })
                  }
                >
                  <span className="capitalize">{priority}</span>
                </Chip>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {projects.length > 1 && (
          <Popover>
            <PopoverTrigger className="h-7 rounded-md px-2 text-xs text-text-300 hover:bg-bg-80 hover:text-text-100">
              Project
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-60 p-2">
              <div className="flex flex-wrap gap-1">
                {projects.map((project) => (
                  <Chip
                    key={project.id}
                    active={Boolean(filters.projectIds?.includes(project.id))}
                    onClick={() =>
                      patch({
                        projectIds: toggle(filters.projectIds, project.id),
                      })
                    }
                  >
                    {project.name}
                  </Chip>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        <Popover>
          <PopoverTrigger className="h-7 rounded-md px-2 text-xs text-text-300 hover:bg-bg-80 hover:text-text-100">
            Display
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-56 p-2">
            <p className="px-1 pb-1 text-2xs text-text-400 uppercase">
              Group by
            </p>
            <div className="flex flex-wrap gap-1">
              {GROUP_BY.map((option) => (
                <Chip
                  key={option.value}
                  active={filters.groupBy === option.value}
                  onClick={() => patch({ groupBy: option.value })}
                >
                  {option.label}
                </Chip>
              ))}
            </div>

            <p className="px-1 pt-3 pb-1 text-2xs text-text-400 uppercase">
              Order by
            </p>
            <div className="flex flex-wrap gap-1">
              {ORDER_BY.map((option) => (
                <Chip
                  key={option.value}
                  active={filters.orderBy === option.value}
                  onClick={() => patch({ orderBy: option.value })}
                >
                  {option.label}
                </Chip>
              ))}
            </div>

            <button
              type="button"
              onClick={() => patch({ includeClosed: !filters.includeClosed })}
              className="mt-3 flex w-full items-center justify-between rounded-md px-1.5 py-1 text-xs text-text-300 hover:bg-bg-80 hover:text-text-100"
            >
              Completed and cancelled
              <span
                className={
                  filters.includeClosed ? "text-brand" : "text-text-400"
                }
              >
                {filters.includeClosed ? "Shown" : "Hidden"}
              </span>
            </button>
          </PopoverContent>
        </Popover>

        <span className="ml-auto text-2xs text-text-400">
          {rows.length} {rows.length === 1 ? "issue" : "issues"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <EmptyState
            icon={CircleDot}
            title="Nothing assigned to you"
            description={
              filters.includeClosed
                ? "No issues match those filters."
                : "Work assigned to you shows up here. Completed issues are hidden — turn them on under Display."
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.id}>
              <header className="flex h-9 items-center gap-2 border-b border-border-subtle bg-bg-90/60 px-4">
                <span className="text-xs font-medium text-text-200 capitalize">
                  {group.label}
                </span>
                <span className="rounded-full bg-bg-80 px-1.5 text-2xs text-text-300">
                  {group.rows.length}
                </span>
              </header>

              {group.rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/projects/${row.projectId}/issues/${row.id}`}
                  className="flex h-row items-center gap-2 border-b border-border-subtle px-4 transition-colors duration-[120ms] ease-out hover:bg-bg-80/50"
                >
                  <PriorityIcon
                    priority={row.priority as IssuePriority}
                    size={14}
                  />
                  <StateIcon
                    group={row.stateGroup as StateGroup}
                    color={row.stateColor}
                    size={14}
                  />
                  <IssueIdBadge
                    identifier={row.projectIdentifier}
                    sequenceId={row.sequenceId}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-text-100">
                    {row.name}
                  </span>

                  {row.labels.slice(0, 2).map((label) => (
                    <LabelChip key={label.id} label={label} />
                  ))}

                  {row.targetDate && (
                    <span className="shrink-0 text-2xs text-text-400">
                      {row.targetDate}
                    </span>
                  )}

                  {/* The one thing this view has that the project view does
                      not need: which project the row came from. */}
                  {filters.groupBy !== "project" && (
                    <span className="flex shrink-0 items-center gap-1 text-2xs text-text-400">
                      {row.projectIconEmoji ?? ""}
                      {row.projectName}
                      <ChevronRight size={11} strokeWidth={1.5} />
                    </span>
                  )}
                </Link>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
