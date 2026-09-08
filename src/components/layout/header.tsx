"use client";

import { Bell, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Kbd } from "@/components/shared/kbd";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavigationTree } from "@/db/queries/navigation";
import type { CurrentUser } from "@/lib/auth/session";

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
  // The palette itself is phase 10; this is the shell it will mount into.
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <header className="flex h-header shrink-0 items-center gap-3 border-b border-border-subtle px-4">
      <div className="min-w-0 flex-1">
        <Breadcrumbs tree={tree} />
      </div>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Search"
        className="flex h-7 items-center gap-2 rounded-md px-2 text-text-300 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100"
      >
        <Search size={14} strokeWidth={1.5} />
        <Kbd keys={["⌘", "K"]} />
      </button>

      <Button size="sm" className="gap-1.5">
        <Plus size={14} strokeWidth={1.5} />
        New issue
      </Button>

      <Link
        href="/notifications"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="relative rounded-md p-1.5 text-text-300 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100"
      >
        <Bell size={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-2xs font-medium text-on-brand">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Account menu" className="rounded-full">
          <MemberAvatar user={user} size={24} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm text-text-100">{user.displayName}</p>
            <p className="truncate text-xs text-text-400">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href="/settings/profile">Profile settings</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/mfa">Two-factor authentication</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <form action={signOutAction}>
              <button type="submit" className="w-full text-left">
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Full-text issue search and command mode arrive in phase 10.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </header>
  );
}
