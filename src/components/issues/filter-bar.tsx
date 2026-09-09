"use client";

import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  Filter,
  Kanban,
  List,
  Search,
  Settings2,
  Sheet,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
import type {
  DisplayProperties,
  DisplayProps,
  IssueLayout,
} from "@/lib/validators/view";

/** Filter fields that can be updated from the UI — projectId is always provided by the page. */
export type PartialFilters = Omit<IssueFilters, "projectId"> & {
  projectId?: string;
};

interface FilterBarProps {
  filters: PartialFilters;
  layout: IssueLayout;
  onLayoutChange: (layout: IssueLayout) => void;
  displayProps: DisplayProps;
  onDisplayPropsChange: (displayProps: DisplayProps) => void;
  onSaveView: () => void;
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
            <span className="rounded-full bg-brand-subtle px-1.5 text-2xs font-medium text-brand">
              {selected.size}
            </span>
          )}
          <ChevronDown size={10} strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-48 p-1" align="start">
        <div className="max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                "hover:bg-bg-70",
                selected.has(option.value) ? "text-text-100" : "text-text-300",
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-border-subtle",
                  selected.has(option.value) && "border-brand bg-brand",
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

const LAYOUTS = [
  { value: "list", label: "List", icon: List },
  { value: "kanban", label: "Board", icon: Kanban },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
  { value: "spreadsheet", label: "Table", icon: Sheet },
] as const;

const PROPERTY_LABELS: { key: keyof DisplayProperties; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "priority", label: "Priority" },
  { key: "state", label: "State" },
  { key: "assignee", label: "Assignee" },
  { key: "labels", label: "Labels" },
  { key: "dueDate", label: "Due date" },
  { key: "estimate", label: "Estimate" },
  { key: "subIssueCount", label: "Sub-issue count" },
];

