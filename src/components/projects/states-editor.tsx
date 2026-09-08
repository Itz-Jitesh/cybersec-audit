"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createState,
  deleteState,
  reorderState,
  updateState,
} from "@/actions/projects";
import { ColorPicker } from "@/components/projects/color-picker";
import { InlineEditableText } from "@/components/shared/inline-editable-text";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/lib/validators/project";

export interface EditableState {
  id: string;
  name: string;
  group: StateGroup;
  color: string;
  sequence: number;
  isDefault: boolean;
}

/**
 * Keeps a dragged row on its own axis. Written here rather than pulled from
 * @dnd-kit/modifiers, which is a separate package and not among the two this
 * phase is allowed to add.
 */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

const GROUPS: StateGroup[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
];

const GROUP_LABELS: Record<StateGroup, string> = {
  backlog: "Backlog",
  unstarted: "Unstarted",
  started: "Started",
  completed: "Completed",
  cancelled: "Cancelled",
};

function StateRow({
  state,
  canDelete,
  onChanged,
}: {
  state: EditableState;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: state.id });

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      onChanged();
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 border-b border-border-subtle px-2 py-2 last:border-b-0",
        isDragging && "bg-bg-80 opacity-90 shadow-lg",
        pending && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={`Reorder ${state.name}`}
        className="cursor-grab text-text-400 hover:text-text-200 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} strokeWidth={1.5} />
      </button>

      <StateIcon group={state.group} color={state.color} size={16} />

      <span className="min-w-0 flex-1 text-sm text-text-100">
        <InlineEditableText
          value={state.name}
          onSave={(name) =>
            new Promise<void>((resolve) => {
              run(async () => {
                const result = await updateState({ stateId: state.id, name });
                resolve();
                return result;
              });
            })
          }
        />
      </span>

      <Select
        value={state.group}
        onValueChange={(group) =>
          run(() =>
            updateState({ stateId: state.id, group: group as StateGroup }),
          )
        }
      >
        <SelectTrigger size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUPS.map((group) => (
            <SelectItem key={group} value={group}>
              {GROUP_LABELS[group]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ColorPicker
        label={`Colour for ${state.name}`}
        value={state.color}
        onChange={(color) =>
          run(() => updateState({ stateId: state.id, color }))
        }
      />

      <button
        type="button"
        aria-label={
          state.isDefault
            ? `${state.name} is the default state`
            : `Make ${state.name} the default state`
        }
        title="Default state for new issues"
        disabled={state.isDefault}
        onClick={() =>
          run(() => updateState({ stateId: state.id, isDefault: true }))
        }
        className={cn(
          "rounded-sm p-1 transition-colors duration-[120ms] ease-out",
          state.isDefault
            ? "text-warning"
            : "text-text-400 hover:bg-bg-70 hover:text-text-200",
        )}
      >
        <Star
          size={14}
          strokeWidth={1.5}
          className={state.isDefault ? "fill-current" : undefined}
        />
      </button>

      <button
        type="button"
        aria-label={`Delete ${state.name}`}
        disabled={!canDelete}
        onClick={() => run(() => deleteState({ stateId: state.id }))}
        className="rounded-sm p-1 text-text-400 transition-colors duration-[120ms] ease-out hover:bg-bg-70 hover:text-danger disabled:opacity-40"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </li>
  );
}

export function StatesEditor({
  projectId,
  states: initial,
  onRefresh,
}: {
  projectId: string;
  states: EditableState[];
  onRefresh: () => void;
}) {
  const [states, setStates] = useState(initial);
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // dnd-kit's keyboard sensor is what makes a drag reachable without a
    // mouse; docs/05-DESIGN-SYSTEM.md §7 requires it and it must not be removed.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = states.findIndex((state) => state.id === active.id);
    const to = states.findIndex((state) => state.id === over.id);
    if (from === -1 || to === -1) return;

    const next = arrayMove(states, from, to);
    setStates(next);

    const beforeId = next[to - 1]?.id ?? null;
    const afterId = next[to + 1]?.id ?? null;

    const result = await reorderState({
      stateId: String(active.id),
      beforeId,
      afterId,
    });

    if (!result.ok) {
      setStates(states);
      toast.error(result.error);
      return;
    }

    onRefresh();
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={states.map((state) => state.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul>
              {states.map((state) => (
                <StateRow
                  key={state.id}
                  state={state}
                  canDelete={states.length > 1 && !state.isDefault}
                  onChanged={onRefresh}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="mt-3 gap-1.5"
        disabled={adding}
        onClick={async () => {
          setAdding(true);
          const result = await createState({
            projectId,
            name: "New state",
            group: "unstarted",
            color: PALETTE[0],
          });
          setAdding(false);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          onRefresh();
        }}
      >
        <Plus size={14} strokeWidth={1.5} />
        Add state
      </Button>
    </div>
  );
}
