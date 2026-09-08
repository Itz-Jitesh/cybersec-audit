"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface InlineEditableTextProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}

/**
 * Click-to-edit text used for titles throughout the app. The static and editing
 * states share the same typography and box model, so switching between them
 * causes no layout shift — which is what makes it feel like editing the text
 * rather than opening a form.
 *
 * Enter saves on a single line, Escape restores the original value, and blur
 * saves. An empty value is rejected and reverts, because every title in this
 * product is required.
 */
export function InlineEditableText({
  value,
  onSave,
  className,
  multiline = false,
  placeholder,
}: InlineEditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  async function commit() {
    const next = draft.trim();

    if (next.length === 0 || next === value) {
      setDraft(value);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(next);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save inline text", error);
      setDraft(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  function cancel() {
    setDraft(value);
    setIsEditing(false);
  }

  const shared = cn(
    "w-full resize-none border-0 bg-transparent p-0 text-inherit outline-none",
    "placeholder:text-text-400",
    isSaving && "pointer-events-none opacity-60",
    className,
  );

  if (!isEditing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => setIsEditing(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsEditing(true);
          }
        }}
        className={cn(
          "-mx-1 cursor-text rounded-sm px-1 transition-colors duration-[120ms] ease-out hover:bg-bg-80",
          value.length === 0 && "text-text-400",
          className,
        )}
      >
        {value.length > 0 ? value : (placeholder ?? "")}
      </span>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={(node) => {
          inputRef.current = node;
        }}
        value={draft}
        disabled={isSaving}
        placeholder={placeholder}
        rows={1}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancel();
          }
        }}
        className={cn(shared, "-mx-1 px-1")}
      />
    );
  }

  return (
    <input
      ref={(node) => {
        inputRef.current = node;
      }}
      type="text"
      value={draft}
      disabled={isSaving}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void commit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      }}
      className={cn(shared, "-mx-1 px-1")}
    />
  );
}
