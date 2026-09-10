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
  // server component, so nothing about them reaches the browser.
  const env = serverEnv();
  const mailerConfigured = Boolean(env.RESEND_API_KEY);
  // A key without a verified sender is the trap: Resend accepts the call and
  // then refuses every recipient except the account owner, so the invite looks
  // sent and silently is not.
  const senderVerified = Boolean(env.RESEND_FROM);

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
          {mailerConfigured && senderVerified ? (
            <>
              Resend is configured with a verified sender. Invites created here
              are emailed automatically.
            </>
          ) : mailerConfigured ? (
            <>
              <span className="text-warning">
                Resend has a key but no verified sender.
              </span>{" "}
              It is falling back to Resend&rsquo;s sandbox address, which only
              delivers to the Resend account owner. Everyone else gets
              &ldquo;invite created, email failed&rdquo;. Verify a domain at
              resend.com/domains, then set{" "}
              <code className="font-mono">RESEND_FROM</code> to an address on
              it. Until then, use Copy link on the Invites tab.
            </>
          ) : (
            <>
              <span className="text-warning">No Resend API key is set.</span>{" "}
              Invites still work — the invite row is what grants access — but no
              email goes out. Copy the link from the Invites tab and send it
              yourself, or set <code className="font-mono">RESEND_API_KEY</code>{" "}
              and the sending resumes with no other change.
            </>
          )}
        </p>
      </section>
    </div>
  );
}
