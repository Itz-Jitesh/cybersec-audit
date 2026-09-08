"use client";

import { ChevronDown, Filter, Search, X } from "lucide-react";
import { useCallback, useState } from "react";

import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MemberRow } from "@/db/queries/project";
import { cn } from "@/lib/utils";
import type { IssueFilters } from "@/lib/validators/issue";

/** Filter fields that can be updated from the UI — projectId is always provided by the page. */
export type PartialFilters = Omit<IssueFilters, "projectId"> & {
  projectId?: string;
};

interface FilterBarProps {
  filters: PartialFilters;
  states: StateOption[];
  members: MemberRow[];
  labels: { id: string; name: string; color: string }[];
  cycles: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  groupBy: IssueFilters["groupBy"];
  onGroupByChange: (groupBy: IssueFilters["groupBy"]) => void;
  onChange: (next: PartialFilters) => void;
}

const GROUP_BY_OPTIONS = [
  { value: "state", label: "State" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "label", label: "Label" },
  { value: "cycle", label: "Cycle" },
  { value: "module", label: "Module" },
] as const;

const ORDER_BY_OPTIONS = [
  { value: "sort_order", label: "Manual" },
  { value: "created_at", label: "Created" },
  { value: "updated_at", label: "Updated" },
  { value: "target_date", label: "Target date" },
  { value: "priority", label: "Priority" },
  { value: "name", label: "Name" },
  { value: "state", label: "State" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "none", label: "None" },
] as const;

function MultiSelect({
  options,
  selected,
  onToggle,
  placeholder,
}: {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-80 px-2 text-xs text-text-200",
            "hover:border-border-strong hover:text-text-100",
          )}
        >
          {placeholder}
          {selected.size > 0 && (
            <span className="rounded-full bg-accent/20 px-1.5 text-2xs font-medium text-accent">
              {selected.size}
            </span>
          )}
          <ChevronDown size={10} strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                "hover:bg-bg-70",
                selected.has(option.value)
                  ? "text-text-100"
                  : "text-text-300",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-border-subtle",
                  selected.has(option.value) && "border-accent bg-accent",
                )}
              >
                {selected.has(option.value) && (
                  <svg
                    width="8"
                    height="6"
                    viewBox="0 0 8 6"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M1 3L3 5L7 1"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {option.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({
  filters,
  states,
  members,
  labels,
  cycles,
  modules,
  groupBy,
  onGroupByChange,
  onChange,
}: FilterBarProps) {
  const [searchText, setSearchText] = useState(filters.search ?? "");

  const activeFilterCount = [
    filters.stateIds?.length,
    filters.stateGroups?.length,
    filters.priorities?.length,
    filters.assigneeIds?.length,
    filters.labelIds?.length,
    filters.cycleIds?.length,
    filters.moduleIds?.length,
    filters.createdByIds?.length,
    filters.targetDate?.value,
  ].filter(Boolean).length;

  const handleArrayToggle = useCallback(
    (key: keyof PartialFilters, value: string) => {
      const current = (filters[key] as string[] | undefined) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...filters, [key]: next.length > 0 ? next : undefined });
    },
    [filters, onChange],
  );

  const handleClearAll = useCallback(() => {
    onChange({
      ...filters,
      stateIds: undefined,
      stateGroups: undefined,
      priorities: undefined,
      assigneeIds: undefined,
      labelIds: undefined,
      cycleIds: undefined,
      moduleIds: undefined,
      createdByIds: undefined,
      targetDate: undefined,
      search: undefined,
    });
    setSearchText("");
  }, [filters, onChange]);

  return (
    <div className="shrink-0 border-b border-border-subtle">
      <div className="flex h-10 items-center gap-2 px-4">
        <div className="flex items-center gap-1.5 text-text-300">
          <Filter size={12} strokeWidth={1.5} />
          <span className="text-xs">Filter</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-accent/20 px-1.5 text-2xs font-medium text-accent">
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="h-4 w-px bg-border-subtle" />

        <MultiSelect
          options={states.map((s) => ({ value: s.id, label: s.name }))}
          selected={new Set(filters.stateIds ?? [])}
          onToggle={(v) => handleArrayToggle("stateIds", v)}
          placeholder="State"
        />

        <MultiSelect
          options={[...PRIORITY_OPTIONS]}
          selected={new Set(filters.priorities ?? [])}
          onToggle={(v) => handleArrayToggle("priorities", v)}
          placeholder="Priority"
        />

        <MultiSelect
          options={members.map((m) => ({
            value: m.userId,
            label: m.displayName,
          }))}
          selected={new Set(filters.assigneeIds ?? [])}
          onToggle={(v) => handleArrayToggle("assigneeIds", v)}
          placeholder="Assignee"
        />

        <MultiSelect
          options={labels.map((l) => ({ value: l.id, label: l.name }))}
          selected={new Set(filters.labelIds ?? [])}
          onToggle={(v) => handleArrayToggle("labelIds", v)}
          placeholder="Label"
        />

        <MultiSelect
          options={cycles.map((c) => ({ value: c.id, label: c.name }))}
          selected={new Set(filters.cycleIds ?? [])}
          onToggle={(v) => handleArrayToggle("cycleIds", v)}
          placeholder="Cycle"
        />

        <MultiSelect
          options={modules.map((m) => ({ value: m.id, label: m.name }))}
          selected={new Set(filters.moduleIds ?? [])}
          onToggle={(v) => handleArrayToggle("moduleIds", v)}
          placeholder="Module"
        />

        <span className="flex-1" />

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-80 px-2 text-xs text-text-200 hover:border-border-strong hover:text-text-100"
            >
              Group:{" "}
              {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
              <ChevronDown size={10} strokeWidth={1.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1" align="end">
            {GROUP_BY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onGroupByChange(option.value)}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-xs",
                  "hover:bg-bg-70",
                  groupBy === option.value ? "text-text-100" : "text-text-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-80 px-2 text-xs text-text-200 hover:border-border-strong hover:text-text-100"
            >
              Sort:{" "}
              {
                ORDER_BY_OPTIONS.find((o) => o.value === filters.orderBy)
                  ?.label
              }
              <ChevronDown size={10} strokeWidth={1.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1" align="end">
            {ORDER_BY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    orderBy: option.value as IssueFilters["orderBy"],
                  })
                }
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-xs",
                  "hover:bg-bg-70",
                  filters.orderBy === option.value
                    ? "text-text-100"
                    : "text-text-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              sortDirection:
                filters.sortDirection === "asc" ? "desc" : "asc",
            })
          }
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-80 text-text-300 hover:border-border-strong hover:text-text-100"
          title={filters.sortDirection === "asc" ? "Ascending" : "Descending"}
        >
          {filters.sortDirection === "asc" ? "↑" : "↓"}
        </button>

        <div className="relative">
          <Search
            size={12}
            strokeWidth={1.5}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-400"
          />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onChange({
                  ...filters,
                  search: searchText.trim() || undefined,
                });
              }
            }}
            placeholder="Search issues..."
            className="h-7 w-40 pl-7 text-xs"
          />
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="flex h-8 items-center gap-1.5 border-t border-border-subtle px-4">
          <button
            type="button"
            onClick={handleClearAll}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs text-text-300 hover:bg-bg-70 hover:text-text-100"
          >
            <X size={10} strokeWidth={1.5} />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

