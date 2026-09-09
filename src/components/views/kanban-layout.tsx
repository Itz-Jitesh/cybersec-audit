"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronsLeftRight, Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";

import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { DateChip } from "@/components/shared/date-chip";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { LabelChip } from "@/components/shared/label-chip";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { StateIcon } from "@/components/shared/state-icon";
import type { IssueListItem } from "@/db/queries/issues";
import { cn } from "@/lib/utils";
import type { DisplayProperties } from "@/lib/validators/view";
import { useIssueViewStore } from "@/stores/issue-view-store";

/** docs/06-UX-LAYOUT-SPEC.md §7.3: fifty cards, then a "Load more" row. */
const PAGE_SIZE = 50;

export interface KanbanMove {
  issueId: string;
  stateId: string;
  beforeId: string | null;
  afterId: string | null;
}

interface KanbanLayoutProps {
  projectId: string;
  issues: IssueListItem[];
  states: StateOption[];
  properties: DisplayProperties;
  onOpen: (issueId: string) => void;
  onMove: (move: KanbanMove) => void;
  onQuickAdd: (stateId: string) => void;
}

function IssueCard({
  issue,
  properties,
}: {
  issue: IssueListItem;
  properties: DisplayProperties;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-90 p-2.5">
      <p className="line-clamp-2 text-sm text-text-100">{issue.name}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {properties.id && (
          <IssueIdBadge
            identifier={issue.identifier}
            sequenceId={issue.sequenceId}
          />
        )}
        {properties.priority && (
          <PriorityIcon priority={issue.priority as IssuePriority} size={14} />
        )}
        {properties.labels &&
          issue.labels
            .slice(0, 2)
            .map((label) => <LabelChip key={label.id} label={label} />)}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {properties.dueDate && issue.targetDate && (
          <DateChip
            date={issue.targetDate}
            variant="target"
            isCompleted={
              issue.stateGroup === "completed" ||
              issue.stateGroup === "cancelled"
            }
          />
        )}
        {properties.subIssueCount && issue.subIssueCount > 0 && (
          <span className="text-2xs text-text-400">
            {issue.completedSubIssueCount}/{issue.subIssueCount}
          </span>
        )}
        <span className="flex-1" />
        {properties.assignee && issue.assignees.length > 0 && (
          <AvatarGroup users={issue.assignees} max={3} size={20} />
        )}
      </div>
    </div>
  );
}

const MemoIssueCard = memo(IssueCard);

function SortableCard({
  issue,
  properties,
  onOpen,
}: {
  issue: IssueListItem;
  properties: DisplayProperties;
  onOpen: (issueId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { stateId: issue.stateId } });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(issue.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen(issue.id);
      }}
      className={cn(
        "cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-brand",
        // The original stays in the flow to hold the gap open; the DragOverlay
        // is what the pointer carries.
        isDragging && "opacity-40",
      )}
    >
      <MemoIssueCard issue={issue} properties={properties} />
    </div>
  );
}

