"use client";

import {
  Bell,
  Box,
  CalendarDays,
  FileText,
  Home,
  LogOut,
  PanelLeft,
  Plus,
  UserCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { signOut } from "@/actions/auth";
import { searchPaletteAction } from "@/actions/search";
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { useSidebarStore } from "@/stores/sidebar-store";

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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toggleCollapsed = useSidebarStore((store) => store.toggleCollapsed);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<PaletteResult>(EMPTY);
  const [isPending, startTransition] = useTransition();

  /**
   * Typing ">" switches to command-only mode, per docs/06-UX-LAYOUT-SPEC.md
   * §13: the entity search stops running and only the action list is offered,
   * filtered by whatever follows the ">".
   */
  const commandMode = query.startsWith(">");
  const commandTerm = commandMode ? query.slice(1).trim().toLowerCase() : "";

  // Debounced server search, 200ms as docs/06-UX-LAYOUT-SPEC.md §13 specifies.
  // Command mode never queries — there is nothing on the server to ask.
  useEffect(() => {
    const term = query.trim();
    if (!term || term.startsWith(">")) {
      setResult(EMPTY);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const parsed = await searchPaletteAction({ query: term });
        if (parsed.ok) setResult(parsed.data as PaletteResult);
      });
    }, 200);
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

  /**
   * The project the palette was opened from, so "Create issue" has somewhere
   * to go. Read from the path rather than passed down, because the palette
   * mounts once in the header and outlives any single route.
   */
  const activeProjectId = useMemo(
    () => pathname.match(/^\/projects\/([0-9a-f-]{36})/)?.[1] ?? null,
    [pathname],
  );

  const actions = useMemo(() => {
    const all = [
      ...(activeProjectId
        ? [
            {
              id: "create-issue",
              label: "Create issue",
              icon: Plus,
              run: () =>
                go(`/projects/${activeProjectId}/issues?create=1`),
            },
          ]
        : []),
      { id: "go-home", label: "Go to home", icon: Home, run: () => go("/home") },
      {
        id: "go-my-issues",
        label: "Go to my issues",
        icon: UserCircle,
        run: () => go("/my-issues"),
      },
      {
        id: "go-notifications",
        label: "Go to notifications",
        icon: Bell,
        run: () => go("/notifications"),
      },
      {
        id: "toggle-sidebar",
        label: "Toggle sidebar",
        icon: PanelLeft,
        run: () => {
          onOpenChange(false);
          toggleCollapsed();
        },
      },
      {
        id: "sign-out",
        label: "Sign out",
        icon: LogOut,
        run: () => {
          onOpenChange(false);
          void signOut();
        },
      },
    ];
    return commandMode
      ? all.filter((action) => action.label.toLowerCase().includes(commandTerm))
      : all;
    // `go` is stable enough for this list: it only closes and pushes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, commandMode, commandTerm, onOpenChange, toggleCollapsed]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        aria-label="Search the workspace"
        placeholder="Search issues, cycles, modules and pages — or type > for commands"
        value={query}
        onValueChange={setQuery}
      />
      {isPending && query.trim() ? (
        <p className="px-3 py-2 text-xs text-text-400">Searching…</p>
      ) : null}
      {!commandMode && query.trim() && !isPending && total === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-text-400">
          No matches for “{query.trim()}”
        </p>
      ) : null}
      {!commandMode && result.issues.length > 0 && (
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
      {!commandMode && result.cycles.length > 0 && (
        <CommandGroup heading="Cycles">
          {result.cycles.map((cycle) => (
            <CommandItem
              key={cycle.id}
              value={cycle.name}
              onSelect={() =>
                go(`/projects/${cycle.projectId}/cycles/${cycle.id}`)
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
      {!commandMode && result.modules.length > 0 && (
        <CommandGroup heading="Modules">
          {result.modules.map((module) => (
            <CommandItem
              key={module.id}
              value={module.name}
              onSelect={() =>
                go(`/projects/${module.projectId}/modules/${module.id}`)
              }
            >
              <Box size={13} strokeWidth={1.5} />
              <span className="truncate text-xs text-text-100">
                {module.name}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {!commandMode && result.pages.length > 0 && (
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
      {actions.length > 0 && (
        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={`> ${action.label}`}
              onSelect={action.run}
            >
              <action.icon size={13} strokeWidth={1.5} />
              <span className="truncate text-xs text-text-100">
                {action.label}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandDialog>
  );
}