import "server-only";

import { render } from "@react-email/components";
import nodemailer, { type Transporter } from "nodemailer";

import { composeFrom } from "@/lib/email/from";
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
 * One transporter for the process, not one per email.
 *
 * Creating a transporter opens a TLS connection and authenticates; doing that
 * per message would turn a batch of twenty invites into twenty handshakes and
 * would look like a login storm to the provider. `pool` keeps a small number
 * of connections open and queues messages onto them, and Gmail's rate limits
 * are the reason `maxMessages` is modest rather than unlimited.
 */
const globalForMail = globalThis as unknown as {
  mailTransport: Transporter | undefined;
};

function getTransport(): Transporter | null {
  const env = serverEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    return null;
  }

  if (!globalForMail.mailTransport) {
    globalForMail.mailTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 is implicit TLS; 587 starts plaintext and upgrades with STARTTLS.
      // Getting this backwards is the usual cause of a hang rather than an
      // error, so it is derived from the port rather than configured twice.
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      pool: true,
      maxConnections: 2,
      maxMessages: 50,
    });
  }

  return globalForMail.mailTransport;
}

/**
 * Sends one invite email over SMTP.
 *
 * Returns a result rather than throwing, and reports "not-configured" rather
 * than failing when SMTP is unset. The invite row is already written by the
 * time this runs, so a mail failure must not lose it: the admin panel shows
 * the invite link for every open invite, and an admin can pass it on by hand.
 * Losing the invite because the mailer was misconfigured would be worse than
 * not sending the mail.
 */
export async function sendInviteEmail(
  args: SendInviteArgs,
): Promise<InviteSendResult> {
  const transport = getTransport();
  if (!transport) {
    return { sent: false, reason: "not-configured" };
  }

  const env = serverEnv();
  const acceptUrl = `${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/invite/${args.token}`;

  const element = (
    <InviteEmail
      inviterName={args.inviterName}
      workspaceName={args.workspaceName}
      roleLabel={args.roleLabel}
      teamName={args.teamName}
      acceptUrl={acceptUrl}
      expiresLabel={args.expiresLabel}
    />
  );

  try {
    // Both parts: a mail client that refuses HTML still has to be able to
    // reach the link, which is the entire point of the message.
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    await transport.sendMail({
      from: composeFrom(env.SMTP_FROM, env.SMTP_USER ?? ""),
      to: args.to,
      subject: `${args.inviterName} invited you to ${args.workspaceName}`,
      html,
      text,
    });

    return { sent: true };
  } catch (error) {
    // The address and the failure, never the credentials.
    console.error("[invite-email] SMTP send failed", {
      to: args.to,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      sent: false,
      reason: "failed",
      detail: error instanceof Error ? error.message : "Unknown mail error.",
    };
  }
}
