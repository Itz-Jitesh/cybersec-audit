"use client";

import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  FileText,
  Home,
  Plus,
  Settings,
  Star,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SidebarItem } from "@/components/layout/sidebar-item";
import { SidebarProjectTree } from "@/components/layout/sidebar-project-tree";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NavigationTree } from "@/db/queries/navigation";
import type { MemberRow } from "@/db/queries/project";
import type { CurrentUser } from "@/lib/auth/session";
import { WORKSPACE_NAME } from "@/lib/constants/defaults";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

interface AppSidebarProps {
  user: CurrentUser;
  tree: NavigationTree;
  canInvite: boolean;
  /** Mirrors the server guard; createProject re-checks it regardless. */
  canCreateProject: boolean;
  workspaceMembers: MemberRow[];
  unreadCount: number;
  signOutAction: () => Promise<void>;
}

const PRIMARY_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/my-issues", label: "My Issues", icon: CircleDot },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/drafts", label: "Drafts", icon: FileText },
] as const;

export function AppSidebar({
  user,
  tree,
  canInvite,
  canCreateProject,
  workspaceMembers,
  unreadCount,
  signOutAction,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const { isCollapsed, toggleCollapsed, isExpanded, toggleSection } =
    useSidebarStore();

  // Cmd+\ matches the shortcut in docs/06-UX-LAYOUT-SPEC.md §1.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "\\" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleCollapsed();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  const favoritesOpen = isExpanded("favorites");

  return (
    <aside
      className={cn(
        "flex h-dvh shrink-0 flex-col border-r border-border-subtle bg-bg-90 transition-[width] duration-[160ms] ease-out",
        isCollapsed ? "w-sidebar-collapsed" : "w-sidebar",
      )}
    >
      {/* Workspace header */}
      <div className="flex h-header shrink-0 items-center px-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-8 items-center gap-2 rounded-sm px-1.5 transition-colors duration-[120ms] ease-out hover:bg-bg-80",
              isCollapsed ? "w-8 justify-center px-0" : "w-full",
            )}
            aria-label="Workspace menu"
          >
            <Image
              src="/brand/logo-mark.svg"
              alt=""
              width={20}
              height={20}
              className="shrink-0 text-text-100"
            />
            {!isCollapsed && (
              <span className="flex-1 truncate text-left text-xs font-medium text-text-100">
                {WORKSPACE_NAME}
              </span>
            )}
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem asChild>
              <a href="/admin">
                <Settings size={14} strokeWidth={1.5} />
                Settings
              </a>
            </DropdownMenuItem>
            {canInvite && (
              <DropdownMenuItem asChild>
                <a href="/admin/invites">
                  <UserPlus size={14} strokeWidth={1.5} />
                  Invite members
                </a>
              </DropdownMenuItem>
            )}
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
      </div>

      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2">
        <ul>
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <SidebarItem
                href={item.href}
                icon={item.icon}
                label={item.label}
                collapsed={isCollapsed}
                isActive={pathname === item.href}
                badge={
                  item.href === "/notifications" && unreadCount > 0 ? (
                    <span className="rounded-full bg-brand px-1.5 text-2xs font-medium text-on-brand">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>

        {!isCollapsed && (
          <div className="mt-3">
            <SidebarItem
              icon={Star}
              label="Favorites"
              onClick={() => toggleSection("favorites")}
            />
            {favoritesOpen && (
              <ul>
                {tree.favoriteProjects.length === 0 ? (
                  <li className="py-1 pl-[34px] text-xs text-text-400">
                    Star a project to pin it here
                  </li>
                ) : (
                  tree.favoriteProjects.map((project) => (
                    <li key={project.id}>
                      <SidebarItem
                        href={`/projects/${project.id}/issues`}
                        label={project.name}
                        depth={1}
                        isActive={pathname.startsWith(
                          `/projects/${project.id}`,
                        )}
                        leading={
                          <span
                            aria-hidden
                            className="w-4 shrink-0 text-center text-[13px]"
                          >
                            {project.iconEmoji ?? "•"}
                          </span>
                        }
                      />
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )}

        <SidebarProjectTree teams={tree.teams} collapsed={isCollapsed} />
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-t border-border-subtle px-2 py-2",
          isCollapsed && "flex-col",
        )}
      >
        <MemberAvatar user={user} size={20} />
        {!isCollapsed && (
          <span className="flex-1 truncate text-xs text-text-200">
            {user.displayName}
          </span>
        )}
        {!isCollapsed && canCreateProject && (
          <button
            type="button"
            aria-label="New project"
            onClick={() => setCreateOpen(true)}
            className="rounded-sm p-1 text-text-300 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100"
          >
            <Plus size={14} strokeWidth={1.5} />
          </button>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar (⌘\\)"}
          className="rounded-sm p-1 text-text-300 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100"
        >
          {isCollapsed ? (
            <ChevronsRight size={14} strokeWidth={1.5} />
          ) : (
            <ChevronsLeft size={14} strokeWidth={1.5} />
          )}
        </button>
      </div>

      <CreateProjectModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        teams={tree.teams.map((team) => ({ id: team.id, name: team.name }))}
        members={workspaceMembers}
      />
    </aside>
  );
}
