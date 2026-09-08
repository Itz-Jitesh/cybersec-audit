import { z } from "zod";

/**
 * Public environment validation. Imported by client components, so this module
 * must stay free of anything describing a secret — even the names of secrets,
 * which would otherwise be bundled and shipped. Server variables live in
 * env.server.ts, which is marked server-only.
 *
 * Validation runs at module load so a missing or malformed value fails loudly
 * at boot rather than surfacing later as an opaque runtime error.
 */

export const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  /**
   * Supabase renamed the anon key to the publishable key. Both names are read
   * so a project created under either naming works without an edit here; the
   * value means the same thing and carries the same privileges.
   */
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

/**
 * Next.js inlines process.env.NEXT_PUBLIC_* at build time only when each key is
 * referenced literally, so the values are read one by one rather than spread
 * from process.env.
 */
export const rawClientEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

export type ClientEnv = z.infer<typeof clientSchema>;

function parseClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse(rawClientEnv);
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${formatEnvError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Safe to read from a client component. */
export const clientEnv: ClientEnv = parseClientEnv();
