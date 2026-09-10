"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CircleDot, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  archiveIssue,
  bulkUpdateIssues,
  deleteIssue,
  setAssignees,
  setLabels,
  updateIssue,
  updateIssueOrder,
} from "@/actions/issues";
import { BulkActionBar } from "@/components/issues/bulk-action-bar";
import { FilterBar, type PartialFilters } from "@/components/issues/filter-bar";
import { IssueCreateModal } from "@/components/issues/issue-create-modal";
import type { IssueRowHandlers } from "@/components/issues/issue-list-row";
import { IssuePeekOverlay } from "@/components/issues/issue-peek-overlay";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CalendarLayout } from "@/components/views/calendar-layout";
import {
  KanbanLayout,
  type KanbanMove,
} from "@/components/views/kanban-layout";
import { ListLayout } from "@/components/views/list-layout";
import { SaveViewDialog } from "@/components/views/save-view-dialog";
import { SpreadsheetLayout } from "@/components/views/spreadsheet-layout";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import { useProjectRealtime } from "@/hooks/realtime/use-project-realtime";
import { useIssueShortcuts } from "@/hooks/use-issue-shortcuts";
import type { IssueFilters, IssuePriority } from "@/lib/validators/issue";
import {
  DEFAULT_DISPLAY_PROPS,
  type DisplayProps,
  type IssueLayout,
} from "@/lib/validators/view";
import { useProjectViewStore } from "@/stores/project-view-store";

interface IssuesViewProps {
  projectId: string;
  initialIssues: IssueListItem[];
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  cycles: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  canDelete: boolean;
  canModerate: boolean;
  currentUserId: string;
  fetchIssues: (filters?: PartialFilters) => Promise<IssueListItem[]>;
}

type Patch = (issue: IssueListItem) => IssueListItem;

