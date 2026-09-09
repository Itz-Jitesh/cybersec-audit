"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IssueLabelRef } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

export interface StateOption {
  id: string;
  name: string;
  group: StateGroup;
  color: string;
}

const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

/**
 * Every chip on a row is a dropdown trigger, so changing state, priority or
 * assignee never requires opening the issue. That is the difference between a
 * list you triage from and a list you navigate away from.
 */

export function StateDropdown({
  states,
  value,
  onSelect,
  children,
}: {
  states: StateOption[];
  value: string;
  onSelect: (stateId: string) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-48">
        {states.map((state) => (
          <DropdownMenuItem
            key={state.id}
            onSelect={() => onSelect(state.id)}
            className="gap-2"
          >
            <StateIcon group={state.group} color={state.color} size={14} />
            <span className="flex-1 truncate">{state.name}</span>
            {state.id === value && <Check size={12} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityDropdown({
  value,
  onSelect,
  children,
}: {
  value: IssuePriority;
  onSelect: (priority: IssuePriority) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-40">
        {PRIORITIES.map((priority) => (
          <DropdownMenuItem
            key={priority}
            onSelect={() => onSelect(priority)}
            className="gap-2 capitalize"
          >
            <PriorityIcon priority={priority} size={14} />
            <span className="flex-1">{priority}</span>
            {priority === value && <Check size={12} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneeDropdown({
  members,
  selected,
  onToggle,
  children,
}: {
  members: MemberRow[];
  selected: string[];
  onToggle: (userId: string) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="max-h-72 w-56 overflow-y-auto"
      >
        {members.map((member) => (
          <DropdownMenuCheckboxItem
            key={member.userId}
            checked={selected.includes(member.userId)}
            onSelect={(event) => {
              event.preventDefault();
              onToggle(member.userId);
            }}
            className="gap-2"
          >
            <MemberAvatar
              user={{
                id: member.userId,
                displayName: member.displayName,
                avatarUrl: member.avatarUrl,
              }}
              size={16}
            />
            <span className="truncate">{member.displayName}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LabelDropdown({
  labels,
  selected,
  onToggle,
  children,
}: {
  labels: IssueLabelRef[];
  selected: string[];
  onToggle: (labelId: string) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="max-h-72 w-56 overflow-y-auto"
      >
        {labels.map((label) => (
          <DropdownMenuCheckboxItem
            key={label.id}
            checked={selected.includes(label.id)}
            onSelect={(event) => {
              event.preventDefault();
              onToggle(label.id);
            }}
            className="gap-2"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: label.color }}
            />
            <span className="truncate">{label.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
