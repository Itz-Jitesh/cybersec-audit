import { notFound } from "next/navigation";

import { getWorkspaceCounts } from "@/db/queries/admin";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { WORKSPACE_NAME } from "@/lib/constants/defaults";
import { serverEnv } from "@/lib/env.server";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle p-3">
      <p className="text-lg font-medium text-text-100">{value}</p>
      <p className="mt-0.5 text-2xs text-text-400">{label}</p>
    </div>
  );
}

/** General: what this workspace is, and whether the pieces it depends on are wired. */
export default async function AdminGeneralPage() {
  const user = await requireUser();
  const guard = await assertCan(user, { kind: "workspace.admin" });
  if (!guard.ok) notFound();

  const counts = await getWorkspaceCounts();
  // Only whether these are set is read, never their values, and this is a
  // server component, so no part of the SMTP credentials reaches the browser.
  const env = serverEnv();
  const mailerConfigured = Boolean(
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD,
  );

  return (
    <div>
      <h1 className="text-sm font-medium text-text-100">General</h1>
      <p className="mt-0.5 text-xs text-text-400">{WORKSPACE_NAME}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Members" value={counts.members} />
        <Stat label="Active" value={counts.active} />
        <Stat label="Open invites" value={counts.openInvites} />
        <Stat label="Teams" value={counts.teams} />
      </div>

      <section className="mt-6">
        <h2 className="text-2xs font-medium tracking-wide text-text-400 uppercase">
          Invite email
        </h2>
        <p className="mt-2 rounded-md border border-border-subtle p-3 text-xs text-text-300">
          {mailerConfigured ? (
            <>
              Sending as{" "}
              <code className="font-mono">
                {env.SMTP_FROM ?? env.SMTP_USER}
              </code>
              . Invites created here are emailed automatically.
            </>
          ) : (
            <>
              <span className="text-warning">SMTP is not configured.</span>{" "}
              Invites still work — the invite row is what grants access — but no
              email goes out. Copy the link from the Invites tab and send it
              yourself, or set <code className="font-mono">SMTP_HOST</code>,{" "}
              <code className="font-mono">SMTP_USER</code> and{" "}
              <code className="font-mono">SMTP_PASSWORD</code> and sending
              resumes with no other change.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
