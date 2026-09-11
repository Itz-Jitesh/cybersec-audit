"use client";

import { formatDistanceToNow } from "date-fns";
import { BellOff, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  snoozeNotification,
  unsnoozeNotification,
} from "@/actions/notifications";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import type { NotificationRow } from "@/db/queries/notifications";
import { cn } from "@/lib/utils";

function Row({
  row,
  snoozed,
}: {
  row: NotificationRow;
  snoozed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unread = row.readAt === null;

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const body = (
    <div
      className={cn(
        "flex gap-3 border-b border-border-subtle px-4 py-3 transition-colors",
        unread && "bg-bg-80",
      )}
    >
      <MemberAvatar
        user={{
          id: row.actorId,
          displayName: row.actorName,
          avatarUrl: row.actorAvatarUrl,
        }}
        size={24}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-text-100">
          <span className="font-medium">{row.actorName}</span> {row.title}
        </p>
        {row.body && (
          <p className="mt-0.5 line-clamp-2 text-2xs text-text-300">{row.body}</p>
        )}
        <p className="mt-1 text-2xs text-text-400">
          {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {!snoozed && unread && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label="Mark read"
            onClick={() => void run(() => markNotificationRead({ notificationId: row.id }))}
          >
            <Check size={13} strokeWidth={1.5} />
          </Button>
        )}
        {!snoozed && !unread && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label="Mark unread"
            onClick={() => void run(() => markNotificationUnread({ notificationId: row.id }))}
          >
            <BellOff size={13} strokeWidth={1.5} />
          </Button>
        )}
        {!snoozed ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label="Snooze for 24 hours"
            onClick={() => void run(() => snoozeNotification({ notificationId: row.id, hours: 24 }))}
          >
            <Clock size={13} strokeWidth={1.5} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => unsnoozeNotification({ notificationId: row.id }))}
          >
            Unsnooze
          </Button>
        )}
      </div>
    </div>
  );

  if (row.issueId) {
    const slug =
      row.issueIdentifier && row.issueSequenceId
        ? `${row.issueIdentifier}-${row.issueSequenceId}`
        : null;
    return (
      <Link
        href={`/projects?issue=${row.issueId}`}
        className="block hover:bg-bg-80/50"
        title={slug ?? row.issueName ?? undefined}
      >
        {body}
      </Link>
    );
  }
  return body;
}

export function NotificationsClient({
  inbox,
  snoozed,
}: {
  inbox: NotificationRow[];
  snoozed: NotificationRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xs font-medium uppercase tracking-wide text-text-400">
          Inbox · {inbox.length}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending || inbox.length === 0}
          onClick={() =>
            startTransition(async () => {
              await markAllNotificationsRead();
              router.refresh();
            })
          }
        >
          Mark all read
        </Button>
      </div>
      <div className="mt-2 overflow-hidden rounded-md border border-border-subtle">
        {inbox.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-text-400">
            You are all caught up.
          </p>
        ) : (
          inbox.map((row) => <Row key={row.id} row={row} snoozed={false} />)
        )}
      </div>

      {snoozed.length > 0 && (
        <>
          <h2 className="mt-6 text-2xs font-medium uppercase tracking-wide text-text-400">
            Snoozed · {snoozed.length}
          </h2>
          <div className="mt-2 overflow-hidden rounded-md border border-border-subtle">
            {snoozed.map((row) => (
              <Row key={row.id} row={row} snoozed />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
