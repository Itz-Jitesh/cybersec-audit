"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  type ActionResult,
  fail,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import { db } from "@/db";
import { getNotifications } from "@/db/queries/notifications";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Notification state changes.
 *
 * No assertCan here: the rows are private to their recipient, and the userId
 * in every WHERE clause comes from the session rather than the request body.
 * A caller can only ever touch their own rows. Snooze durations are a fixed
 * menu rather than free input, so there is nothing else to validate.
 */

const notificationIdSchema = z.object({ notificationId: z.string().uuid() });

const snoozeSchema = z.object({
  notificationId: z.string().uuid(),
  hours: z.union([z.literal(1), z.literal(4), z.literal(24), z.literal(72)]),
});

/**
 * Read action for the bell popover. Same privacy rule as the mutations: the
 * recipient id comes from the session, so there is nothing to authorize.
 */
export async function listNotificationsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getNotifications>>>
> {
  return guarded("listNotifications", async () => {
    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");
    return ok(await getNotifications(user.id));
  });
}

function revalidateInbox(): void {
  revalidatePath("/notifications");
  revalidatePath("/home");
}

export async function markNotificationRead(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("markNotificationRead", async () => {
    const parsed = notificationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, parsed.data.notificationId),
          eq(notifications.userId, user.id),
        ),
      );

    revalidateInbox();
    return ok(null);
  });
}

export async function markNotificationUnread(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("markNotificationUnread", async () => {
    const parsed = notificationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    await db
      .update(notifications)
      .set({ readAt: null })
      .where(
        and(
          eq(notifications.id, parsed.data.notificationId),
          eq(notifications.userId, user.id),
        ),
      );

    revalidateInbox();
    return ok(null);
  });
}

export async function markAllNotificationsRead(): Promise<ActionResult<{
  marked: number;
}>> {
  return guarded("markAllNotificationsRead", async () => {
    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const updated = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, user.id))
      .returning({ id: notifications.id });

    revalidateInbox();
    return ok({ marked: updated.length });
  });
}

export async function snoozeNotification(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("snoozeNotification", async () => {
    const parsed = snoozeSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const till = new Date(Date.now() + parsed.data.hours * 3600_000);
    const updated = await db
      .update(notifications)
      .set({ snoozedTill: till })
      .where(
        and(
          eq(notifications.id, parsed.data.notificationId),
          eq(notifications.userId, user.id),
        ),
      )
      .returning({ id: notifications.id });

    // Updating a row that is not yours, or one that no longer exists, changes
    // nothing — and that is reported as not found rather than silently ok.
    if (updated.length === 0) {
      return fail("That notification no longer exists.", "NOT_FOUND");
    }

    revalidateInbox();
    return ok(null);
  });
}

export async function unsnoozeNotification(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("unsnoozeNotification", async () => {
    const parsed = notificationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    await db
      .update(notifications)
      .set({ snoozedTill: null })
      .where(
        and(
          eq(notifications.id, parsed.data.notificationId),
          eq(notifications.userId, user.id),
        ),
      );

    revalidateInbox();
    return ok(null);
  });
}
