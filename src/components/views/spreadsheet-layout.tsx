"use client";

import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { memo } from "react";

import type { IssueRowHandlers } from "@/components/issues/issue-list-row";
import {
  AssigneeDropdown,
  LabelDropdown,
  PriorityDropdown,
  StateDropdown,
  type StateOption,
} from "@/components/issues/issue-row-dropdowns";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { LabelChip } from "@/components/shared/label-chip";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { cn } from "@/lib/utils";
import type { IssueFilters } from "@/lib/validators/issue";
import type { DisplayProperties } from "@/lib/validators/view";

/** docs/06-UX-LAYOUT-SPEC.md §7.5: 36px rows. */
const ROW_HEIGHT = 36;

type OrderBy = IssueFilters["orderBy"];

interface Column {
  key: string;
  label: string;
  width: string;
  /** Absent when the column has no column to sort on. */
  orderBy?: OrderBy;
  /** The display property that hides it, when one applies. */
  property?: keyof DisplayProperties;
}

const COLUMNS: Column[] = [
  {
    key: "state",
    label: "State",
    width: "w-36",
    orderBy: "state",
    property: "state",
  },
  {
    key: "priority",
    label: "Priority",
    width: "w-28",
    orderBy: "priority",
    property: "priority",
  },
  { key: "assignees", label: "Assignees", width: "w-32", property: "assignee" },
  { key: "labels", label: "Labels", width: "w-40", property: "labels" },
  { key: "startDate", label: "Start date", width: "w-28" },
  {
    key: "targetDate",
    label: "Target date",
    width: "w-28",
    orderBy: "target_date",
    property: "dueDate",
  },
  { key: "estimate", label: "Estimate", width: "w-20", property: "estimate" },
  { key: "cycle", label: "Cycle", width: "w-32" },
  {
    key: "subIssues",
    label: "Sub-issues",
    width: "w-24",
    property: "subIssueCount",
  },
  { key: "createdAt", label: "Created", width: "w-28", orderBy: "created_at" },
];

interface SpreadsheetLayoutProps {
  issues: IssueListItem[];
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  properties: DisplayProperties;
  orderBy: OrderBy;
  sortDirection: "asc" | "desc";
  onSort: (orderBy: OrderBy) => void;
  handlers: IssueRowHandlers;
}

function Cell({
  column,
  children,
}: {
  column: Column;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-1 px-2 text-xs text-text-200",
        column.width,
      )}
    >
      {children}
    </div>
  );
}

