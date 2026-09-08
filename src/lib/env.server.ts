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
  RESEND_API_KEY: z.string().min(1).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    ...rawClientEnv,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_URL: process.env.DATABASE_POOL_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
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
