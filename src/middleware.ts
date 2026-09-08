import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Runs on every non-static route. Four rules, in order: refresh the session,
 * require one outside the public routes, reject a deactivated membership, and
 * hold privileged roles to a second factor.
 *
 * These checks exist here as well as in RLS on purpose. RLS decides what data a
 * request may touch; this decides whether the request gets a page at all. A
 * deactivated member who is only hidden in the UI is not deactivated.
 */

/** Reachable without a session. Everything else redirects to /sign-in. */
const PUBLIC_PREFIXES = ["/sign-in", "/auth/callback", "/invite"];

/**
 * The design-system reference routes under /dev hold no data and exist to be
 * looked at while building. They are open in development only, and the whole
 * directory is deleted in phase 12, so they are never reachable in production
 * even by an authenticated member.
 */
const DEV_PREFIXES = process.env.NODE_ENV === "production" ? [] : ["/dev"];

/** Roles that must satisfy aal2 before reaching anything else. */
const MFA_REQUIRED_ROLES = new Set(["admin", "president", "co_president"]);

function isPublic(pathname: string): boolean {
  return [...PUBLIC_PREFIXES, ...DEV_PREFIXES].some(
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

  // A signed-in user has no reason to sit on the sign-in screen.
  if (pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  if (isPublic(pathname)) {
    return response;
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

  if (MFA_REQUIRED_ROLES.has(membership.role) && pathname !== "/mfa") {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    // currentLevel is aal1 both before enrolment and before the challenge is
    // answered; /mfa handles whichever of the two applies.
    if (aal?.currentLevel !== "aal2") {
      return NextResponse.redirect(new URL("/mfa", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.[^/]+$).*)"],
};
