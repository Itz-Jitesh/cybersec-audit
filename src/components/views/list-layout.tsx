"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo } from "react";

import {
  IssueListRow,
  type IssueRowHandlers,
} from "@/components/issues/issue-list-row";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import { useVirtualRows } from "@/hooks/use-virtual-rows";
import { cn } from "@/lib/utils";
import type { IssueFilters } from "@/lib/validators/issue";
import type { DisplayProperties } from "@/lib/validators/view";
import { useIssueViewStore } from "@/stores/issue-view-store";

interface ListLayoutProps {
  projectId: string;
  issues: IssueListItem[];
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  cycles: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  groupBy: IssueFilters["groupBy"];
  properties: DisplayProperties;
  /** Display toggle. Empty groups are hidden unless this is on. */
  showEmptyGroups: boolean;
  selectedIds: Set<string>;
  canDelete: boolean;
  handlers: IssueRowHandlers;
}

interface GroupDef {
  id: string;
  name: string;
  color?: string;
  group?: string;
}

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"] as const;

/** Stable empty array so the store selector does not return a new one each read. */
const EMPTY_COLLAPSED: string[] = [];

function buildGroups(
  issues: IssueListItem[],
  groupBy: IssueFilters["groupBy"],
  states: StateOption[],
  members: MemberRow[],
  labels: IssueLabelRef[],
  cycles: { id: string; name: string }[],
  modules: { id: string; name: string }[],
): { groups: GroupDef[]; grouped: Map<string, IssueListItem[]> } {
  const grouped = new Map<string, IssueListItem[]>();

  if (groupBy === "state") {
    const groups: GroupDef[] = states.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      group: s.group,
    }));
    for (const g of groups) grouped.set(g.id, []);
    for (const issue of issues) {
      const list = grouped.get(issue.stateId);
      if (list) list.push(issue);
      else grouped.set(issue.stateId, [issue]);
    }
    return { groups, grouped };
  }

  if (groupBy === "priority") {
    const groups: GroupDef[] = [...PRIORITY_ORDER].map((p) => ({
      id: p,
      name: p.charAt(0).toUpperCase() + p.slice(1),
    }));
    for (const g of groups) grouped.set(g.id, []);
    for (const issue of issues) {
      const list = grouped.get(issue.priority);
      if (list) list.push(issue);
    }
    return { groups, grouped };
  }

  if (groupBy === "assignee") {
    const groups: GroupDef[] = members.map((m) => ({
      id: m.userId,
      name: m.displayName,
    }));
    for (const g of groups) grouped.set(g.id, []);
    grouped.set("__unassigned__", []);
    for (const issue of issues) {
      if (issue.assignees.length === 0) {
        const bucket = grouped.get("__unassigned__");
        if (bucket) bucket.push(issue);
        continue;
      }
      for (const a of issue.assignees) {
        if (!grouped.has(a.id)) grouped.set(a.id, []);
        const bucket = grouped.get(a.id);
        if (bucket) bucket.push(issue);
      }
    }
    return {
      groups: [{ id: "__unassigned__", name: "Unassigned" }, ...groups],
      grouped,
    };
  }

  if (groupBy === "label") {
    const groups: GroupDef[] = labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
    }));
    for (const g of groups) grouped.set(g.id, []);
    grouped.set("__no_label__", []);
    for (const issue of issues) {
      if (issue.labels.length === 0) {
        const bucket = grouped.get("__no_label__");
        if (bucket) bucket.push(issue);
        continue;
      }
      for (const l of issue.labels) {
        if (!grouped.has(l.id)) grouped.set(l.id, []);
        const bucket = grouped.get(l.id);
        if (bucket) bucket.push(issue);
      }
    }
    return {
      groups: [{ id: "__no_label__", name: "No label" }, ...groups],
      grouped,
    };
  }

  if (groupBy === "cycle") {
    const groups: GroupDef[] = cycles.map((c) => ({
      id: c.id,
      name: c.name,
    }));
    for (const g of groups) grouped.set(g.id, []);
    grouped.set("__no_cycle__", []);
    for (const issue of issues) {
      if (!issue.cycleId) {
        const bucket = grouped.get("__no_cycle__");
        if (bucket) bucket.push(issue);
        continue;
      }
      if (!grouped.has(issue.cycleId)) grouped.set(issue.cycleId, []);
      const bucket = grouped.get(issue.cycleId);
      if (bucket) bucket.push(issue);
    }
    return {
      groups: [{ id: "__no_cycle__", name: "No cycle" }, ...groups],
      grouped,
    };
  }

  // module
  const groups: GroupDef[] = modules.map((m) => ({
    id: m.id,
    name: m.name,
  }));
  for (const g of groups) grouped.set(g.id, []);
  grouped.set("__no_module__", []);
  for (const issue of issues) {
    if (issue.moduleIds.length === 0) {
      const bucket = grouped.get("__no_module__");
      if (bucket) bucket.push(issue);
      continue;
    }
    for (const mid of issue.moduleIds) {
      if (!grouped.has(mid)) grouped.set(mid, []);
      const bucket = grouped.get(mid);
      if (bucket) bucket.push(issue);
    }
  }
  return {
    groups: [{ id: "__no_module__", name: "No module" }, ...groups],
    grouped,
  };
}

