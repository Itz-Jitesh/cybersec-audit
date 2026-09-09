"use client";

import Link from "@tiptap/extension-link";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import type { MemberRow } from "@/db/queries/project";
import { cn } from "@/lib/utils";

export interface EditorValue {
  html: string;
  json: unknown;
}

interface RichEditorProps {
  content?: unknown;
  placeholder?: string;
  editable?: boolean;
  members?: MemberRow[];
  className?: string;
  /** Called on every keystroke when there is no autosave. */
  onChange?: (value: EditorValue) => void;
  /** When present, changes are saved through this after a quiet period. */
  onAutosave?: (value: EditorValue) => void | Promise<void>;
  autosaveDelay?: number;
}

/**
 * The shared rich text surface: issue descriptions, comments and pages.
 *
 * Both representations are kept. description_json is what the editor reloads
 * from and is the source of truth when editing; description_html is what gets
 * rendered elsewhere and is what the generated search_vector column indexes.
 * Keeping only one would mean either re-rendering on every read or losing
 * fidelity on every edit.
 *
 * The mention node stores the user id in data-mention-id, which is the exact
 * attribute fanout_notifications parses when deciding who to notify.
 */
export function RichEditor({
  content,
  placeholder = "Add a description…",
  editable = true,
  members = [],
  className,
  onChange,
  onAutosave,
  autosaveDelay = 800,
}: RichEditorProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<EditorValue | null>(null);

  /**
   * Callers pass these as inline arrows, so their identity changes on every
   * parent render. Holding them in refs keeps the unmount effect below
   * depending on nothing — otherwise its cleanup ran on every parent render,
   * cancelling the debounce and firing a write each time.
   */
  const onChangeRef = useRef(onChange);
  const onAutosaveRef = useRef(onAutosave);
  onChangeRef.current = onChange;
  onAutosaveRef.current = onAutosave;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // StarterKit ships its own link handling, which would register the
        // same node twice alongside the Link extension configured below.
        link: false,
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        renderHTML({ options, node }) {
          return [
            "span",
            {
              ...options.HTMLAttributes,
              "data-mention-id": node.attrs.id,
            },
            `@${node.attrs.label ?? node.attrs.id}`,
          ];
        },
        suggestion: {
          items: ({ query }) =>
            members
              .filter((member) =>
                member.displayName.toLowerCase().includes(query.toLowerCase()),
              )
              .slice(0, 8)
              .map((member) => ({
                id: member.userId,
                label: member.displayName,
              })),
        },
      }),
    ],
    content: (content as never) ?? "",
    editorProps: {
      attributes: {
        class: cn(
          "prose-none text-text-100 min-h-[80px] text-sm outline-none",
          "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5",
          "[&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-medium [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-medium",
          "[&_a]:text-brand [&_a]:underline",
          "[&_code]:bg-bg-80 [&_code]:rounded-sm [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs",
          "[&_pre]:bg-bg-80 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs",
          "[&_blockquote]:border-border-strong [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-text-300",
          "[&_.mention]:text-brand [&_.mention]:bg-brand-subtle [&_.mention]:rounded-sm [&_.mention]:px-1",
          "[&_.is-editor-empty:first-child::before]:text-text-400 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        ),
      },
    },
    onUpdate: ({ editor: instance }) => {
      const value: EditorValue = {
        html: instance.getHTML(),
        json: instance.getJSON(),
      };
      latest.current = value;
      onChangeRef.current?.(value);

      if (!onAutosaveRef.current) return;

      // Debounced, so a paragraph of typing is one write rather than one per
      // keystroke.
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        if (latest.current) void onAutosaveRef.current?.(latest.current);
      }, autosaveDelay);
    },
  });

  // Flush a pending autosave when the editor goes away, so navigating off does
  // not silently discard the last few seconds of typing.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        if (latest.current) void onAutosaveRef.current?.(latest.current);
      }
    };
  }, []);

  return <EditorContent editor={editor} className={className} />;
}