export function FilterBar({
  filters,
  layout,
  onLayoutChange,
  displayProps,
  onDisplayPropsChange,
  onSaveView,
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

  /**
   * One removable chip per applied value, as docs/06-UX-LAYOUT-SPEC.md §7.1
   * asks. A count badge tells you a filter exists; a chip tells you what it is
   * and lets you take it off without reopening the popover it came from.
   */
  const chips = useMemo(() => {
    const nameOf = (
      options: { value: string; label: string }[],
      value: string,
    ) => options.find((option) => option.value === value)?.label ?? value;

    const sources: {
      key: keyof PartialFilters;
      group: string;
      options: { value: string; label: string }[];
    }[] = [
      {
        key: "stateIds",
        group: "State",
        options: states.map((s) => ({ value: s.id, label: s.name })),
      },
      { key: "priorities", group: "Priority", options: [...PRIORITY_OPTIONS] },
      {
        key: "assigneeIds",
        group: "Assignee",
        options: members.map((m) => ({
          value: m.userId,
          label: m.displayName,
        })),
      },
      {
        key: "labelIds",
        group: "Label",
        options: labels.map((l) => ({ value: l.id, label: l.name })),
      },
      {
        key: "cycleIds",
        group: "Cycle",
        options: cycles.map((c) => ({ value: c.id, label: c.name })),
      },
      {
        key: "moduleIds",
        group: "Module",
        options: modules.map((m) => ({ value: m.id, label: m.name })),
      },
    ];

    const built: {
      key: string;
      value: string;
      group: string;
      label: string;
      remove: () => void;
    }[] = [];

    for (const source of sources) {
      for (const value of (filters[source.key] as string[] | undefined) ?? []) {
        built.push({
          key: String(source.key),
          value,
          group: source.group,
          label: nameOf(source.options, value),
          remove: () => handleArrayToggle(source.key, value),
        });
      }
    }

    if (filters.search) {
      built.push({
        key: "search",
        value: filters.search,
        group: "Search",
        label: filters.search,
        remove: () => {
          setSearchText("");
          onChange({ ...filters, search: undefined });
        },
      });
    }

    return built;
  }, [
    cycles,
    filters,
    handleArrayToggle,
    labels,
    members,
    modules,
    onChange,
    states,
  ]);

  return (
    <div className="shrink-0 border-b border-border-subtle">
      <div className="flex h-10 items-center gap-2 px-4">
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-border-subtle bg-bg-80 p-0.5">
          {LAYOUTS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.label}
              aria-pressed={layout === option.value}
              title={option.label}
              onClick={() => onLayoutChange(option.value)}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-sm",
                layout === option.value
                  ? "bg-bg-70 text-text-100"
                  : "text-text-400 hover:text-text-200",
              )}
            >
              <option.icon size={13} strokeWidth={1.5} />
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-border-subtle" />

        <div className="flex items-center gap-1.5 text-text-300">
          <Filter size={12} strokeWidth={1.5} />
          <span className="text-xs">Filter</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-brand-subtle px-1.5 text-2xs font-medium text-brand">
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
              <Settings2 size={12} strokeWidth={1.5} />
              Display
              <ChevronDown size={10} strokeWidth={1.5} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" className="w-60 p-2" align="end">
            <p className="px-1 pb-1 text-2xs text-text-400 uppercase">
              Group by
            </p>
            <div className="grid grid-cols-3 gap-1">
              {GROUP_BY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onGroupByChange(option.value)}
                  className={cn(
                    "rounded-md px-1.5 py-1 text-2xs",
                    groupBy === option.value
                      ? "bg-bg-70 text-text-100"
                      : "text-text-300 hover:bg-bg-80",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="px-1 pt-3 pb-1 text-2xs text-text-400 uppercase">
              Order by
            </p>
            <div className="grid grid-cols-3 gap-1">
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
                    "rounded-md px-1.5 py-1 text-2xs",
                    filters.orderBy === option.value
                      ? "bg-bg-70 text-text-100"
                      : "text-text-300 hover:bg-bg-80",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                onChange({
                  ...filters,
                  sortDirection:
                    filters.sortDirection === "asc" ? "desc" : "asc",
                })
              }
              className="mt-2 flex w-full items-center justify-between rounded-md px-1.5 py-1 text-xs text-text-300 hover:bg-bg-80 hover:text-text-100"
            >
              Direction
              <span>
                {filters.sortDirection === "asc" ? "Ascending" : "Descending"}
              </span>
            </button>

            <p className="px-1 pt-3 pb-1 text-2xs text-text-400 uppercase">
              Properties
            </p>
            <div className="flex flex-wrap gap-1">
              {PROPERTY_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={displayProps.properties[key]}
                  onClick={() =>
                    onDisplayPropsChange({
                      ...displayProps,
                      properties: {
                        ...displayProps.properties,
                        [key]: !displayProps.properties[key],
                      },
                    })
                  }
                  className={cn(
                    "rounded-md border px-1.5 py-0.5 text-2xs",
                    displayProps.properties[key]
                      ? "border-brand bg-brand-subtle text-brand"
                      : "border-border-subtle text-text-400 hover:text-text-200",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          onClick={onSaveView}
          title="Save these filters as a view"
          className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle bg-bg-80 px-2 text-xs text-text-200 hover:border-border-strong hover:text-text-100"
        >
          <Bookmark size={12} strokeWidth={1.5} />
          Save view
        </button>

        <div className="relative">
          <Search
            size={12}
            strokeWidth={1.5}
            className="absolute top-1/2 left-2 -translate-y-1/2 text-text-400"
          />
          <Input
            id="filter-search"
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

      {chips.length > 0 && (
        <div className="flex min-h-8 flex-wrap items-center gap-1.5 border-t border-border-subtle px-4 py-1">
          {chips.map((chip) => (
            <button
              key={`${chip.key}:${chip.value}`}
              type="button"
              onClick={() => chip.remove()}
              className="flex items-center gap-1 rounded-md border border-border-subtle bg-bg-80 px-1.5 py-0.5 text-2xs text-text-200 hover:border-border-strong hover:text-text-100"
            >
              <span className="text-text-400">{chip.group}</span>
              {chip.label}
              <X size={10} strokeWidth={1.5} />
            </button>
          ))}

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
