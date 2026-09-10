import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the request's cookie jar. Uses the anon key
 * so the user's own RLS context applies; the service role key is never used
 * here.
 */
export async function createClient() {
  const cookieStore = await cookies();
  // Same reason as the middleware client: only the two public values are
  // needed, so this must not depend on every server secret parsing.
  const env = clientEnv;

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware, so this is safe to skip.
          }
        },
      },
    },
  );
}
