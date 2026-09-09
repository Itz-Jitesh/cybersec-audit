"use client";

import { Box, CalendarDays, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { searchPaletteAction } from "@/actions/search";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import type { CurrentUser } from "@/lib/auth/session";

interface PaletteResult {
  issues: {
    id: string;
    name: string;
    sequenceId: number;
    identifier: string;
    projectId: string;
    stateColor: string;
  }[];
  cycles: { id: string; name: string; projectId: string }[];
  modules: { id: string; name: string; projectId: string }[];
  pages: { id: string; title: string; projectId: string }[];
}

const EMPTY: PaletteResult = {
  issues: [],
  cycles: [],
  modules: [],
  pages: [],
};

/**
 * The workspace-wide search palette.
 *
 * Opens on ⌘K (the listener lives in the header, which owns the open state),
 * queries the palette action with one debounced round trip per keystroke, and
 * renders the four searchable entity kinds grouped. Rows navigate.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  _user?: CurrentUser;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PaletteResult>(EMPTY);
  const [isPending, startTransition] = useTransition();

  // Debounced server search. 120ms matches the filter bar's debounce.
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResult(EMPTY);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const parsed = await searchPaletteAction({ query: term });
        if (parsed.ok) setResult(parsed.data as PaletteResult);
      });
    }, 120);
    return () => clearTimeout(timer);
  }, [query]);

  // Reopen in a clean state.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResult(EMPTY);
    }
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const total =
    result.issues.length +
    result.cycles.length +
    result.modules.length +
    result.pages.length;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        aria-label="Search the workspace"
        placeholder="Search issues, cycles, modules and pages…"
        value={query}
        onValueChange={setQuery}
      />
      {isPending && query.trim() ? (
        <p className="px-3 py-2 text-xs text-text-400">Searching…</p>
      ) : null}
      {query.trim() && !isPending && total === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-text-400">
          No matches for “{query.trim()}”
        </p>
      ) : null}
      {result.issues.length > 0 && (
        <CommandGroup heading="Issues">
          {result.issues.map((issue) => (
            <CommandItem
              key={issue.id}
              value={`${issue.identifier} ${issue.name}`}
              onSelect={() =>
                go(`/projects/${issue.projectId}/issues/${issue.id}`)
              }
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: issue.stateColor }}
              />
              <span className="truncate text-xs text-text-100">
                {issue.identifier} {issue.name}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {result.cycles.length > 0 && (
        <CommandGroup heading="Cycles">
          {result.cycles.map((cycle) => (
            <CommandItem
              key={cycle.id}
              value={cycle.name}
              onSelect={() =>
                // Cycle detail pages arrive with the cycle UI; the list page
                // is the meaningful destination until then.
                go(`/projects/${cycle.projectId}/cycles`)
              }
            >
              <CalendarDays size={13} strokeWidth={1.5} />
              <span className="truncate text-xs text-text-100">
                {cycle.name}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {result.modules.length > 0 && (
        <CommandGroup heading="Modules">
          {result.modules.map((module) => (
            <CommandItem
              key={module.id}
              value={module.name}
              onSelect={() => go(`/projects/${module.projectId}/modules`)}
            >
              <Box size={13} strokeWidth={1.5} />
              <span className="truncate text-xs text-text-100">
                {module.name}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {result.pages.length > 0 && (
        <CommandGroup heading="Pages">
          {result.pages.map((page) => (
            <CommandItem
              key={page.id}
              value={page.title}
              onSelect={() => go(`/projects/${page.projectId}/pages`)}
            >
              <FileText size={13} strokeWidth={1.5} />
              <span className="truncate text-xs text-text-100">
                {page.title}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandDialog>
  );
}