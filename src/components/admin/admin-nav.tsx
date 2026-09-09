"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/admin", label: "General" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/teams", label: "Teams" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

/**
 * The admin panel's own left nav (docs/06-UX-LAYOUT-SPEC.md §14). It lives
 * inside the content area rather than in the app sidebar, so the workspace
 * navigation stays put while moving between admin sections.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-44 shrink-0">
      <ul className="flex flex-col gap-0.5">
        {SECTIONS.map((section) => {
          const active =
            section.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={cn(
                  "flex h-7 items-center rounded-md px-2 text-xs transition-colors duration-[120ms] ease-out",
                  active
                    ? "bg-bg-80 text-text-100"
                    : "text-text-300 hover:bg-bg-80/60 hover:text-text-100",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