function GroupHeader({
  group,
  count,
  collapsed,
  onToggle,
}: {
  group: GroupDef;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border-subtle bg-bg-100 px-3",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${group.name}`}
        className="shrink-0 text-text-400 hover:text-text-200"
      >
        <ChevronRight
          size={12}
          strokeWidth={1.5}
          className={cn(
            "transition-transform duration-[120ms] ease-out",
            !collapsed && "rotate-90",
          )}
        />
      </button>

      {group.group && group.color ? (
        <StateIcon
          group={group.group as StateGroup}
          color={group.color}
          size={14}
        />
      ) : group.color ? (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: group.color }}
        />
      ) : null}

      <span className="text-xs font-medium text-text-100">{group.name}</span>

      <span className="rounded-full bg-bg-80 px-1.5 text-2xs font-medium text-text-300">
        {count}
      </span>

      <span className="flex-1" />
    </header>
  );
}

/** One entry in the flattened, windowable render order. */
type Entry =
  | { kind: "header"; group: GroupDef; count: number; collapsed: boolean }
  | { kind: "issue"; issue: IssueListItem };

const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 38;

export function ListLayout({
  projectId,
  issues,
  states,
  members,
  labels,
  cycles,
  modules,
  groupBy,
  properties,
  showEmptyGroups,
  selectedIds,
  canDelete,
  handlers,
}: ListLayoutProps) {
  // Regrouping two hundred rows on every keystroke elsewhere in the view is
  // pure waste; the inputs below are the only things that can change it.
  const { groups, grouped } = useMemo(
    () =>
      buildGroups(issues, groupBy, states, members, labels, cycles, modules),
    [issues, groupBy, states, members, labels, cycles, modules],
  );

  const toggleGroup = useIssueViewStore((state) => state.toggleGroup);
  // A selector rather than the whole store: without it every header re-renders
  // whenever any group anywhere is folded.
  const hydrated = useIssueViewStore((state) => state.hasHydrated);
  const collapsedIds = useIssueViewStore((state) =>
    // Open on the first pass, like the server. The stored folds merge in via
    // rehydrate() below and only then take effect.
    hydrated ? (state.collapsed[projectId] ?? EMPTY_COLLAPSED) : EMPTY_COLLAPSED,
  );

  /**
   * Headers and rows flattened into one array in render order.
   * Virtualising a grouped list means windowing across the groups rather than
   * inside each of them, and that is only possible once the nesting is gone.
   */
  const entries = useMemo(() => {
    const flat: Entry[] = [];

    for (const group of groups) {
      const items = grouped.get(group.id) ?? [];
      const collapsed = collapsedIds.includes(group.id);

      // A group with nothing in it is a header and no work. Six of those
      // around one issue is noise, so they are dropped unless the Display
      // popover asks for them.
      if (items.length === 0 && !showEmptyGroups) continue;

      flat.push({ kind: "header", group, count: items.length, collapsed });
      if (collapsed || items.length === 0) continue;

      for (const issue of items) flat.push({ kind: "issue", issue });
    }

    return flat;
    // groupBy is absent on purpose: it shaped this list only through the
    // quick-add row, which is gone. `groups` and `grouped` already carry it.
  }, [collapsedIds, grouped, groups, showEmptyGroups]);

  const heights = useMemo(
    () =>
      entries.map((entry) =>
        entry.kind === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
      ),
    [entries],
  );

  const { scrollRef, start, end, paddingTop, paddingBottom } = useVirtualRows({
    count: entries.length,
    rowHeight: heights,
  });

  // The store is skipHydration (see the sidebar fix): merge localStorage after
  // the first paint so the server HTML and the first client render match.
  useEffect(() => {
    void useIssueViewStore.persist.rehydrate();
  }, []);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div style={{ paddingTop, paddingBottom }} className="pb-24">
        {entries.slice(start, end).map((entry, index) => {
          if (entry.kind === "header") {
            return (
              <GroupHeader
                key={`header:${entry.group.id}`}
                group={entry.group}
                count={entry.count}
                collapsed={entry.collapsed}
                onToggle={() => toggleGroup(projectId, entry.group.id)}
              />
            );
          }

          return (
            <IssueListRow
              key={entry.issue.id ?? index}
              issue={entry.issue}
              states={states}
              members={members}
              labels={labels}
              isSelected={selectedIds.has(entry.issue.id)}
              properties={properties}
              canDelete={canDelete}
              handlers={handlers}
            />
          );
        })}
      </div>
    </div>
  );
}
