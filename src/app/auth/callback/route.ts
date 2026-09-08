import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth return leg. The invite gate itself lives in the handle_new_user trigger,
 * which aborts the auth.users insert for an uninvited address, so the failure
 * surfaces here as an error carrying NO_INVITE rather than as a session that
 * needs unwinding.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  const reject = (reason: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${reason}`, origin));

  if (!code) {
    return reject("auth_failed");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return reject(
      error.message.includes("NO_INVITE") ? "no_invite" : "auth_failed",
    );
  }

  // Membership and the second-factor requirement are both evaluated by
  // middleware on the way to /home, so there is one implementation of that rule
  // rather than two that can drift apart.
  return NextResponse.redirect(new URL("/home", origin));
}
