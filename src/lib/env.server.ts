import "server-only";

import { z } from "zod";

import { clientSchema, formatEnvError, rawClientEnv } from "@/lib/env";

/**
 * Server environment validation. Kept apart from env.ts because that module is
 * imported by client components: describing the secrets here, even by name,
 * would put those names in the browser bundle.
 */

const serverSchema = clientSchema.extend({
  /**
   * Optional at boot, and deliberately so. Nothing in the request path uses it:
   * it exists for a small number of admin operations that bypass RLS.
   * Requiring it here would fail every build and every developer machine that
   * has no reason to hold it. Read it through requireServiceRoleKey(), which
   * fails at the point of use instead.
   *
   * Also accepted under its newer name, SUPABASE_SECRET_KEY.
   */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  /** Session pooler (5432). Migrations, the seed and the test runners. */
  DATABASE_URL: z.string().url(),
  /**
   * Transaction pooler (6543). What runtime queries should use. Optional so a
   * developer machine works with one URL, but production wants both.
   */
  DATABASE_POOL_URL: z.string().url().optional(),
  /**
   * SMTP for the invite email.
   *
   * Resend was the original choice and is gone: it will not send to anyone but
   * the account owner without a verified domain, and the club does not own
   * one. A dedicated mailbox with an app password does the same job with no
   * domain and no third party holding the member list.
   *
   * All five are optional so a machine with no mail configuration still boots
   * and still creates invites — the invite row is what grants access, and the
   * admin panel offers the link to pass on by hand. sendInviteEmail reports
   * "not-configured" rather than throwing when they are absent.
   *
   * SMTP_PASSWORD is an app password, never an account password, and it is
   * read only here on the server.
   */
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  /** e.g. "CyberSec Atria <club.invites@gmail.com>". Defaults to SMTP_USER. */
  SMTP_FROM: z.string().min(1).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  /** Shared secret Vercel Cron sends as `Authorization: Bearer <value>`. */
  CRON_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * An unset variable and a variable set to nothing are the same thing here.
 *
 * `.env.local` ships these keys with empty values so they are visible and
 * ready to fill in. Without this, `SMTP_USER=` arrives as "" rather than
 * undefined, `.optional()` never applies, and the whole build fails on a
 * minimum-length rule for a variable nobody has configured yet.
 */
function blank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    ...rawClientEnv,
    SUPABASE_SERVICE_ROLE_KEY:
      blank(process.env.SUPABASE_SERVICE_ROLE_KEY) ??
      blank(process.env.SUPABASE_SECRET_KEY),
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_URL: blank(process.env.DATABASE_POOL_URL),
    SMTP_HOST: blank(process.env.SMTP_HOST),
    SMTP_PORT: blank(process.env.SMTP_PORT),
    SMTP_USER: blank(process.env.SMTP_USER),
    SMTP_PASSWORD: blank(process.env.SMTP_PASSWORD),
    SMTP_FROM: blank(process.env.SMTP_FROM),
    SEED_ADMIN_EMAIL: blank(process.env.SEED_ADMIN_EMAIL),
    CRON_SECRET: blank(process.env.CRON_SECRET),
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${formatEnvError(parsed.error)}`,
    );
  }

  return parsed.data;
}

/**
 * The service role key bypasses RLS entirely, so it is never read implicitly.
 * Callers ask for it explicitly and get a clear failure when it is absent,
 * rather than a confusing permission error further down.
 */
export function requireServiceRoleKey(): string {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. It is required only for admin operations that bypass row level security.",
    );
  }
  return key;
}
