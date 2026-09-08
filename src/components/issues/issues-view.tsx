"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDot, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  archiveIssue,
  bulkUpdateIssues,
  deleteIssue,
  setAssignees,
  setLabels,
  updateIssue,
} from "@/actions/issues";
import { BulkActionBar } from "@/components/issues/bulk-action-bar";
import { FilterBar, type PartialFilters } from "@/components/issues/filter-bar";
import { IssueCreateModal } from "@/components/issues/issue-create-modal";
import type { IssueRowHandlers } from "@/components/issues/issue-list-row";
import { IssuePeekOverlay } from "@/components/issues/issue-peek-overlay";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ListLayout } from "@/components/views/list-layout";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";
import type { IssueFilters, IssuePriority } from "@/lib/validators/issue";

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
  const queryClient = useQueryClient();
  // Memoised so the callbacks below do not see a new key on every render.
  const queryKey = useMemo(() => ["issues", projectId] as const, [projectId]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<IssueFilters["groupBy"]>("state");
  const [filters, setFilters] = useState<PartialFilters>({} as PartialFilters);
  /** Anchor for Shift-click range selection. */
  const lastClickedId = useRef<string | null>(null);

  const { data: issues = initialIssues } = useQuery({
    queryKey: [...queryKey, groupBy, filters],
    queryFn: () => fetchIssues({ ...filters, groupBy }),
    initialData: initialIssues,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...queryKey, groupBy, filters] });
    router.refresh();
  }, [queryClient, queryKey, groupBy, filters, router]);

  const handleFilterChange = useCallback(
    (next: PartialFilters) => {
      setFilters((prev: PartialFilters) => ({ ...prev, ...next }));
    },
    [],
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

  function stateOf(stateId: string): StateOption | undefined {
    return states.find((state) => state.id === stateId);
  }

  const handlers: IssueRowHandlers = {
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
  };

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
        onGroupByChange={setGroupBy}
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
          title="No issues yet"
          description="Add the first one from a group below, or open the full form for everything at once."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New issue
            </Button>
          }
        />
      ) : null}

      <ListLayout
        projectId={projectId}
        issues={issues}
        states={states}
        members={members}
        labels={labels}
        cycles={cycles}
        modules={modules}
        groupBy={groupBy}
        selectedIds={selected}
        canDelete={canDelete}
        handlers={handlers}
        onCreated={refresh}
      />

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

      <IssueCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
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
