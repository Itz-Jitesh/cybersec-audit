/**
 * A valid From header, whatever shape SMTP_FROM was given.
 *
 * "Cybersec AIT" is the natural thing to type into a variable called FROM,
 * and it is not an address. Gmail happens to rewrite a bare display name to
 * the authenticated account, but most providers reject it outright, and a
 * bounce for a malformed header is a miserable thing to debug. A value with no
 * "@" is treated as the display name it plainly is and paired with the account
 * actually doing the sending.
 *
 * Kept out of send-invite.tsx so it can be tested without importing a module
 * marked "server-only".
 */
export function composeFrom(from: string | undefined, user: string): string {
  const trimmed = from?.trim();
  if (!trimmed) return user;
  return trimmed.includes("@") ? trimmed : `${trimmed} <${user}>`;
}
