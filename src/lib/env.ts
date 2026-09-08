import { z } from "zod";

/**
 * Environment validation. This module is imported for its side effect at boot
 * so that a missing or malformed variable fails immediately and loudly rather
 * than surfacing later as an opaque runtime error in a request handler.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  /**
   * Supabase renamed the anon key to the publishable key. Both names are read
   * so a project created under either naming works without an edit here; the
   * value means the same thing and carries the same privileges.
   */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const serverSchema = clientSchema.extend({
  /** Also accepted under its newer name, SUPABASE_SECRET_KEY. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(1).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
});

function format(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

/**
 * Next.js inlines process.env.NEXT_PUBLIC_* at build time only when each key is
 * referenced literally, so the client values are read one by one rather than
 * spread from process.env.
 */
const rawClient = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

function parseClientEnv() {
  const parsed = clientSchema.safeParse(rawClient);
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${format(parsed.error)}`,
    );
  }
  return parsed.data;
}

function parseServerEnv() {
  const parsed = serverSchema.safeParse({
    ...rawClient,
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${format(parsed.error)}`,
    );
  }
  return parsed.data;
}

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

/** Safe to read from a client component. */
export const clientEnv: ClientEnv = parseClientEnv();

/**
 * Server-only. Reading this from a client bundle would throw, because the
 * secret keys are undefined there — which is the intended failure mode.
 */
export function serverEnv(): ServerEnv {
  return parseServerEnv();
}
