import { NotificationsClient } from "@/components/notifications/notifications-client";
import { getNotifications,splitNotifications } from "@/db/queries/notifications";
import { requireUser } from "@/lib/auth/session";

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await getNotifications(user.id);
  const { inbox, snoozed } = splitNotifications(rows);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-sm font-medium text-text-100">Notifications</h1>
      <p className="mt-0.5 text-xs text-text-400">
        Mentions, assignments and state changes on issues you watch.
      </p>
      <NotificationsClient inbox={inbox} snoozed={snoozed} />
    </div>
  );
}
