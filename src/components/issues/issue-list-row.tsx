"use client";

import {
  Archive,
  Copy,
  GripVertical,
  Link2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AssigneeDropdown,
  LabelDropdown,
  PriorityDropdown,
  StateDropdown,
  type StateOption,
} from "@/components/issues/issue-row-dropdowns";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { DateChip } from "@/components/shared/date-chip";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { LabelChip } from "@/components/shared/label-chip";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { type StateGroup,StateIcon } from "@/components/shared/state-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import { cn } from "@/lib/utils";

export interface IssueRowHandlers {
  onOpen: (issueId: string) => void;
  onSetState: (issueId: string, stateId: string) => void;
  onSetPriority: (issueId: string, priority: IssuePriority) => void;
  onToggleAssignee: (issueId: string, userId: string) => void;
  onToggleLabel: (issueId: string, labelId: string) => void;
  onArchive: (issueId: string) => void;
  onDelete: (issueId: string) => void;
  onSelect: (issueId: string, event: React.MouseEvent) => void;
}

interface IssueListRowProps {
  issue: IssueListItem;
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  isSelected: boolean;
  canDelete: boolean;
  handlers: IssueRowHandlers;
}

/**
 * A 38px row. The drag handle and the overflow menu only appear on hover, which
 * is what keeps the row quiet enough to scan a hundred of them; the space is
 * reserved either way so nothing shifts when they arrive.
 */
export function IssueListRow({
  issue,
  states,
  members,
  labels,
  isSelected,
  canDelete,
  handlers,
}: IssueListRowProps) {
  const assigneeIds = issue.assignees.map((assignee) => assignee.id);
  const labelIds = issue.labels.map((label) => label.id);
  const isCompleted =
    issue.stateGroup === "completed" || issue.stateGroup === "cancelled";

  function copy(text: string, message: string) {
    void navigator.clipboard.writeText(text);
    toast.success(message);
  }

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          handlers.onSelect(issue.id, event);
          return;
        }
        handlers.onOpen(issue.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") handlers.onOpen(issue.id);
      }}
      className={cn(
        "group flex h-row cursor-pointer items-center gap-2 border-l-2 px-3 transition-colors duration-[120ms] ease-out",
        isSelected
          ? "border-l-brand bg-bg-80"
          : "hover:bg-bg-90 border-l-transparent",
      )}
    >
      <span className="w-3.5 shrink-0">
        <GripVertical
          size={14}
          strokeWidth={1.5}
          className="text-text-400 opacity-0 transition-opacity duration-[120ms] ease-out group-hover:opacity-100"
        />
      </span>

      <IssueIdBadge
        identifier={issue.identifier}
        sequenceId={issue.sequenceId}
      />

      <PriorityDropdown
        value={issue.priority as IssuePriority}
        onSelect={(priority) => handlers.onSetPriority(issue.id, priority)}
      >
        <button
          type="button"
          aria-label={`Priority: ${issue.priority}`}
          className="hover:bg-bg-70 shrink-0 rounded-sm p-0.5"
        >
          <PriorityIcon priority={issue.priority as IssuePriority} size={14} />
        </button>
      </PriorityDropdown>

      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          isCompleted ? "text-text-300" : "text-text-100",
        )}
      >
        {issue.name}
      </span>

      {issue.subIssueCount > 0 && (
        <span className="text-text-400 shrink-0 text-xs">
          {issue.completedSubIssueCount}/{issue.subIssueCount}
        </span>
      )}

      <LabelDropdown
        labels={labels}
        selected={labelIds}
        onToggle={(labelId) => handlers.onToggleLabel(issue.id, labelId)}
      >
        <button
          type="button"
          aria-label="Labels"
          className="hidden shrink-0 items-center gap-1 lg:flex"
        >
          {issue.labels.slice(0, 2).map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
          {issue.labels.length > 2 && (
            <span className="text-text-400 text-xs">
              +{issue.labels.length - 2}
            </span>
          )}
        </button>
      </LabelDropdown>

      {issue.targetDate && (
        <DateChip
          date={issue.targetDate}
          variant="target"
          isCompleted={isCompleted}
        />
      )}

      <AssigneeDropdown
        members={members}
        selected={assigneeIds}
        onToggle={(userId) => handlers.onToggleAssignee(issue.id, userId)}
      >
        <button
          type="button"
          aria-label="Assignees"
          className="hover:bg-bg-70 shrink-0 rounded-full p-0.5"
        >
          {issue.assignees.length > 0 ? (
            <AvatarGroup
              users={issue.assignees.map((assignee) => ({
                id: assignee.id,
                displayName: assignee.displayName,
                avatarUrl: assignee.avatarUrl,
              }))}
              max={3}
              size={20}
            />
          ) : (
            <span className="border-border-strong text-text-400 flex size-5 items-center justify-center rounded-full border border-dashed text-2xs">
              +
            </span>
          )}
        </button>
      </AssigneeDropdown>

      <StateDropdown
        states={states}
        value={issue.stateId}
        onSelect={(stateId) => handlers.onSetState(issue.id, stateId)}
      >
        <button
          type="button"
          aria-label={`State: ${issue.stateName}`}
          className="border-border-subtle hover:bg-bg-70 flex h-6 shrink-0 items-center gap-1.5 rounded-md border px-1.5"
        >
          <StateIcon
            group={issue.stateGroup as StateGroup}
            color={issue.stateColor}
            size={12}
          />
          <span className="text-text-200 hidden text-xs sm:inline">
            {issue.stateName}
          </span>
        </button>
      </StateDropdown>

      <DropdownMenu>
        <DropdownMenuTrigger
          asChild
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="More actions"
            className="text-text-400 hover:bg-bg-70 hover:text-text-100 shrink-0 rounded-sm p-1 opacity-0 transition-opacity duration-[120ms] ease-out group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() =>
              copy(
                `${window.location.origin}/projects/${issue.projectId}/issues/${issue.id}`,
                "Link copied.",
              )
            }
          >
            <Link2 size={14} strokeWidth={1.5} />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              copy(`${issue.identifier}-${issue.sequenceId}`, "ID copied.")
            }
          >
            <Copy size={14} strokeWidth={1.5} />
            Copy ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handlers.onArchive(issue.id)}>
            <Archive size={14} strokeWidth={1.5} />
            Archive
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => handlers.onDelete(issue.id)}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