export function IssuesView({
  projectId,
  initialIssues,
  states,
  members,
  labels,
  cycles,
  modules,
  canDelete,
  canModerate,
  currentUserId,
  fetchIssues,
}: IssuesViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [quickAddState, setQuickAddState] = useState<string | null>(null);
  /** Anchor for Shift-click range selection. */
  const lastClickedId = useRef<string | null>(null);

  /**
   * Layout, filters and display properties come from one persisted store keyed
   * by project, which is what makes switching layouts preserve the filter set:
   * the four layouts read the same object rather than each holding a copy.
   */
  const stored = useProjectViewStore((store) => store.byProject[projectId]);
  const hydrated = useProjectViewStore((store) => store.hasHydrated);
  const setStoredLayout = useProjectViewStore((store) => store.setLayout);
  const setStoredFilters = useProjectViewStore((store) => store.setFilters);
  const setStoredDisplayProps = useProjectViewStore(
    (store) => store.setDisplayProps,
  );

  // The store is skipHydration (see the sidebar fix): merge localStorage after
  // the first paint so the server HTML and the first client render match.
  useEffect(() => {
    void useProjectViewStore.persist.rehydrate();
  }, []);

  // One channel per open project: issues moved or created in another browser
  // patch the query cache here within a second, with no refetch.
  useProjectRealtime({ projectId, states });

  /**
   * `?create=1` opens the new-issue modal. The command palette lives in the
   * header and has no handle on this component, so it asks through the URL,
   * which is then stripped so a refresh does not reopen the modal.
   */
  useEffect(() => {
    if (searchParams.get("create") !== "1") return;
    setCreateOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  // Before rehydration there is no stored layout or filter set, so the list
  // renders — exactly what the server delivered.
  const layout: IssueLayout = hydrated ? (stored?.layout ?? "list") : "list";
  const displayProps: DisplayProps =
    hydrated ? (stored?.displayProps ?? DEFAULT_DISPLAY_PROPS) : DEFAULT_DISPLAY_PROPS;
  const groupBy = displayProps.groupBy;

  const filters = useMemo(
    () => ((hydrated ? stored?.filters : undefined) ?? {}) as PartialFilters,
    [hydrated, stored?.filters],
  );

  /**
   * groupBy is deliberately absent from the key. Grouping happens in
   * ListLayout from the rows already in hand; the server query ignores it, so
   * putting it in the key would refetch the same rows on every regroup.
   */
  const queryKey = useMemo(
    () => ["issues", projectId, filters] as const,
    [projectId, filters],
  );

  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => value !== undefined),
    [filters],
  );

  const { data: issues = initialIssues } = useQuery({
    queryKey,
    queryFn: () => fetchIssues(filters),
    // The server component already delivered exactly this set, but only for
    // the unfiltered view. Seeding a filtered key with it would show the wrong
    // rows and, worse, count as fresh under staleTime so the fetch never runs.
    initialData: hasFilters ? undefined : initialIssues,
    placeholderData: keepPreviousData,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
    router.refresh();
  }, [queryClient, projectId, router]);

  // View-level shortcuts (docs/06-UX-LAYOUT-SPEC.md §15): C, 1–4, /,
  // Shift+↑/↓, Esc. The hook keeps the target in a ref, so passing a fresh
  // object here is what keeps its closures current between renders.
  useIssueShortcuts({
    onCreateIssue: () => setCreateOpen(true),
    onSwitchLayout: (next) => setStoredLayout(projectId, next),
    onExpandSearch: () =>
      document.getElementById("filter-search")?.focus(),
    onExtendSelection: (direction) => {
      if (issues.length === 0) return;
      const order = issues.map((issue) => issue.id);
      const anchor = lastClickedId.current ?? order[0];
      const from = order.indexOf(anchor);
      if (from === -1) return;
      const to = Math.min(Math.max(from + direction, 0), order.length - 1);
      setSelected((current) => new Set(current).add(order[to]));
      lastClickedId.current = order[to];
    },
    onClearSelection: () => setSelected(new Set()),
  });

  const handleFilterChange = useCallback(
    (next: PartialFilters) => {
      setStoredFilters(projectId, { ...filters, ...next });
    },
    [filters, projectId, setStoredFilters],
  );

  const handleGroupByChange = useCallback(
    (next: IssueFilters["groupBy"]) => {
      setStoredDisplayProps(projectId, { ...displayProps, groupBy: next });
    },
    [displayProps, projectId, setStoredDisplayProps],
  );

  /**
   * The five-step optimistic contract from docs/03-TRD.md §3.1: cancel any
   * in-flight query for this key, snapshot the cache, apply the patch, roll
   * back and toast on error, invalidate on settle.
   */
  const mutate = useMutation({
    mutationFn: async ({
      run,
    }: {
      ids: string[];
      patch: Patch;
      run: () => Promise<{ ok: boolean; error?: string }>;
    }) => {
      const result = await run();
      if (!result.ok) throw new Error(result.error ?? "That did not work.");
      return result;
    },
    onMutate: async ({ ids, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<IssueListItem[]>(queryKey);

      queryClient.setQueryData<IssueListItem[]>(queryKey, (current) =>
        (current ?? []).map((issue) =>
          ids.includes(issue.id) ? patch(issue) : issue,
        ),
      );

      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(
        error instanceof Error ? error.message : "That did not work.",
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const stateOf = useCallback(
    (stateId: string): StateOption | undefined =>
      states.find((state) => state.id === stateId),
    [states],
  );

  /**
   * Memoised because IssueListRow is memoised, and a handler bag rebuilt on
   * every render would defeat that: selecting one row would re-render all two
   * hundred.
   */
  const handlers: IssueRowHandlers = useMemo(
    () => ({
      onOpen: (issueId) => setPeekId(issueId),

      onSelect: (issueId, event) => {
        setSelected((current) => {
          const next = new Set(current);

          if (event.shiftKey && lastClickedId.current) {
            // Range select across the flat, already-grouped order the list is
            // rendered in, so what gets selected is what the eye sees between the
            // two clicks.
            const order = issues.map((issue) => issue.id);
            const from = order.indexOf(lastClickedId.current);
            const to = order.indexOf(issueId);
            if (from !== -1 && to !== -1) {
              const [start, end] = from < to ? [from, to] : [to, from];
              for (const id of order.slice(start, end + 1)) next.add(id);
              return next;
            }
          }

          if (next.has(issueId)) next.delete(issueId);
          else next.add(issueId);
          lastClickedId.current = issueId;
          return next;
        });
      },

      onSetState: (issueId, stateId) => {
        const target = stateOf(stateId);
        mutate.mutate({
          ids: [issueId],
          patch: (issue) => ({
            ...issue,
            stateId,
            stateName: target?.name ?? issue.stateName,
            stateGroup: target?.group ?? issue.stateGroup,
            stateColor: target?.color ?? issue.stateColor,
          }),
          run: () => updateIssue({ issueId, stateId }),
        });
      },

      onSetPriority: (issueId, priority) => {
        mutate.mutate({
          ids: [issueId],
          patch: (issue) => ({ ...issue, priority }),
          run: () => updateIssue({ issueId, priority }),
        });
      },

      onToggleAssignee: (issueId, userId) => {
        const issue = issues.find((row) => row.id === issueId);
        if (!issue) return;

        const current = issue.assignees.map((assignee) => assignee.id);
        const next = current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId];

        const member = members.find((row) => row.userId === userId);

        mutate.mutate({
          ids: [issueId],
          patch: (row) => ({
            ...row,
            assignees: next.map(
              (id) =>
                row.assignees.find((assignee) => assignee.id === id) ?? {
                  id,
                  displayName: member?.displayName ?? "",
                  avatarUrl: member?.avatarUrl ?? null,
                },
            ),
          }),
          run: () => setAssignees({ issueId, userIds: next }),
        });
      },

      onToggleLabel: (issueId, labelId) => {
        const issue = issues.find((row) => row.id === issueId);
        if (!issue) return;

        const current = issue.labels.map((label) => label.id);
        const next = current.includes(labelId)
          ? current.filter((id) => id !== labelId)
          : [...current, labelId];

        mutate.mutate({
          ids: [issueId],
          patch: (row) => ({
            ...row,
            labels: next
              .map((id) => labels.find((label) => label.id === id))
              .filter((label): label is IssueLabelRef => label !== undefined),
          }),
          run: () => setLabels({ issueId, labelIds: next }),
        });
      },

      onArchive: (issueId) => {
        // Archiving removes the row from this view, so the optimistic patch is a
        // removal rather than a field change and the list never refetches whole.
        void (async () => {
          await queryClient.cancelQueries({ queryKey });
          const previous = queryClient.getQueryData<IssueListItem[]>(queryKey);

          queryClient.setQueryData<IssueListItem[]>(queryKey, (current) =>
            (current ?? []).filter((issue) => issue.id !== issueId),
          );

          const result = await archiveIssue({ issueId });

          if (!result.ok) {
            if (previous) queryClient.setQueryData(queryKey, previous);
            toast.error(result.error);
            return;
          }

          toast.success("Issue archived.");
          void queryClient.invalidateQueries({ queryKey });
        })();
      },

      onDelete: (issueId) => {
        void (async () => {
          const result = await deleteIssue({ issueId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Issue deleted.");
          refresh();
        })();
      },
    }),
    [issues, members, labels, stateOf, mutate, queryClient, queryKey, refresh],
  );

  /**
   * A kanban drop. The destination state and both neighbours go in one call, so
   * moving a card across columns is a single write and a single activity row
   * rather than a state change followed by a reorder.
   */
  const handleKanbanMove = useCallback(
    (move: KanbanMove) => {
      const target = stateOf(move.stateId);
      mutate.mutate({
        ids: [move.issueId],
        patch: (issue) => ({
          ...issue,
          stateId: move.stateId,
          stateName: target?.name ?? issue.stateName,
          stateGroup: target?.group ?? issue.stateGroup,
          stateColor: target?.color ?? issue.stateColor,
        }),
        run: () => updateIssueOrder(move),
      });
    },
    [mutate, stateOf],
  );

  const handleReschedule = useCallback(
    (issueId: string, targetDate: string) => {
      mutate.mutate({
        ids: [issueId],
        patch: (issue) => ({ ...issue, targetDate }),
        run: () => updateIssue({ issueId, targetDate }),
      });
    },
    [mutate],
  );

  const selectedIds = [...selected];

  function runBulk(
    payload: Record<string, unknown>,
    patch: Patch,
    message: string,
  ) {
    mutate.mutate({
      ids: selectedIds,
      patch,
      run: async () => {
        const result = await bulkUpdateIssues({
          issueIds: selectedIds,
          ...payload,
        });
        if (result.ok) toast.success(message);
        return result;
      },
    });
    setSelected(new Set());
  }

  return (
    <>
      <FilterBar
        states={states}
        members={members}
        labels={labels}
        cycles={cycles}
        modules={modules}
        filters={filters}
        onChange={handleFilterChange}
        groupBy={groupBy}
        onGroupByChange={handleGroupByChange}
        layout={layout}
        onLayoutChange={(next) => setStoredLayout(projectId, next)}
        displayProps={displayProps}
        onDisplayPropsChange={(next) => setStoredDisplayProps(projectId, next)}
        onSaveView={() => setSaveViewOpen(true)}
      />

      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border-subtle px-4">
        <span className="text-xs text-text-300">
          {issues.length} {issues.length === 1 ? "issue" : "issues"}
        </span>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={14} strokeWidth={1.5} />
          New issue
        </Button>
      </div>

      {issues.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          title={hasFilters ? "Nothing matches those filters" : "No issues yet"}
          description={
            hasFilters
              ? "Remove a filter, or widen the ones you have."
              : "Add the first one from a group below, or open the full form for everything at once."
          }
          action={
            hasFilters ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStoredFilters(projectId, {})}
              >
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                New issue
              </Button>
            )
          }
        />
      ) : null}

      {issues.length > 0 && layout === "list" && (
        <ListLayout
          projectId={projectId}
          issues={issues}
          states={states}
          members={members}
          labels={labels}
          cycles={cycles}
          modules={modules}
          groupBy={groupBy}
          properties={displayProps.properties}
          // Undefined on a display-props object stored before this toggle
          // existed, which is the default anyway.
          showEmptyGroups={displayProps.showEmptyGroups ?? false}
          selectedIds={selected}
          canDelete={canDelete}
          handlers={handlers}
          onCreated={refresh}
        />
      )}

      {issues.length > 0 && layout === "kanban" && (
        <KanbanLayout
          projectId={projectId}
          issues={issues}
          states={states}
          properties={displayProps.properties}
          onOpen={(issueId) => setPeekId(issueId)}
          onMove={handleKanbanMove}
          onQuickAdd={(stateId) => {
            setQuickAddState(stateId);
            setCreateOpen(true);
          }}
        />
      )}

      {issues.length > 0 && layout === "calendar" && (
        <CalendarLayout
          issues={issues}
          onOpen={(issueId) => setPeekId(issueId)}
          onReschedule={handleReschedule}
        />
      )}

      {issues.length > 0 && layout === "spreadsheet" && (
        <SpreadsheetLayout
          issues={issues}
          states={states}
          members={members}
          labels={labels}
          properties={displayProps.properties}
          orderBy={filters.orderBy ?? "sort_order"}
          sortDirection={filters.sortDirection ?? "asc"}
          onSort={(orderBy) =>
            handleFilterChange({
              ...filters,
              orderBy,
              // A second click on the active column reverses it, which is the
              // behaviour every table in every tool has.
              sortDirection:
                filters.orderBy === orderBy && filters.sortDirection === "asc"
                  ? "desc"
                  : "asc",
            })
          }
          handlers={handlers}
        />
      )}

      <BulkActionBar
        count={selected.size}
        states={states}
        members={members}
        labels={labels}
        onSetState={(stateId) => {
          const target = stateOf(stateId);
          runBulk(
            { stateId },
            (issue) => ({
              ...issue,
              stateId,
              stateName: target?.name ?? issue.stateName,
              stateGroup: target?.group ?? issue.stateGroup,
              stateColor: target?.color ?? issue.stateColor,
            }),
            "State updated.",
          );
        }}
        onSetPriority={(priority: IssuePriority) =>
          runBulk(
            { priority },
            (issue) => ({ ...issue, priority }),
            "Priority updated.",
          )
        }
        onAssign={(userId) =>
          runBulk(
            { addAssigneeIds: [userId] },
            (issue) => issue,
            "Assignee added.",
          )
        }
        onAddLabel={(labelId) =>
          runBulk({ addLabelIds: [labelId] }, (issue) => issue, "Label added.")
        }
        onArchive={() =>
          runBulk({ archive: true }, (issue) => issue, "Issues archived.")
        }
        onCancel={() => setSelected(new Set())}
      />

      <SaveViewDialog
        open={saveViewOpen}
        onOpenChange={setSaveViewOpen}
        projectId={projectId}
        filters={filters}
        displayProps={displayProps}
        layout={layout}
        onSaved={() => router.refresh()}
      />

      <IssueCreateModal
        // Keyed so opening it from a different kanban column remounts it with
        // that column's state preselected rather than the first one.
        key={quickAddState ?? "default"}
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) setQuickAddState(null);
        }}
        defaultStateId={quickAddState ?? undefined}
        projectId={projectId}
        states={states}
        members={members}
        labels={labels}
        cycles={cycles}
        modules={modules}
        onCreated={refresh}
      />

      {peekId && (
        <IssuePeekOverlay
          issueId={peekId}
          projectId={projectId}
          states={states}
          members={members}
          labels={labels}
          currentUserId={currentUserId}
          canModerate={canModerate}
          onClose={() => setPeekId(null)}
        />
      )}
    </>
  );
}
