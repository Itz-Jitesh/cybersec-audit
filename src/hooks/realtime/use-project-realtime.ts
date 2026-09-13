"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import type { IssueListItem } from "@/db/queries/issues";
import { createClient } from "@/lib/supabase/client";

type IssueRow = {
  id: string;
  name: string;
  priority: string;
  state_id: string;
  sequence_id: number;
  cycle_id: string | null;
  parent_id: string | null;
  start_date: string | null;
  target_date: string | null;
  estimate_point: number | null;
  sort_order: number;
  created_at: string;
};

type IssueChange = RealtimePostgresChangesPayload<IssueRow>;

interface ProjectRealtimeOptions {
  projectId: string;
  /** Project states, used to resolve the joined state fields on updates. */
  states: StateOption[];
}

const isEmptyList = (rows: unknown): rows is IssueListItem[] =>
  Array.isArray(rows);

/** Raw realtime row → the joined fields a list row carries. */
function resolveState(
  row: Record<string, unknown>,
  states: StateOption[],
): Partial<IssueListItem> {
  const state = states.find((option) => option.id === row.state_id);
  return {
    stateId: String(row.state_id),
    ...(state
      ? {
          stateName: state.name,
          stateGroup: state.group,
          stateColor: state.color,
        }
      : {}),
    cycleId: (row.cycle_id as string | null) ?? null,
    parentId: (row.parent_id as string | null) ?? null,
    startDate: (row.start_date as string | null) ?? null,
    targetDate: (row.target_date as string | null) ?? null,
    estimatePoint: (row.estimate_point as number | null) ?? null,
    sortOrder: Number(row.sort_order),
  };
}

/**
 * One Supabase channel per open project, removed on unmount.
 *
 * Events patch the TanStack Query cache in place rather than invalidating —
 * the whole point of realtime is seeing the change without a refetch, and a
 * refetch would also undo optimistic rows still in flight. Every list query
 * for this project (`["issues", projectId, ...any-filters]`) is patched
 * through setQueriesData so each filtered view stays consistent.
 */
export function useProjectRealtime({
  projectId,
  states,
}: ProjectRealtimeOptions) {
  const queryClient = useQueryClient();
  // States resolve per-event; holding them in a ref avoids resubscribing
  // (tearing down the channel) whenever the list's identity changes.
  const statesRef = useRef(states);
  statesRef.current = states;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "issues",
          filter: `project_id=eq.${projectId}`,
        },
        (payload: IssueChange) => {
          // RealtimePostgresChangesPayload unions `{}` (DELETE) with the row
          // (INSERT/UPDATE); this handler only fires on UPDATE, so cast.
          const row = payload.new as IssueRow;
          const issueId = String(row.id);

          queryClient.setQueriesData<IssueListItem[]>(
            { queryKey: ["issues", projectId] },
            (rows) =>
              isEmptyList(rows)
                ? rows.map((issue) =>
                    issue.id === issueId
                      ? {
                          ...issue,
                          name: String(row.name),
                          priority: String(row.priority),
                          ...resolveState(row, statesRef.current),
                        }
                      : issue,
                  )
                : rows,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "issues",
          filter: `project_id=eq.${projectId}`,
        },
        (payload: IssueChange) => {
          // Cast for the same union reason as UPDATE above.
          const row = payload.new as IssueRow;
          const issueId = String(row.id);
          const state = statesRef.current.find(
            (option) => option.id === row.state_id,
          );

          queryClient.setQueriesData<IssueListItem[]>(
            { queryKey: ["issues", projectId] },
            (rows) => {
              if (!isEmptyList(rows) || rows.some((i) => i.id === issueId)) {
                return rows;
              }
              // identifier shares one prefix per project; borrow it from any
              // cached row. With an empty cache the client cannot build the
              // identifier, so leave the cache alone and let the next server
              // render supply the row.
              const prefix = rows[0]?.identifier.match(/^(.*)-\d+$/)?.[1];
              if (!prefix) return rows;
              const sequenceId = Number(row.sequence_id);
              return [
                ...rows,
                {
                  id: issueId,
                  sequenceId,
                  identifier: `${prefix}-${sequenceId}`,
                  projectId,
                  name: String(row.name),
                  priority: String(row.priority),
                  stateId: String(row.state_id),
                  stateName: state?.name ?? "",
                  stateGroup: state?.group ?? "backlog",
                  stateColor: state?.color ?? "#000000",
                  cycleId: (row.cycle_id as string | null) ?? null,
                  cycleName: null,
                  parentId: (row.parent_id as string | null) ?? null,
                  startDate: (row.start_date as string | null) ?? null,
                  targetDate: (row.target_date as string | null) ?? null,
                  estimatePoint: (row.estimate_point as number | null) ?? null,
                  sortOrder: Number(row.sort_order),
                  createdAt: new Date(String(row.created_at)),
                  subIssueCount: 0,
                  completedSubIssueCount: 0,
                  assignees: [],
                  labels: [],
                  moduleIds: [],
                },
              ];
            },
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "issues",
          filter: `project_id=eq.${projectId}`,
        },
        (payload: IssueChange) => {
          const issueId = String((payload.old as IssueRow).id);
          queryClient.setQueriesData<IssueListItem[]>(
            { queryKey: ["issues", projectId] },
            (rows) =>
              isEmptyList(rows)
                ? rows.filter((issue) => issue.id !== issueId)
                : rows,
          );
          queryClient.removeQueries({ queryKey: ["issue", issueId] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
