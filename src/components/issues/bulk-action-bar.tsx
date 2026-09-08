"use client";

import { Archive, X } from "lucide-react";

import {
  AssigneeDropdown,
  LabelDropdown,
  PriorityDropdown,
  StateDropdown,
  type StateOption,
} from "@/components/issues/issue-row-dropdowns";
import { Button } from "@/components/ui/button";
import type { IssueLabelRef } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import type { IssuePriority } from "@/lib/validators/issue";

/**
 * Floats above the list once anything is selected. Every control here goes
 * through one bulkUpdateIssues call rather than a loop of single mutations, so
 * fifty issues is one round trip and one revalidation.
 */
export function BulkActionBar({
  count,
  states,
  members,
  labels,
  onSetState,
  onSetPriority,
  onAssign,
  onAddLabel,
  onArchive,
  onCancel,
}: {
  count: number;
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  onSetState: (stateId: string) => void;
  onSetPriority: (priority: IssuePriority) => void;
  onAssign: (userId: string) => void;
  onAddLabel: (labelId: string) => void;
  onArchive: () => void;
  onCancel: () => void;
}) {
  if (count === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={`${count} issues selected`}
      className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border-strong bg-bg-80 px-2 py-1.5 shadow-lg"
    >
      <span className="px-2 text-xs font-medium text-text-200">
        {count} selected
      </span>

      <span aria-hidden className="mx-1 h-4 w-px bg-border-strong" />

      <StateDropdown states={states} value="" onSelect={onSetState}>
        <Button size="sm" variant="ghost">
          Set state
        </Button>
      </StateDropdown>

      <PriorityDropdown value="none" onSelect={onSetPriority}>
        <Button size="sm" variant="ghost">
          Set priority
        </Button>
      </PriorityDropdown>

      <AssigneeDropdown members={members} selected={[]} onToggle={onAssign}>
        <Button size="sm" variant="ghost">
          Assign
        </Button>
      </AssigneeDropdown>

      <LabelDropdown labels={labels} selected={[]} onToggle={onAddLabel}>
        <Button size="sm" variant="ghost">
          Add label
        </Button>
      </LabelDropdown>

      <Button size="sm" variant="ghost" onClick={onArchive} className="gap-1.5">
        <Archive size={14} strokeWidth={1.5} />
        Archive
      </Button>

      <span aria-hidden className="mx-1 h-4 w-px bg-border-strong" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onCancel}
        aria-label="Clear selection"
      >
        <X size={14} strokeWidth={1.5} />
      </Button>
    </div>
  );
}
