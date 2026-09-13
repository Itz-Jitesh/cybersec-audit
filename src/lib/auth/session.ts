import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { profiles, workspaceMembers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
}

/**
 * The authenticated user according to Supabase, or null.
 *
 * getUser() rather than getSession(): getSession reads the cookie without
 * checking it, so a forged or stale cookie would be believed. Anything that
 * gates access has to use the verified call.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  // The error was being discarded, which is why every session failure looked
  // identical from the outside. "Auth session missing" means no usable cookie
  // reached this request; anything else — a refresh race, a network failure
  // talking to Supabase — is worth telling apart from it.
  if (error) {
    console.error(`[auth] getUser failed: ${error.message}`);
  }

  return data.user;
});

/**
 * The profile joined with the workspace membership, or null.
 *
 * Null means one of two quite different things and the caller cannot tell them
 * apart, which is why both are logged here. Either Supabase did not recognise
 * the request's cookies — an expired or absent session — or it did and this
 * person has no profile row, or no workspace membership attached to it. The
 * first is a sign-in problem; the second is a provisioning bug, and it presents
 * to the user as being told they are not signed in while they plainly are.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = await getSession();
  if (!user) {
    console.error("[auth] no Supabase session on this request");
    return null;
  }

  const [row] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      role: workspaceMembers.role,
      isActive: workspaceMembers.isActive,
    })
    .from(profiles)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, profiles.id))
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (!row) {
    console.error(
      `[auth] signed in as ${user.id} (${user.email ?? "no email"}) but no profile joined to an active membership`,
    );
    return null;
  }

  return row;
});

/**
 * For pages that require a member. Middleware already turns away anyone without
 * a session or with an inactive membership, so reaching either redirect here
 * means the two disagreed — which is worth failing closed on rather than
 * rendering.
 */
export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();

  if (!current) {
    redirect("/sign-in");
  }

  if (!current.isActive) {
    redirect("/sign-in?error=deactivated");
  }

  return current;
}
