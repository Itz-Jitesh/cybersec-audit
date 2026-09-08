"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createComment } from "@/actions/comments";
import { type EditorValue,RichEditor } from "@/components/editor/rich-editor";
import { Button } from "@/components/ui/button";
import type { MemberRow } from "@/db/queries/project";

/**
 * Collapsed to a single line until focused, per docs/06-UX-LAYOUT-SPEC.md §8.
 * An always-open editor at the foot of every issue makes a page of comments
 * look unfinished.
 */
export function CommentEditor({
  issueId,
  members,
  onPosted,
}: {
  issueId: string;
  members: MemberRow[];
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<EditorValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-border-subtle text-text-400 hover:border-border-strong w-full rounded-md border px-3 py-2 text-left text-sm transition-colors duration-[120ms] ease-out"
      >
        Leave a comment…
      </button>
    );
  }

  async function post() {
    const html = value?.html ?? "";
    // TipTap renders an empty document as a single empty paragraph.
    if (html.replace(/<[^>]*>/g, "").trim().length === 0) return;

    setSaving(true);
    const result = await createComment({
      issueId,
      contentHtml: html,
      contentJson: value?.json,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setValue(null);
    setEditorKey((key) => key + 1);
    setOpen(false);
    onPosted();
  }

  return (
    <div className="border-border-strong rounded-md border p-2">
      <RichEditor
        key={editorKey}
        members={members}
        placeholder="Write a comment. Use @ to mention someone."
        onChange={setValue}
        className="min-h-[60px]"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setValue(null);
          }}
        >
          Cancel
        </Button>
        <Button size="sm" disabled={saving} onClick={post}>
          {saving ? "Posting…" : "Comment"}
        </Button>
      </div>
    </div>
  );
}
