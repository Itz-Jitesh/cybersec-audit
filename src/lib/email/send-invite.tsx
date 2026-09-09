import "server-only";

import { Resend } from "resend";

import { InviteEmail } from "@/lib/email/invite-email";
import { clientEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

export type InviteSendResult =
  | { sent: true }
  | { sent: false; reason: "not-configured" | "failed"; detail?: string };

interface SendInviteArgs {
  to: string;
  token: string;
  inviterName: string;
  workspaceName: string;
  roleLabel: string;
  teamName: string | null;
  expiresLabel: string;
}

/**
 * Sends one invite email.
 *
 * Returns a result rather than throwing, and reports "not-configured" rather
 * than failing when RESEND_API_KEY is absent. The invite row is already written
 * by the time this runs, so a missing key must not lose it: the admin panel
 * shows the invite link for every open invite, and an admin can pass it on by
 * hand until the key is set. Losing the invite because the mailer was not
 * configured would be a worse outcome than not sending the mail.
 */
export async function sendInviteEmail(
  args: SendInviteArgs,
): Promise<InviteSendResult> {
  const apiKey = serverEnv().RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, reason: "not-configured" };
  }

  const acceptUrl = `${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/invite/${args.token}`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: INVITE_FROM,
      to: args.to,
      subject: `${args.inviterName} invited you to ${args.workspaceName}`,
      react: (
        <InviteEmail
          inviterName={args.inviterName}
          workspaceName={args.workspaceName}
          roleLabel={args.roleLabel}
          teamName={args.teamName}
          acceptUrl={acceptUrl}
          expiresLabel={args.expiresLabel}
        />
      ),
    });

    if (error) {
      console.error("[invite-email] resend rejected the send", error);
      return { sent: false, reason: "failed", detail: error.message };
    }
    return { sent: true };
  } catch (error) {
    console.error("[invite-email] send threw", error);
    return {
      sent: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "Unknown error.",
    };
  }
}

/**
 * Resend's shared sandbox sender. It delivers without a verified domain, which
 * is what makes the flow testable before the club owns one; swap it for a
 * club address once a domain is verified in the Resend dashboard.
 */
const INVITE_FROM = "CyberSec Atria <onboarding@resend.dev>";
