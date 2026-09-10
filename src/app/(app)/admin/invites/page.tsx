import { asc } from "drizzle-orm";
import { notFound } from "next/navigation";

import { InvitesAdmin } from "@/components/admin/invites-admin";
import { db } from "@/db";
import { getOpenInvites } from "@/db/queries/admin";
import { teams } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env.server";

export default async function AdminInvitesPage() {
  const user = await requireUser();
  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) notFound();

  const [invites, teamRows] = await Promise.all([
    getOpenInvites(),
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .orderBy(asc(teams.name))
      .limit(50),
  ]);

  return (
    <div>
      <h1 className="text-sm font-medium text-text-100">Invites</h1>
      <p className="mt-0.5 text-xs text-text-400">
        An invite is what lets someone sign in. Sign-up is closed otherwise.
      </p>
      <InvitesAdmin
        invites={invites}
        teams={teamRows}
        mailerConfigured={Boolean(
          serverEnv().SMTP_HOST &&
            serverEnv().SMTP_USER &&
            serverEnv().SMTP_PASSWORD,
        )}
      />
    </div>
  );
}
