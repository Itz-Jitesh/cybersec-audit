import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/env.server";

/**
 * Refreshes the Supabase session cookie on every request and returns the
 * response carrying the refreshed cookies, the current user, and the client
 * itself, so src/middleware.ts can run its membership lookup on the same
 * session rather than opening a second one.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = serverEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
