import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs on every non-static route. Three rules, in order: refresh the session,
 * require one outside the public routes, and reject a deactivated membership.
 *
 * These checks exist here as well as in RLS on purpose. RLS decides what data a
 * request may touch; this decides whether the request gets a page at all. A
 * deactivated member who is only hidden in the UI is not deactivated.
 *
 * There is deliberately no second-factor rule. It used to hold admin, president
 * and co_president to an aal2 session and send them to /mfa otherwise, which
 * `docs/02-PRD.md` and `docs/03-TRD.md` still describe. The user removed it:
 * everyone signs in with Google or GitHub and nothing else, privileged roles
 * included. Anything reintroducing it has to come from them, not from the docs.
 *
 * The trade that buys: an admin's Google or GitHub account is now the only thing
 * between an attacker and every team's data, invites and role assignments. The
 * workspace stays invite-gated, so it is not open to the internet, but a
 * compromised admin login is no longer slowed down by a second factor.
 */

/** Reachable without a session. Everything else redirects to /sign-in. */
const PUBLIC_PREFIXES = ["/sign-in", "/auth/callback", "/invite"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user, supabase } = await updateSession(request);

  if (!user) {
    if (isPublic(pathname)) {
      return response;
    }
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // The membership lookup is scoped to this request only. A deactivated member
  // fails is_active_member and so cannot read even their own row, which is
  // exactly the answer needed here.
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !membership.is_active) {
    return NextResponse.redirect(
      new URL("/sign-in?error=deactivated", request.url),
    );
  }

  // A signed-in user has no reason to sit on the sign-in screen.
  if (pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.[^/]+$).*)"],
};
