"use client";

import { useEffect, useRef } from "react";

import type { IssueLayout } from "@/lib/validators/view";

const LAYOUT_KEYS: Record<string, IssueLayout> = {
  "1": "list",
  "2": "kanban",
  "3": "calendar",
  "4": "spreadsheet",
};

interface ShortcutTarget {
  onExpandSearch: () => void;
  onCreateIssue: () => void;
  onSwitchLayout: (layout: IssueLayout) => void;
  onExtendSelection: (direction: 1 | -1) => void;
  onClearSelection: () => void;
}

/**
 * The event targets an editable field or an open overlay (dialog, popover,
 * dropdown) — shortcuts like C and 1–4 must not fire while typing or inside
 * the command palette.
 */
function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function isOverlayOpen(): boolean {
  return document.querySelector("[role='dialog'][data-state='open']") !== null;
}

/**
 * Keyboard shortcuts from docs/06-UX-LAYOUT-SPEC.md §15 that belong to the
 * issue view: C (create), 1–4 (layout), / (focus search), Shift+↑/↓ (extend
 * selection) and Esc (clear selection). Global ones — Cmd+K, Cmd+\, ? — live
 * in the header and cheat sheet respectively.
 */
export function useIssueShortcuts(target: ShortcutTarget) {
  // A ref keeps the handlers current without resubscribing on every render.
  const ref = useRef(target);
  ref.current = target;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const t = ref.current;

      if (event.key === "Escape") {
        t.onClearSelection();
        return;
      }
      if (isTypingContext(event.target) || isOverlayOpen()) return;

      if (event.key === "c" || event.key === "C") {
        event.preventDefault();
        t.onCreateIssue();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        t.onExpandSearch();
        return;
      }
      if (LAYOUT_KEYS[event.key] !== undefined) {
        event.preventDefault();
        t.onSwitchLayout(LAYOUT_KEYS[event.key]);
        return;
      }
      if (event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        t.onExtendSelection(event.key === "ArrowDown" ? 1 : -1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
