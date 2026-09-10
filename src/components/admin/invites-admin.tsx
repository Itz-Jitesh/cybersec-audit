"use client";

import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type InviteOutcome,
  resendInvite,
  revokeInvite,
  sendInvites,
} from "@/actions/invites";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminInvite } from "@/db/queries/admin";
import { clientEnv } from "@/lib/env";

const NO_TEAM = "none";

const STATUS_TEXT: Record<InviteOutcome["status"], string> = {
  emailed: "invited and emailed",
  invited: "invited (no email sent)",
  "already-member": "already a member",
  "already-invited": "already had an open invite",
  error: "invite created, email failed",
};

interface InvitesAdminProps {
  invites: AdminInvite[];
  teams: { id: string; name: string }[];
  mailerConfigured: boolean;
}

/**
 * Bulk invites and the open-invite list.
 *
 * The per-address outcome is shown rather than a single "sent": with a batch of
 * twenty, "three were already members and one bounced" is the only useful
 * answer, and it is the one the action returns.
 */
export function InvitesAdmin({
  invites,
  teams,
  mailerConfigured,
}: InvitesAdminProps) {
  const router = useRouter();
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("member");
  const [teamId, setTeamId] = useState(NO_TEAM);
  const [teamRole, setTeamRole] = useState("member");
  const [outcomes, setOutcomes] = useState<InviteOutcome[] | null>(null);
  const [pending, startTransition] = useTransition();

  const inviteUrl = (token: string) =>
    `${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/invite/${token}`;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await sendInvites({
        emails,
        role,
        teamId: teamId === NO_TEAM ? null : teamId,
        teamRole,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not send those invites.");
        return;
      }
      setOutcomes(result.data.results);
      setEmails("");
      const created = result.data.results.filter(
        (row) => row.status === "emailed" || row.status === "invited",
      ).length;
      toast.success(
        created === 0
          ? "No new invites were needed."
          : `${created} invite${created === 1 ? "" : "s"} created.`,
      );
      router.refresh();
    });
  }

  function onRevoke(inviteId: string) {
    startTransition(async () => {
      const result = await revokeInvite({ inviteId });
      if (!result.ok) {
        toast.error(result.error ?? "Could not revoke that invite.");
        return;
      }
      toast.success("Invite revoked.");
      router.refresh();
    });
  }

  function onResend(inviteId: string) {
    startTransition(async () => {
      const result = await resendInvite({ inviteId });
      if (!result.ok) {
        toast.error(result.error ?? "Could not resend that invite.");
        return;
      }
      toast[result.data.sent ? "success" : "warning"](
        result.data.sent ? "Invite email sent." : (result.data.reason ?? ""),
      );
    });
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      toast.success("Invite link copied.");
    } catch (error) {
      console.error("[invites] clipboard write failed", error);
      toast.error("Could not copy. Select the link and copy it by hand.");
    }
  }

  return (
    <>
      {!mailerConfigured && (
        <p className="mt-4 rounded-md border border-border-subtle p-3 text-xs text-text-300">
          <span className="text-warning">SMTP is not configured</span>, so
          nothing is emailed. Invites are still created — the invite row is what
          grants access. Use “Copy link” below and send it yourself.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-4 grid gap-3 rounded-md border border-border-subtle p-3"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="invite-emails">
            Email addresses — one per line, or comma separated
          </Label>
          <Textarea
            id="invite-emails"
            rows={4}
            required
            value={emails}
            placeholder={"first@example.com\nsecond@example.com"}
            onChange={(event) => setEmails(event.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-role">Workspace role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="co_president">Co-president</SelectItem>
                <SelectItem value="president">President</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-team">Team</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger id="invite-team">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_TEAM}>No team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-team-role">Team role</Label>
            <Select
              value={teamRole}
              onValueChange={setTeamRole}
              disabled={teamId === NO_TEAM}
            >
              <SelectTrigger id="invite-team-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Sending…" : "Send invites"}
          </Button>
        </div>
      </form>

      {outcomes && outcomes.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-md border border-border-subtle">
          {outcomes.map((outcome) => (
            <li
              key={outcome.email}
              className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-2xs last:border-b-0"
            >
              <span className="min-w-0 flex-1 truncate text-text-200">
                {outcome.email}
              </span>
              <span
                className={
                  outcome.status === "error" ? "text-warning" : "text-text-400"
                }
              >
                {STATUS_TEXT[outcome.status]}
                {outcome.detail ? ` — ${outcome.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-2xs font-medium tracking-wide text-text-400 uppercase">
        Open invites · {invites.length}
      </h2>

      {invites.length === 0 ? (
        <p className="mt-2 rounded-md border border-border-subtle px-3 py-6 text-center text-xs text-text-400">
          Nobody is waiting on an invite.
        </p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-md border border-border-subtle">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-text-100">{invite.email}</p>
                <p className="truncate text-2xs text-text-400">
                  <span className="capitalize">
                    {invite.role.replace("_", " ")}
                  </span>
                  {invite.teamName ? ` · ${invite.teamName}` : ""}
                  {invite.invitedByName ? ` · by ${invite.invitedByName}` : ""}
                  {" · expires "}
                  {formatDistanceToNow(invite.expiresAt, { addSuffix: true })}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copyLink(invite.token)}
              >
                Copy link
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onResend(invite.id)}
              >
                Resend
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => onRevoke(invite.id)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
