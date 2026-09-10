"use client";

import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  CircleDot,
  Home,
  Plus,
  Settings,
  Star,
} from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { SidebarItem } from "@/components/layout/sidebar-item";
import { SidebarProjectTree } from "@/components/layout/sidebar-project-tree";
import { CreateProjectModal } from "@/components/projects/create-project-modal";
import { MemberAvatar } from "@/components/shared/member-avatar";
import type { NavigationTree } from "@/db/queries/navigation";
import type { MemberRow } from "@/db/queries/project";
import type { CurrentUser } from "@/lib/auth/session";
import { WORKSPACE_NAME } from "@/lib/constants/defaults";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

interface AppSidebarProps {
  user: CurrentUser;
  tree: NavigationTree;
  canCreateProject: boolean;
  workspaceMembers: MemberRow[];
  unreadCount: number;
  inDrawer?: boolean;
}

const PRIMARY_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/my-issues", label: "My Issues", icon: CircleDot },
  { href: "/notifications", label: "Notifications", icon: Bell },
] as const;

export function AppSidebar({
  user,
  tree,
  canCreateProject,
  workspaceMembers,
  unreadCount,
  inDrawer = false,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const hydrated = useSidebarStore((state) => state.hasHydrated);
  // Hydration stays false on the server, so the defaults below (expanded,
  // unfolded) are exactly what the server rendered. Once localStorage merges,
  // these flip to the stored values without touching the server HTML.
  const storedCollapsed = useSidebarStore((state) =>
    hydrated ? state.isCollapsed : false,
  );
  // The drawer is never collapsed: it is already an overlay the user opened
  // on purpose, and a rail inside it would be a control with nothing to do.
  const isCollapsed = inDrawer ? false : storedCollapsed;
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed);
  const toggleSection = useSidebarStore((state) => state.toggleSection);
  // Selected as a value rather than through isExpanded(): that helper is a
  // stable function reference, so subscribing to it meant the sidebar never
  // re-rendered when a section was toggled. See sidebar-project-tree.tsx.
  const favoritesExpanded = useSidebarStore(
    (state) => state.expanded["favorites"] ?? true,
  );

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

  // skipHydration means the stores never merge automatically — pull the
  // localStorage snapshot in after the first paint so the server HTML and
  // the first client render stay identical.
  useEffect(() => {
    void useSidebarStore.persist.rehydrate();
  }, []);

  const favoritesOpen = hydrated && favoritesExpanded;

  return (
    <aside
      className={cn(
        "flex h-dvh shrink-0 flex-col bg-bg-90",
        inDrawer
          ? "w-full"
          : "border-r border-border-subtle transition-[width] duration-[160ms] ease-out",
        !inDrawer && (isCollapsed ? "w-sidebar-collapsed" : "w-sidebar"),
      )}
    >
      {/* Workspace header */}
      <div className="flex h-header shrink-0 items-center px-2">
        <div
          className={cn(
            "flex h-8 items-center gap-2 px-1.5",
            isCollapsed ? "w-8 justify-center px-0" : "w-full",
          )}
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
        </div>
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

        <div className="mt-2">
          <SidebarItem
            href="/admin"
            icon={Settings}
            label="Settings"
            collapsed={isCollapsed}
            isActive={pathname.startsWith("/admin")}
          />
        </div>
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
          hidden={inDrawer}
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
