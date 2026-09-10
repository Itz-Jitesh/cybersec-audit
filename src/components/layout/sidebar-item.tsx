"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SidebarItemProps {
  href?: string;
  icon?: LucideIcon;
  label: string;
  depth?: 0 | 1 | 2;
  isActive?: boolean;
  collapsed?: boolean;
  badge?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}

/**
 * One 28px row. Renders as a link when it navigates and a button when it only
 * expands something, so keyboard and screen-reader behaviour matches what the
 * row actually does.
 *
 * Indentation is padding rather than margin so the hover and active surfaces
 * still span the full width of the rail at every depth.
 */
export function SidebarItem({
  href,
  icon: Icon,
  label,
  depth = 0,
  isActive = false,
  collapsed = false,
  badge,
  leading,
  trailing,
  onClick,
}: SidebarItemProps) {
  const className = cn(
    "group flex h-7 w-full items-center gap-2 rounded-sm pr-1.5 text-xs transition-colors duration-[120ms] ease-out",
    isActive
      ? "bg-bg-70 text-text-100 shadow-[inset_2px_0_0_0_var(--accent)]"
      : "text-text-200 hover:bg-bg-80 hover:text-text-100",
    collapsed && "justify-center gap-0 pr-0",
  );

  const style = collapsed ? undefined : { paddingLeft: 10 + depth * 12 };

  const content = (
    <>
      {leading}
      {Icon && (
        <Icon
          size={16}
          strokeWidth={1.5}
          className={cn(
            "shrink-0",
            isActive ? "text-text-100" : "text-text-300",
          )}
        />
      )}
      {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!collapsed && badge}
      {!collapsed && trailing}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        aria-current={isActive ? "page" : undefined}
        className={className}
        style={style}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}