function Row({
  issue,
  states,
  members,
  labels,
  columns,
  handlers,
}: {
  issue: IssueListItem;
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  columns: Column[];
  handlers: IssueRowHandlers;
}) {
  return (
    <div className="flex h-9 border-b border-border-subtle hover:bg-bg-90">
      {/* Sticky identity column. The only vertical border in the table sits on
          its right edge, which is what tells the eye it is pinned. */}
      <button
        type="button"
        onClick={() => handlers.onOpen(issue.id)}
        className="sticky left-0 z-10 flex h-9 w-80 shrink-0 items-center gap-2 border-r border-border-subtle bg-bg-100 px-3 text-left hover:bg-bg-90"
      >
        <IssueIdBadge
          identifier={issue.identifier}
          sequenceId={issue.sequenceId}
        />
        <span className="min-w-0 flex-1 truncate text-xs text-text-100">
          {issue.name}
        </span>
      </button>

      {columns.map((column) => {
        if (column.key === "state") {
          return (
            <Cell key={column.key} column={column}>
              <StateDropdown
                states={states}
                value={issue.stateId}
                onSelect={(stateId) => handlers.onSetState(issue.id, stateId)}
              >
                <button
                  type="button"
                  className="flex h-6 items-center gap-1.5 rounded-md px-1 hover:bg-bg-70"
                >
                  <StateIcon
                    group={issue.stateGroup as StateGroup}
                    color={issue.stateColor}
                    size={12}
                  />
                  <span className="truncate">{issue.stateName}</span>
                </button>
              </StateDropdown>
            </Cell>
          );
        }

        if (column.key === "priority") {
          return (
            <Cell key={column.key} column={column}>
              <PriorityDropdown
                value={issue.priority as IssuePriority}
                onSelect={(priority) =>
                  handlers.onSetPriority(issue.id, priority)
                }
              >
                <button
                  type="button"
                  className="flex h-6 items-center gap-1.5 rounded-md px-1 capitalize hover:bg-bg-70"
                >
                  <PriorityIcon
                    priority={issue.priority as IssuePriority}
                    size={14}
                  />
                  {issue.priority}
                </button>
              </PriorityDropdown>
            </Cell>
          );
        }

        if (column.key === "assignees") {
          return (
            <Cell key={column.key} column={column}>
              <AssigneeDropdown
                members={members}
                selected={issue.assignees.map((assignee) => assignee.id)}
                onToggle={(userId) =>
                  handlers.onToggleAssignee(issue.id, userId)
                }
              >
                <button
                  type="button"
                  className="flex h-6 items-center rounded-md px-1 hover:bg-bg-70"
                >
                  {issue.assignees.length > 0 ? (
                    <AvatarGroup users={issue.assignees} max={3} size={16} />
                  ) : (
                    <span className="text-text-400">—</span>
                  )}
                </button>
              </AssigneeDropdown>
            </Cell>
          );
        }

        if (column.key === "labels") {
          return (
            <Cell key={column.key} column={column}>
              <LabelDropdown
                labels={labels}
                selected={issue.labels.map((label) => label.id)}
                onToggle={(labelId) =>
                  handlers.onToggleLabel(issue.id, labelId)
                }
              >
                <button
                  type="button"
                  className="flex h-6 min-w-0 items-center gap-1 rounded-md px-1 hover:bg-bg-70"
                >
                  {issue.labels.length > 0 ? (
                    <>
                      {issue.labels.slice(0, 2).map((label) => (
                        <LabelChip key={label.id} label={label} />
                      ))}
                      {issue.labels.length > 2 && (
                        <span className="text-text-400">
                          +{issue.labels.length - 2}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-text-400">—</span>
                  )}
                </button>
              </LabelDropdown>
            </Cell>
          );
        }

        const text =
          column.key === "startDate"
            ? issue.startDate
            : column.key === "targetDate"
              ? issue.targetDate
              : column.key === "estimate"
                ? issue.estimatePoint?.toString()
                : column.key === "cycle"
                  ? issue.cycleName
                  : column.key === "subIssues"
                    ? issue.subIssueCount > 0
                      ? `${issue.completedSubIssueCount}/${issue.subIssueCount}`
                      : null
                    : format(issue.createdAt, "d MMM yyyy");

        return (
          <Cell key={column.key} column={column}>
            <span className="truncate">
              {text ?? <span className="text-text-400">—</span>}
            </span>
          </Cell>
        );
      })}
    </div>
  );
}

const MemoRow = memo(Row);

/**
 * The dense layout: one row per issue, every cell editable in place through the
 * same dropdowns the list row uses, so an edit made here and an edit made there
 * go through one code path.
 *
 * Virtualised above a hundred rows. The row height is fixed by the spec, which
 * is what makes windowing arithmetic rather than measurement.
 */
export function SpreadsheetLayout({
  issues,
  states,
  members,
  labels,
  properties,
  orderBy,
  sortDirection,
  onSort,
  handlers,
}: SpreadsheetLayoutProps) {
  const columns = COLUMNS.filter(
    (column) => !column.property || properties[column.property],
  );

  const { scrollRef, start, end, paddingTop, paddingBottom } = useVirtualRows({
    count: issues.length,
    rowHeight: ROW_HEIGHT,
  });

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
      <div className="min-w-max">
        <div className="sticky top-0 z-20 flex h-9 border-b border-border-subtle bg-bg-100">
          <span className="sticky left-0 z-10 flex h-9 w-80 shrink-0 items-center border-r border-border-subtle bg-bg-100 px-3 text-xs font-medium text-text-300">
            Issue
          </span>

          {columns.map((column) => (
            <button
              key={column.key}
              type="button"
              disabled={!column.orderBy}
              onClick={() => column.orderBy && onSort(column.orderBy)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-1 px-2 text-left text-xs font-medium text-text-300",
                column.width,
                column.orderBy && "hover:text-text-100",
              )}
            >
              {column.label}
              {column.orderBy === orderBy &&
                (sortDirection === "asc" ? (
                  <ChevronUp size={11} strokeWidth={1.5} />
                ) : (
                  <ChevronDown size={11} strokeWidth={1.5} />
                ))}
            </button>
          ))}
        </div>

        <div style={{ paddingTop, paddingBottom }}>
          {issues.slice(start, end).map((issue) => (
            <MemoRow
              key={issue.id}
              issue={issue}
              states={states}
              members={members}
              labels={labels}
              columns={columns}
              handlers={handlers}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
