import { format } from "date-fns";
import { eq } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { invites } from "@/db/schema";
import { WORKSPACE_NAME } from "@/lib/constants/defaults";

/**
 * invite tokens are uuids. A malformed or unparseable token must render the
 * "not valid" notice, not 500 on Postgres's uuid cast, so non-uuid strings are
 * rejected up front. This deliberately mirrors the exact uuid text form so a
 * valid generated token always matches.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  president: "President",
  co_president: "Co-president",
  mentor: "Mentor",
  member: "Member",
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col">
      <h1 className="text-xl font-semibold text-text-100">{title}</h1>
      <p className="mt-2 text-sm text-text-300">{body}</p>
      <Link
        href="/sign-in"
        className="mt-6 text-xs text-text-300 transition-colors duration-[120ms] ease-out hover:text-text-100"
      >
        Go to sign in
      </Link>
    </div>
  );
}

/**
 * Read server-side through Drizzle rather than the Supabase client, because
 * there is no session yet: the invites table is admin-only under RLS, and the
 * whole point of this page is that it is shown to someone who is not a member.
 * Only the four fields below are read, so the token itself never reaches the
 * browser beyond the one already in the URL.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  // A malformed token must not reach the database, where the uuid cast would
  // raise 22P02 and turn a bad link into a server error.
  if (!UUID_RE.test(token)) {
    return (
      <Notice
        title="This invitation link is not valid"
        body="Check that you copied the whole link from the email. If it still does not work, ask a club admin to send a new invitation."
      />
    );
  }

  const [invite] = await db
    .select({
      id: invites.id,
      role: invites.role,
      teamId: invites.teamId,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      invitedBy: invites.invitedBy,
    })
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  if (!invite) {
    return (
      <Notice
        title="This invitation link is not valid"
        body="Check that you copied the whole link from the email. If it still does not work, ask a club admin to send a new invitation."
      />
    );
  }

  if (invite.acceptedAt) {
    return (
      <Notice
        title="This invitation has already been used"
        body="The account it was issued to is already a member. Sign in with that email address instead."
      />
    );
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    return (
      <Notice
        title="This invitation has expired"
        body={`Invitations are valid for seven days, and this one lapsed on ${format(invite.expiresAt, "MMM d, yyyy")}. Ask a club admin to send a new one.`}
      />
    );
  }

  const [details] = await db.query.invites.findMany({
    where: (row, { eq: matches }) => matches(row.id, invite.id),
    columns: { id: true },
    with: {
      team: { columns: { name: true } },
      inviter: { columns: { displayName: true } },
    },
    limit: 1,
  });

  const rows = [
    ["Invited by", details?.inviter?.displayName ?? "A club admin"],
    ["Role", ROLE_LABELS[invite.role] ?? invite.role],
    ["Team", details?.team?.name ?? "Assigned later"],
    ["Expires", format(invite.expiresAt, "MMM d, yyyy")],
  ] as const;

  return (
    <div className="flex flex-col">
      <Image
        src="/brand/logo-full.svg"
        alt={WORKSPACE_NAME}
        width={120}
        height={28}
        priority
        className="h-auto w-[120px] text-text-100"
      />

      <h1 className="mt-6 text-2xl font-semibold text-text-100">
        You have been invited to {WORKSPACE_NAME}
      </h1>

      <dl className="mt-5 divide-y divide-[var(--border-subtle)] border-y border-border-subtle">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2">
            <dt className="text-xs text-text-300">{label}</dt>
            <dd className="text-sm text-text-100">{value}</dd>
          </div>
        ))}
      </dl>

      <Button asChild className="mt-5 w-full justify-center">
        <Link href={`/sign-in?invite=${token}`}>Accept &amp; sign in</Link>
      </Button>

      <p className="mt-4 text-xs text-text-400">
        Sign in with the email address this invitation was sent to. Any other
        account will be turned away.
      </p>
    </div>
  );
}
