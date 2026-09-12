import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import type { notificationType } from "@/db/schema";
import { issues, notifications, profiles, projects } from "@/db/schema";

/**
 * Reads for notifications.
 *
 * notifications rows are private to their recipient — the trigger writes them,
 * the user reads only their own. The userId always comes from the session, so
 * there is no cross-user read path to guard.
 */

const NOTIFICATION_LIMIT = 50;

export interface NotificationRow {
  id: string;
  /** Derived from the enum so a new notification kind cannot be forgotten here. */
  type: (typeof notificationType.enumValues)[number];
  title: string;
  body: string | null;
  issueId: string | null;
  issueName: string | null;
  issueSequenceId: number | null;
  issueIdentifier: string | null;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  readAt: Date | null;
  snoozedTill: Date | null;
  createdAt: Date;
}

export async function getNotifications(
  userId: string,
): Promise<NotificationRow[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      issueId: notifications.issueId,
      issueName: issues.name,
      issueSequenceId: issues.sequenceId,
      issueIdentifier: projects.identifier,
      actorId: notifications.actorId,
      actorName: sql<string>`coalesce(${profiles.displayName}, 'System')`,
      actorAvatarUrl: profiles.avatarUrl,
      readAt: notifications.readAt,
      snoozedTill: notifications.snoozedTill,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.id, notifications.actorId))
    .leftJoin(issues, eq(issues.id, notifications.issueId))
    .leftJoin(projects, eq(projects.id, issues.projectId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(NOTIFICATION_LIMIT);

  return rows;
}

/** Inbox vs snoozed split, computed from the rows already in hand. */
export function splitNotifications(rows: NotificationRow[]): {
  inbox: NotificationRow[];
  snoozed: NotificationRow[];
} {
  const now = new Date();
  const inbox: NotificationRow[] = [];
  const snoozed: NotificationRow[] = [];
  for (const row of rows) {
    if (row.snoozedTill && row.snoozedTill > now) snoozed.push(row);
    else inbox.push(row);
  }
  return { inbox, snoozed };
}

/** Unread inbox count for the bell badge, in SQL. */
export async function getUnreadInboxCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        sql`(${notifications.snoozedTill} is null or ${notifications.snoozedTill} <= now())`,
      ),
    );
  return Number(row?.value ?? 0);
}