function Column({
  state,
  issues,
  projectId,
  properties,
  onOpen,
  onQuickAdd,
}: {
  state: StateOption;
  issues: IssueListItem[];
  projectId: string;
  properties: DisplayProperties;
  onOpen: (issueId: string) => void;
  onQuickAdd: (stateId: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const toggleGroup = useIssueViewStore((store) => store.toggleGroup);
  const hydrated = useIssueViewStore((store) => store.hasHydrated);
  const collapsed = useIssueViewStore((store) =>
    hydrated
      ? (store.collapsed[`${projectId}:kanban`] ?? []).includes(state.id)
      : false,
  );

  const shown = issues.slice(0, limit);
  const ids = useMemo(() => shown.map((issue) => issue.id), [shown]);

  // A collapsed column is a 40px strip. It still has to be a drop target, or
  // folding a column would make it impossible to drag anything into it.
  const { setNodeRef } = useDroppable({
    id: `column:${state.id}`,
    data: { stateId: state.id, isColumn: true },
  });

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggleGroup(`${projectId}:kanban`, state.id)}
        ref={setNodeRef}
        className="flex h-full w-10 shrink-0 flex-col items-center gap-2 rounded-md border border-border-subtle bg-bg-90 py-3 text-text-300 hover:text-text-100"
      >
        <StateIcon group={state.group} color={state.color} size={14} />
        <span className="rounded-full bg-bg-80 px-1.5 text-2xs">
          {issues.length}
        </span>
        <span className="text-xs [writing-mode:vertical-rl]">{state.name}</span>
      </button>
    );
  }

  return (
    <section className="flex h-full w-70 shrink-0 flex-col">
      <header className="flex h-9 shrink-0 items-center gap-2 px-1">
        <StateIcon group={state.group} color={state.color} size={14} />
        <span className="truncate text-xs font-medium text-text-100">
          {state.name}
        </span>
        <span className="rounded-full bg-bg-80 px-1.5 text-2xs font-medium text-text-300">
          {issues.length}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          aria-label={`Add issue to ${state.name}`}
          onClick={() => onQuickAdd(state.id)}
          className="rounded-sm p-1 text-text-400 hover:bg-bg-70 hover:text-text-100"
        >
          <Plus size={13} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={`Collapse ${state.name}`}
          onClick={() => toggleGroup(`${projectId}:kanban`, state.id)}
          className="rounded-sm p-1 text-text-400 hover:bg-bg-70 hover:text-text-100"
        >
          <ChevronsLeftRight size={13} strokeWidth={1.5} />
        </button>
      </header>

      <div
        ref={setNodeRef}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-md bg-bg-90/40 p-1.5"
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {shown.map((issue) => (
            <SortableCard
              key={issue.id}
              issue={issue}
              properties={properties}
              onOpen={onOpen}
            />
          ))}
        </SortableContext>

        {issues.length > shown.length && (
          <button
            type="button"
            onClick={() => setLimit((current) => current + PAGE_SIZE)}
            className="rounded-md border border-dashed border-border-subtle py-1.5 text-xs text-text-300 hover:border-border-strong hover:text-text-100"
          >
            Load {Math.min(PAGE_SIZE, issues.length - shown.length)} more
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * One column per state. Dragging between columns changes state; dragging within
 * one changes sort_order. Both go through the same server action, which takes
 * the destination state and the two neighbours in a single call — so a
 * cross-column drop is one write, not a state change followed by a reorder.
 */
export function KanbanLayout({
  projectId,
  issues,
  states,
  properties,
  onOpen,
  onMove,
  onQuickAdd,
}: KanbanLayoutProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    // Without a distance threshold a click on a card is read as a drag of zero
    // pixels and the card never opens.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const byState = useMemo(() => {
    const map = new Map<string, IssueListItem[]>();
    for (const state of states) map.set(state.id, []);
    for (const issue of issues) {
      const bucket = map.get(issue.stateId);
      if (bucket) bucket.push(issue);
    }
    return map;
  }, [issues, states]);

  const dragging = useMemo(
    () => issues.find((issue) => issue.id === draggingId) ?? null,
    [draggingId, issues],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId === overId) return;

      // The drop target is either a card (insert next to it) or the column
      // itself (append to the end), and the two carry the state id differently.
      const overIsColumn = overId.startsWith("column:");
      const targetStateId = overIsColumn
        ? overId.slice("column:".length)
        : (over.data.current?.stateId as string | undefined);

      if (!targetStateId) return;

      const column = (byState.get(targetStateId) ?? []).filter(
        (issue) => issue.id !== activeId,
      );

      let index: number;
      if (overIsColumn) {
        index = column.length;
      } else {
        const found = column.findIndex((issue) => issue.id === overId);
        if (found === -1) return;
        // Dropping onto a card puts the dragged card where that card was, which
        // means before it when moving down the list is not what the pointer
        // showed. dnd-kit has already shifted the preview, so the index of the
        // hovered card is the destination.
        index = found;
      }

      const before = column[index - 1] ?? null;
      const after = column[index] ?? null;

      onMove({
        issueId: activeId,
        stateId: targetStateId,
        beforeId: before?.id ?? null,
        afterId: after?.id ?? null,
      });
    },
    [byState, onMove],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4">
        {states.map((state) => (
          <Column
            key={state.id}
            state={state}
            projectId={projectId}
            issues={byState.get(state.id) ?? []}
            properties={properties}
            onOpen={onOpen}
            onQuickAdd={onQuickAdd}
          />
        ))}
      </div>

      <DragOverlay>
        {dragging ? (
          <div className="w-70 rotate-1 opacity-95">
            <MemoIssueCard issue={dragging} properties={properties} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
