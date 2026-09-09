"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createView } from "@/actions/views";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  DisplayProps,
  IssueLayout,
  SavedFilters,
} from "@/lib/validators/view";

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  filters: Partial<SavedFilters>;
  displayProps: DisplayProps;
  layout: IssueLayout;
  onSaved: () => void;
}

/**
 * Captures whatever is on screen — filters, display properties and layout — as
 * a named view. docs/06-UX-LAYOUT-SPEC.md §11: "Create view captures the
 * current filter state from wherever you were", which is why this takes the
 * live state as props rather than reading it back from anywhere.
 */
export function SaveViewDialog({
  open,
  onOpenChange,
  projectId,
  filters,
  displayProps,
  layout,
  onSaved,
}: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const [access, setAccess] = useState<"private" | "public">("private");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the view a name.");
      return;
    }

    startTransition(async () => {
      const result = await createView({
        projectId,
        name: trimmed,
        filters,
        displayProps,
        layout,
        access,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("View saved.");
      setName("");
      setAccess("private");
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            Saves the filters, display properties and layout you have right now.
          </DialogDescription>
        </DialogHeader>

        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
          placeholder="High priority, unassigned"
          maxLength={120}
        />

        <div className="flex gap-1.5">
          {(["private", "public"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setAccess(option)}
              className={
                access === option
                  ? "flex-1 rounded-md border border-brand bg-brand-subtle px-2 py-1.5 text-xs capitalize text-brand"
                  : "flex-1 rounded-md border border-border-subtle px-2 py-1.5 text-xs capitalize text-text-300 hover:border-border-strong hover:text-text-100"
              }
            >
              {option}
            </button>
          ))}
        </div>

        <p className="text-xs text-text-400">
          {access === "private"
            ? "Only you will see this view."
            : "Everyone on the project will see this view."}
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save view"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
