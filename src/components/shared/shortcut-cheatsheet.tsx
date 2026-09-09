"use client";

import { useEffect, useState } from "react";

import { Kbd } from "@/components/shared/kbd";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["⌘", "K"], action: "Command palette" },
  { keys: ["C"], action: "Create issue" },
  { keys: ["⌘", "\\"], action: "Toggle sidebar" },
  { keys: ["/"], action: "Focus filter search" },
  { keys: ["1", "–", "4"], action: "Switch layout (list, kanban, calendar, spreadsheet)" },
  { keys: ["Esc"], action: "Close peek / modal, clear selection" },
  { keys: ["Shift", "↑", "↓"], action: "Extend selection" },
  { keys: ["?"], action: "This cheat sheet" },
];

/** Global `?` cheat sheet (docs/06-UX-LAYOUT-SPEC.md §15). */
export function ShortcutCheatSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "?") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Keyboard shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Shortcuts work across the app shell.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.action}
              className="flex h-7 items-center justify-between gap-4 text-xs text-text-200"
            >
              <span className="truncate">{shortcut.action}</span>
              <Kbd keys={shortcut.keys} />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
