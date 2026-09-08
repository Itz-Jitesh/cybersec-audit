"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { createIssue } from "@/actions/issues";
import { cn } from "@/lib/utils";

/**
 * A single line appended to each group. Enter submits and keeps focus, because
 * the point of it is entering ten issues in a row without touching the mouse;
 * the input clears immediately so typing never waits on the round trip.
 */
export function IssueQuickAdd({
  projectId,
  stateId,
  onCreated,
}: {
  projectId: string;
  stateId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const name = value.trim();
    if (name.length === 0) return;

    setValue("");

    const result = await createIssue({ projectId, stateId, name });

    if (!result.ok) {
      toast.error(result.error);
      // Handing the text back rather than losing it, since the person still
      // wants the issue they just described.
      setValue(name);
      return;
    }

    onCreated();
    inputRef.current?.focus();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex h-row w-full items-center gap-2 px-3 text-sm text-text-400 transition-colors duration-[120ms] ease-out hover:bg-bg-90 hover:text-text-200"
      >
        <Plus size={14} strokeWidth={1.5} />
        New issue
      </button>
    );
  }

  return (
    <div className={cn("flex h-row items-center gap-2 px-3")}>
      <Plus size={14} strokeWidth={1.5} className="shrink-0 text-text-400" />
      <input
        ref={inputRef}
        value={value}
        placeholder="Issue title, then Enter"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
          if (event.key === "Escape") {
            setValue("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (value.trim().length === 0) setOpen(false);
        }}
        className="flex-1 bg-transparent text-sm text-text-100 outline-none placeholder:text-text-400"
      />
    </div>
  );
}
