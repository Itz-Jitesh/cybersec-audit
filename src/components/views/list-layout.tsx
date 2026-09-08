"use client";

import { ChevronRight } from "lucide-react";

import {
  IssueListRow,
  type IssueRowHandlers,
} from "@/components/issues/issue-list-row";
import { IssueQuickAdd } from "@/components/issues/issue-quick-add";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { type StateGroup,StateIcon } from "@/components/shared/state-icon";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import { cn } from "@/lib/utils";
import type { IssueFilters } from "@/lib/validators/issue";
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
  selectedIds: Set<string>;
  canDelete: boolean;
  handlers: IssueRowHandlers;
  onCreated: () => void;
}

interface GroupDef {
  id: string;
  name: string;
  color?: string;
  group?: string;
}

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"] as const;

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
  groupId,
  projectId,
}: {
  group: GroupDef;
  count: number;
  groupId: string;
  projectId: string;
}) {
  const { toggleGroup, isCollapsed } = useIssueViewStore();
  const collapsed = isCollapsed(projectId, groupId);

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border-subtle bg-bg-100 px-3",
      )}
    >
      <button
        type="button"
        onClick={() => toggleGroup(projectId, groupId)}
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

export function ListLayout({
  projectId,
  issues,
  states,
  members,
  labels,
  cycles,
  modules,
  groupBy,
  selectedIds,
  canDelete,
  handlers,
  onCreated,
}: ListLayoutProps) {
  const { groups, grouped } = buildGroups(
    issues,
    groupBy,
    states,
    members,
    labels,
    cycles,
    modules,
  );

  return (
    <div className="pb-24">
      {groups.map((group) => {
        const items = grouped.get(group.id) ?? [];

        return (
          <section key={group.id}>
            <GroupHeader
              group={group}
              count={items.length}
              groupId={group.id}
              projectId={projectId}
            />

            {items.length > 0 && (
              <>
                {items.map((issue) => (
                  <IssueListRow
                    key={issue.id}
                    issue={issue}
                    states={states}
                    members={members}
                    labels={labels}
                    isSelected={selectedIds.has(issue.id)}
                    canDelete={canDelete}
                    handlers={handlers}
                  />
                ))}

                {groupBy === "state" && (
                  <IssueQuickAdd
                    projectId={projectId}
                    stateId={group.id}
                    onCreated={onCreated}
                  />
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
