import "server-only";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

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
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The profile joined with the workspace membership, or null when not signed in. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = await getSession();
  if (!user) {
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

  return row ?? null;
}

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
