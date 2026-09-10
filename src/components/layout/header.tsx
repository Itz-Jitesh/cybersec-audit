"use client";

import { Menu, Plus, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Kbd } from "@/components/shared/kbd";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { ShortcutCheatSheet } from "@/components/shared/shortcut-cheatsheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavigationTree } from "@/db/queries/navigation";
import type { CurrentUser } from "@/lib/auth/session";
import { useSidebarStore } from "@/stores/sidebar-store";

interface HeaderProps {
  user: CurrentUser;
  tree: NavigationTree;
  unreadCount: number;
  signOutAction: () => Promise<void>;
}

export function Header({
  user,
  tree,
  unreadCount,
  signOutAction,
}: HeaderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [, startTransition] = useTransition();
  const setMobileNavOpen = useSidebarStore((state) => state.setMobileNavOpen);
  const pathname = usePathname();
  const router = useRouter();

  /**
   * "New issue" needs a project. The header outlives any single route, so the
   * project is read from the path, and the button is hidden where there is no
   * project to create an issue in rather than opening a dead dialog.
   */
  const projectId = useMemo(
    () => pathname.match(/^\/projects\/([0-9a-f-]{36})/)?.[1] ?? null,
    [pathname],
  );

  // Cmd/Ctrl+K opens the palette from anywhere in the app shell.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="flex h-header shrink-0 items-center gap-2 border-b border-border-subtle px-3 sm:gap-3 sm:px-4">
      {/* The only way to the navigation below 1024px, where the docked
          sidebar is hidden. 40px square, the touch-target floor. */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
        className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-md text-text-300 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100 lg:hidden"
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      <div className="min-w-0 flex-1">
        <Breadcrumbs tree={tree} />
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search"
        className="flex size-10 shrink-0 items-center justify-center gap-2 rounded-md text-text-300 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100 sm:h-7 sm:w-auto sm:px-2"
      >
        <Search size={14} strokeWidth={1.5} />
        <span className="hidden sm:inline">
          <Kbd keys={["⌘", "K"]} />
        </span>
      </button>

      {projectId && (
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() =>
            router.push(`/projects/${projectId}/issues?create=1`)
          }
        >
          <Plus size={14} strokeWidth={1.5} />
          <span className="hidden sm:inline">New issue</span>
        </Button>
      )}

      <NotificationBell unreadCount={unreadCount} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild aria-label="Account menu">
          <button type="button" className="rounded-full">
            <MemberAvatar user={user} size={24} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm text-text-100">{user.displayName}</p>
            <p className="truncate text-xs text-text-400">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          {/*
            Two-factor enrolment used to be linked here and is not any more.
            src/middleware.ts sends an admin, president or co_president without
            an aal2 session to /mfa on its own, so the route is reached when it
            is needed and the menu entry only offered a screen nobody chooses
            to visit. The route itself is unchanged.

            Sign out is an onSelect handler rather than a <form> inside the
            item: Radix closes the menu on select and unmounts its contents,
            which removed the form before submit could fire.
          */}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await signOutAction();
              });
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutCheatSheet />
    </header>
  );
}
