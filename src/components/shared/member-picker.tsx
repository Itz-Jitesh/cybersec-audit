"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ProfileSummary {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
}

interface MemberPickerProps {
  members: ProfileSummary[];
  value: string[];
  onChange: (ids: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}

/**
 * A person picker over a Command list.
 *
 * Search matches display name and email, because in a club half the members
 * answer to a nickname the profile does not carry — the email is often the
 * only string the person searching is certain of. Arrow keys and Enter come
 * from cmdk; the rows are CommandItems, not buttons, so the roving focus is
 * the list's, not the browser's.
 */
export function MemberPicker({
  members,
  value,
  onChange,
  multiple = false,
  placeholder = "Select a member",
}: MemberPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  function toggle(userId: string) {
    if (!multiple) {
      onChange(selected.has(userId) ? [] : [userId]);
      setOpen(false);
      return;
    }
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    onChange([...next]);
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (members.find((member) => member.userId === value[0])?.displayName ??
          placeholder)
        : `${value.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // No role="combobox" here: that pattern requires aria-controls
          // pointing at the listbox, and the list lives in a portal that does
          // not exist until the popover opens. Radix already applies
          // aria-haspopup and aria-expanded to the trigger.
          className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-100 px-2 text-sm text-text-100 hover:bg-bg-90"
        >
          <span
            className={cn("truncate", value.length === 0 && "text-text-400")}
          >
            {label}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className="shrink-0 text-text-400"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search people" />
          <CommandList>
            <CommandEmpty>No matching member.</CommandEmpty>
            <CommandGroup>
              {members.map((member) => (
                <CommandItem
                  key={member.userId}
                  // cmdk filters on this value, so it carries both fields the
                  // search is meant to match.
                  value={`${member.displayName} ${member.email}`}
                  onSelect={() => toggle(member.userId)}
                  className="gap-2"
                >
                  <MemberAvatar
                    user={{
                      id: member.userId,
                      displayName: member.displayName,
                      avatarUrl: member.avatarUrl,
                    }}
                    size={20}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-100">
                      {member.displayName}
                    </span>
                    <span className="block truncate text-xs text-text-300">
                      {member.email}
                    </span>
                  </span>
                  {selected.has(member.userId) && (
                    <Check
                      size={14}
                      strokeWidth={1.5}
                      className="shrink-0 text-brand"
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
