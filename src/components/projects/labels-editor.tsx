"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createLabel, deleteLabel, updateLabel } from "@/actions/projects";
import { ColorPicker } from "@/components/projects/color-picker";
import { InlineEditableText } from "@/components/shared/inline-editable-text";
import { LabelChip } from "@/components/shared/label-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PALETTE } from "@/lib/validators/project";

export interface EditableLabel {
  id: string;
  name: string;
  color: string;
}

function LabelRow({
  label,
  onRefresh,
}: {
  label: EditableLabel;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      onRefresh();
    });
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0",
        pending && "opacity-60",
      )}
    >
      <LabelChip label={label} />

      <span className="min-w-0 flex-1 text-sm text-text-200">
        <InlineEditableText
          value={label.name}
          onSave={(name) =>
            new Promise<void>((resolve) => {
              run(async () => {
                const result = await updateLabel({ labelId: label.id, name });
                resolve();
                return result;
              });
            })
          }
        />
      </span>

      <ColorPicker
        label={`Colour for ${label.name}`}
        value={label.color}
        onChange={(color) =>
          run(() => updateLabel({ labelId: label.id, color }))
        }
      />

      <button
        type="button"
        aria-label={`Delete ${label.name}`}
        onClick={() => run(() => deleteLabel({ labelId: label.id }))}
        className="rounded-sm p-1 text-text-400 transition-colors duration-[120ms] ease-out hover:bg-bg-70 hover:text-danger"
      >
        <Trash2 size={14} strokeWidth={1.5} />
      </button>
    </li>
  );
}

export function LabelsEditor({
  projectId,
  labels,
  onRefresh,
}: {
  projectId: string;
  labels: EditableLabel[];
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PALETTE[2]);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (name.trim().length === 0) return;
    setSaving(true);
    const result = await createLabel({ projectId, name: name.trim(), color });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setName("");
    onRefresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-bg-90 px-3 py-2.5">
        <Input
          value={name}
          placeholder="New label name"
          className="w-56"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void add();
            }
          }}
        />
        <ColorPicker
          label="Colour for the new label"
          value={color}
          onChange={setColor}
        />
        <Button
          size="sm"
          className="gap-1.5"
          disabled={saving || name.trim().length === 0}
          onClick={add}
        >
          <Plus size={14} strokeWidth={1.5} />
          Add label
        </Button>
      </div>

      {labels.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-lg border border-border-subtle">
          {labels.map((label) => (
            <LabelRow key={label.id} label={label} onRefresh={onRefresh} />
          ))}
        </ul>
      )}
    </div>
  );
}
