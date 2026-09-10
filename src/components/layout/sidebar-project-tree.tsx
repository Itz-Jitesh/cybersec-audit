"use client";

import {
  BarChart3,
  Bookmark,
  Box,
  ChevronRight,
  CircleDot,
  FileText,
  Layers,
  RefreshCw,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { SidebarItem } from "@/components/layout/sidebar-item";
import type { NavProject, NavTeam } from "@/db/queries/navigation";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

const PROJECT_SECTIONS = [
  { segment: "issues", label: "Issues", icon: CircleDot },
  { segment: "cycles", label: "Cycles", icon: RefreshCw },
  { segment: "modules", label: "Modules", icon: Layers },
  { segment: "views", label: "Views", icon: Bookmark },
  { segment: "pages", label: "Pages", icon: FileText },
  { segment: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      size={12}
      strokeWidth={1.5}
      className={cn(
        "shrink-0 text-text-400 transition-transform duration-[120ms] ease-out",
        open && "rotate-90",
      )}
    />
  );
}

function ProjectBranch({
  project,
  depth,
  collapsed,
}: {
  project: NavProject;
  depth: 1 | 2;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const toggleSection = useSidebarStore((state) => state.toggleSection);
  /**
   * Selected as a value, not through the store's isExpanded() helper.
   *
   * `useSidebarStore(state => state.isExpanded)` selects a function whose
   * identity never changes, so Zustand saw nothing change when `expanded` was
   * written and never re-rendered: clicking a row updated the store and the
   * tree sat still. Selecting the boolean itself is what subscribes to it.
   *
   * Projects start closed: a team with eight projects would otherwise open to
   * a wall of forty rows.
   */
  const open = useSidebarStore((state) =>
    state.hasHydrated ? (state.expanded[`project:${project.id}`] ?? false) : false,
  );
  const base = `/projects/${project.id}`;

  return (
    <li>
      <SidebarItem
        label={project.name}
        depth={depth}
        collapsed={collapsed}
        isActive={pathname.startsWith(base)}
        onClick={() => toggleSection(`project:${project.id}`)}
        leading={
          collapsed ? undefined : (
            <>
              <Chevron open={open} />
              <span
                aria-hidden
                className="w-4 shrink-0 text-center text-[13px]"
              >
                {project.iconEmoji ?? (
                  <Box size={14} strokeWidth={1.5} className="inline" />
                )}
              </span>
            </>
          )
        }
      />

      {open && !collapsed && (
        <ul>
          {PROJECT_SECTIONS.map((section) => (
            <li key={section.segment}>
              <SidebarItem
                href={`${base}/${section.segment}`}
                icon={section.icon}
                label={section.label}
                depth={2}
                isActive={pathname === `${base}/${section.segment}`}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function SidebarProjectTree({
  teams,
  collapsed,
}: {
  teams: NavTeam[];
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const hydrated = useSidebarStore((state) => state.hasHydrated);
  const expanded = useSidebarStore((state) => state.expanded);
  const toggleSection = useSidebarStore((state) => state.toggleSection);

  return (
    <div className="mt-3">
      {!collapsed && (
        <p className="px-2.5 pb-1 text-2xs font-medium tracking-wide text-text-400 uppercase">
          Teams
        </p>
      )}

      <ul>
        {teams.map((team) => {
          // Before rehydration every section renders expanded, exactly like
          // the server did. Reading stored values any earlier is what
          // produced the hydration mismatch on /home.
          const open = hydrated ? (expanded[`team:${team.id}`] ?? true) : true;

          return (
            <li key={team.id}>
              <SidebarItem
                label={team.name}
                collapsed={collapsed}
                isActive={pathname === `/teams/${team.slug}`}
                onClick={() => toggleSection(`team:${team.id}`)}
                leading={
                  collapsed ? undefined : (
                    <>
                      <Chevron open={open} />
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                    </>
                  )
                }
              />

              {open && !collapsed && (
                <ul>
                  {team.projects.length === 0 ? (
                    <li className="py-1 pl-[34px] text-xs text-text-400">
                      No projects yet
                    </li>
                  ) : (
                    team.projects.map((project) => (
                      <ProjectBranch
                        key={project.id}
                        project={project}
                        depth={1}
                        collapsed={collapsed}
                      />
                    ))
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
