"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IssueListItem } from "@/db/queries/issues";
import { cn } from "@/lib/utils";

/** docs/06-UX-LAYOUT-SPEC.md §7.4: three chips, then "+N more". */
const CHIPS_PER_DAY = 3;

interface CalendarLayoutProps {
  issues: IssueListItem[];
  onOpen: (issueId: string) => void;
  onReschedule: (issueId: string, targetDate: string) => void;
}

/** yyyy-MM-dd, which is also how target_date comes out of Postgres. */
function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function IssueChip({
  issue,
  onOpen,
  draggable = true,
}: {
  issue: IssueListItem;
  onOpen?: (issueId: string) => void;
  draggable?: boolean;
}) {
  const body = (
    <>
      <PriorityIcon priority={issue.priority as IssuePriority} size={14} />
      <span className="min-w-0 flex-1 truncate">{issue.name}</span>
    </>
  );

  if (!draggable) {
    return (
      <span className="flex h-5 items-center gap-1 rounded-sm bg-bg-80 px-1 text-2xs text-text-200">
        {body}
      </span>
    );
  }

  return (
    <DraggableChip issue={issue} onOpen={onOpen}>
      {body}
    </DraggableChip>
  );
}

function DraggableChip({
  issue,
  onOpen,
  children,
}: {
  issue: IssueListItem;
  onOpen?: (issueId: string) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(issue.id)}
      className={cn(
        "flex h-5 w-full items-center gap-1 rounded-sm bg-bg-80 px-1 text-left text-2xs text-text-200",
        "hover:bg-bg-70 hover:text-text-100",
        isDragging && "opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function DayCell({
  date,
  month,
  issues,
  onOpen,
}: {
  date: Date;
  month: Date;
  issues: IssueListItem[];
  onOpen: (issueId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(date) });
  const outside = !isSameMonth(date, month);
  const overflow = issues.length - CHIPS_PER_DAY;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-24 flex-col gap-0.5 border-r border-b border-border-subtle p-1",
        isOver && "bg-brand-subtle",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-2xs",
          isToday(date)
            ? "bg-brand text-on-brand"
            : outside
              ? "text-text-400"
              : "text-text-300",
        )}
      >
        {format(date, "d")}
      </span>

      {issues.slice(0, CHIPS_PER_DAY).map((issue) => (
        <IssueChip key={issue.id} issue={issue} onOpen={onOpen} />
      ))}

      {overflow > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-5 rounded-sm px-1 text-left text-2xs text-text-400 hover:bg-bg-70 hover:text-text-100"
            >
              +{overflow} more
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-60 p-1.5">
            <p className="mb-1.5 px-1 text-2xs text-text-300">
              {format(date, "EEEE d MMMM")}
            </p>
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {issues.slice(CHIPS_PER_DAY).map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => onOpen(issue.id)}
                  className="flex h-6 items-center gap-1 rounded-sm px-1 text-left text-xs text-text-200 hover:bg-bg-70 hover:text-text-100"
                >
                  <PriorityIcon
                    priority={issue.priority as IssuePriority}
                    size={14}
                  />
                  <span className="min-w-0 flex-1 truncate">{issue.name}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/**
 * A month grid keyed on target_date. Issues without one do not appear, which is
 * the honest rendering: a calendar that invents a date for an undated issue is
 * a calendar you cannot trust.
 *
 * Dragging a chip to another cell sets target_date to that day. The drop target
 * id is the day key itself, so the handler needs no lookup.
 */
export function CalendarLayout({
  issues,
  onOpen,
  onReschedule,
}: CalendarLayoutProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, IssueListItem[]>();
    for (const issue of issues) {
      if (!issue.targetDate) continue;
      const key = issue.targetDate.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(issue);
      else map.set(key, [issue]);
    }
    return map;
  }, [issues]);

  const dragging = useMemo(
    () => issues.find((issue) => issue.id === draggingId) ?? null,
    [draggingId, issues],
  );

  const undated = useMemo(
    () => issues.filter((issue) => !issue.targetDate).length,
    [issues],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);
      const { active, over } = event;
      if (!over) return;

      const issueId = String(active.id);
      const nextDate = String(over.id);
      const issue = issues.find((row) => row.id === issueId);

      // Dropping a chip back on the day it came from is not a change.
      if (issue?.targetDate?.slice(0, 10) === nextDate) return;

      onReschedule(issueId, nextDate);
    },
    [issues, onReschedule],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border-subtle px-4">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((current) => subMonths(current, 1))}
          className="rounded-sm p-1 text-text-300 hover:bg-bg-70 hover:text-text-100"
        >
          <ChevronLeft size={14} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((current) => addMonths(current, 1))}
          className="rounded-sm p-1 text-text-300 hover:bg-bg-70 hover:text-text-100"
        >
          <ChevronRight size={14} strokeWidth={1.5} />
        </button>
        <span className="text-sm font-medium text-text-100">
          {format(month, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setMonth(startOfMonth(new Date()))}
          className="rounded-md border border-border-subtle px-2 py-0.5 text-xs text-text-300 hover:border-border-strong hover:text-text-100"
        >
          Today
        </button>
        <span className="flex-1" />
        {undated > 0 && (
          <span className="text-xs text-text-400">
            {undated} without a target date
          </span>
        )}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(event) => setDraggingId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="grid shrink-0 grid-cols-7 border-b border-border-subtle">
          {days.slice(0, 7).map((day) => (
            <span
              key={day.toISOString()}
              className="px-2 py-1.5 text-2xs text-text-300 uppercase"
            >
              {format(day, "EEE")}
            </span>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto border-l border-border-subtle">
          {days.map((day) => (
            <DayCell
              key={day.toISOString()}
              date={day}
              month={month}
              issues={byDay.get(dayKey(day)) ?? []}
              onOpen={onOpen}
            />
          ))}
        </div>

        <DragOverlay>
          {dragging ? (
            <div className="w-40">
              <IssueChip issue={dragging} draggable={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
