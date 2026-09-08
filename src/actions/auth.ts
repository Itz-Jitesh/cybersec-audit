"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Ends the session and returns the user to the sign-in screen. There is no
 * confirmation step, because signing back in costs one click and a session that
 * someone wanted ended should end immediately.
 */
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
