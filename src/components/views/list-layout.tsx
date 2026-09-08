"use client";

import { ChevronRight } from "lucide-react";

import {
  IssueListRow,
  type IssueRowHandlers,
} from "@/components/issues/issue-list-row";
import { IssueQuickAdd } from "@/components/issues/issue-quick-add";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { StateIcon } from "@/components/shared/state-icon";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import { cn } from "@/lib/utils";
import { useIssueViewStore } from "@/stores/issue-view-store";

interface ListLayoutProps {
  projectId: string;
  issues: IssueListItem[];
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  selectedIds: Set<string>;
  canDelete: boolean;
  handlers: IssueRowHandlers;
  onCreated: () => void;
}

/**
 * Grouped by state. Group headers stick to the top of the scroll container as
 * you move through a long list, so the group a row belongs to is never off
 * screen — which matters here because the state chip is the last thing on the
 * row and the header is the first place you look.
 *
 * Grouping is fixed to state in this phase; the group-by control arrives with
 * the filter bar in phase 9.
 */
export function ListLayout({
  projectId,
  issues,
  states,
  members,
  labels,
  selectedIds,
  canDelete,
  handlers,
  onCreated,
}: ListLayoutProps) {
  const { toggleGroup, isCollapsed } = useIssueViewStore();

  const byState = new Map<string, IssueListItem[]>();
  for (const state of states) byState.set(state.id, []);
  for (const issue of issues) {
    const list = byState.get(issue.stateId);
    if (list) list.push(issue);
    else byState.set(issue.stateId, [issue]);
  }

  return (
    <div className="pb-24">
      {states.map((state) => {
        const group = byState.get(state.id) ?? [];
        const collapsed = isCollapsed(projectId, state.id);

        return (
          <section key={state.id}>
            <header
              className={cn(
                "sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-border-subtle bg-bg-100 px-3",
              )}
            >
              <button
                type="button"
                onClick={() => toggleGroup(projectId, state.id)}
                aria-expanded={!collapsed}
                aria-label={`${collapsed ? "Expand" : "Collapse"} ${state.name}`}
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

              <StateIcon group={state.group} color={state.color} size={14} />

              <span className="text-xs font-medium text-text-100">
                {state.name}
              </span>

              <span className="rounded-full bg-bg-80 px-1.5 text-2xs font-medium text-text-300">
                {group.length}
              </span>

              <span className="flex-1" />
            </header>

            {!collapsed && (
              <>
                {group.map((issue) => (
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

                <IssueQuickAdd
                  projectId={projectId}
                  stateId={state.id}
                  onCreated={onCreated}
                />
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
