"use client";

import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { listNotificationsAction } from "@/actions/notifications";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { NotificationRow } from "@/db/queries/notifications";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * The inbox popover behind the header bell. Rows load on first open rather
 * than on every shell render, so the layout stays one query lighter.
 */
export function NotificationBell({
  unreadCount,
}: {
  user: CurrentUser;
  unreadCount: number;
}) {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  const load = () => {
    if (rows !== null) return;
    startTransition(async () => {
      const result = await listNotificationsAction();
      if (result.ok) setRows(result.data);
    });
  };

  return (
    <Popover onOpenChange={(open) => open && load()}>
      <PopoverTrigger
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
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
          <p className="text-xs font-medium text-text-100">Notifications</p>
          <Link
            href="/notifications"
            className="text-2xs text-text-300 underline underline-offset-2 hover:text-text-100"
          >
            View all
          </Link>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {rows === null ? (
            <p className="px-3 py-6 text-center text-xs text-text-400">
              {pending ? "Loading…" : "No notifications."}
            </p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-text-400">
              You are all caught up.
            </p>
          ) : (
            rows.slice(0, 8).map((row) => (
              <Link
                key={row.id}
                href={row.issueId ? `/my-issues?issue=${row.issueId}` : "/notifications"}
                className="flex gap-2.5 border-b border-border-subtle px-3 py-2.5 last:border-b-0 hover:bg-bg-80/50"
              >
                <MemberAvatar
                  user={{
                    id: row.actorId,
                    displayName: row.actorName,
                    avatarUrl: row.actorAvatarUrl,
                  }}
                  size={20}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-text-100">
                    <span className="font-medium">{row.actorName}</span>{" "}
                    {row.title}
                  </p>
                  <p className="mt-0.5 text-2xs text-text-400">
                    {formatDistanceToNow(row.createdAt, { addSuffix: true })}
                  </p>
                </div>
                {row.readAt === null && (
                  <span
                    aria-label="Unread"
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                  />
                )}
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
