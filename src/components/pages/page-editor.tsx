"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { updatePage } from "@/actions/pages";
import type { EditorValue } from "@/components/editor/rich-editor";
import { Switch } from "@/components/ui/switch";
import type { MemberRow } from "@/db/queries/project";

/** Same reason as the issue detail: TipTap is the bulk of this route's JS. */
const RichEditor = dynamic(
  () => import("@/components/editor/rich-editor").then((m) => m.RichEditor),
  { ssr: false },
);

interface PageEditorProps {
  pageId: string;
  initialTitle: string;
  initialContent: unknown;
  initialAccess: "private" | "public";
  members: MemberRow[];
  canEdit: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const SAVE_TEXT: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Not saved",
};

/**
 * The page editor: a title input over a full-width TipTap surface, autosaving.
 *
 * The title saves on blur rather than on every keystroke, because a title is
 * short and a request per character would be pure noise; the body goes through
 * the editor's own debounce.
 */
export function PageEditor({
  pageId,
  initialTitle,
  initialContent,
  initialAccess,
  members,
  canEdit,
}: PageEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [access, setAccess] = useState(initialAccess);
  const [state, setState] = useState<SaveState>("idle");

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      setState("saving");
      const result = await updatePage({ pageId, ...patch });
      if (!result.ok) {
        setState("error");
        toast.error(result.error ?? "Could not save the page.");
        return;
      }
      setState("saved");
    },
    [pageId],
  );

  const onAutosave = useCallback(
    async (value: EditorValue) => {
      await save({ contentHtml: value.html, contentJson: value.json });
    },
    [save],
  );

  return (
    <div className="mx-auto w-full max-w-[800px] px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs text-text-300">{SAVE_TEXT[state]}</span>
        {canEdit && (
          <label className="flex items-center gap-2 text-2xs text-text-300">
            <Switch
              checked={access === "public"}
              onCheckedChange={(next) => {
                const value = next ? "public" : "private";
                setAccess(value);
                void save({ access: value });
              }}
            />
            Visible to everyone on the project
          </label>
        )}
      </div>

      <input
        value={title}
        readOnly={!canEdit}
        maxLength={200}
        aria-label="Page title"
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          const trimmed = title.trim();
          if (trimmed.length === 0 || trimmed === initialTitle) return;
          void save({ title: trimmed }).then(() => router.refresh());
        }}
        className="mt-3 w-full border-0 bg-transparent text-2xl font-medium text-text-100 outline-none placeholder:text-text-400"
        placeholder="Untitled"
      />

      <div className="mt-4">
        <RichEditor
          content={initialContent}
          editable={canEdit}
          members={members}
          placeholder={canEdit ? "Start writing…" : ""}
          onAutosave={canEdit ? onAutosave : undefined}
        />
      </div>
    </div>
  );
}
