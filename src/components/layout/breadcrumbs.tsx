"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo } from "react";

import type { NavigationTree } from "@/db/queries/navigation";

const SECTION_LABELS: Record<string, string> = {
  issues: "Issues",
  cycles: "Cycles",
  modules: "Modules",
  views: "Views",
  pages: "Pages",
  analytics: "Analytics",
  settings: "Settings",
};

const ROOT_LABELS: Record<string, string> = {
  home: "Home",
  "my-issues": "My Issues",
  notifications: "Notifications",
  drafts: "Drafts",
  admin: "Admin",
};

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Derived from the path against the navigation tree the shell already loaded,
 * so a breadcrumb costs no extra query. An id with no match in the tree is
 * dropped rather than rendered raw — a uuid in a breadcrumb tells the reader
 * nothing.
 */
function buildCrumbs(pathname: string, tree: NavigationTree): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [];

  const [first, ...rest] = segments;

  if (first === "teams") {
    const team = tree.teams.find((candidate) => candidate.slug === rest[0]);
    return team ? [{ label: team.name }] : [{ label: "Team" }];
  }

  if (first === "projects") {
    const [projectId, section] = rest;
    const team = tree.teams.find((candidate) =>
      candidate.projects.some((project) => project.id === projectId),
    );
    const project = team?.projects.find(
      (candidate) => candidate.id === projectId,
    );

    const crumbs: Crumb[] = [];
    if (team) crumbs.push({ label: team.name, href: `/teams/${team.slug}` });
    if (project) {
      crumbs.push({
        label: project.name,
        href: `/projects/${project.id}/issues`,
      });
    }
    if (section && SECTION_LABELS[section]) {
      crumbs.push({ label: SECTION_LABELS[section] });
    }
    return crumbs;
  }

  return [{ label: ROOT_LABELS[first] ?? first }];
}

export function Breadcrumbs({ tree }: { tree: NavigationTree }) {
  const pathname = usePathname();
  const crumbs = useMemo(() => buildCrumbs(pathname, tree), [pathname, tree]);

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
      {crumbs.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          {index > 0 && (
            <span aria-hidden className="text-sm text-text-400">
              /
            </span>
          )}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="truncate text-sm text-text-200 transition-colors duration-[120ms] ease-out hover:text-text-100"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="truncate text-sm text-text-200">
              {crumb.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
