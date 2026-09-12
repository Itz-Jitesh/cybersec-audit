import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/** The transaction handle Drizzle hands to a `db.transaction` callback. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs writes in a transaction that tells Postgres who is doing them.
 *
 * Every activity trigger reads its actor from `auth.uid()`, which resolves the
 * `sub` claim out of `request.jwt.claims`. The Supabase client path sets that
 * claim; the Drizzle path does not, because it connects as the table owner with
 * no JWT at all. The consequence was silent and total: `auth.uid()` was null for
 * every server action, 0007_activity_cascade_guard makes the activity triggers
 * skip when it is, and so the live database held one comment, one subscriber and
 * **zero** rows in both issue_activity and notifications. Every activity feed in
 * the app was empty and no notification had ever been delivered.
 *
 * Setting the claim for the life of the transaction fixes that at the source,
 * rather than having each action write activity rows itself — which the project
 * rules forbid, and rightly: two writers of the same audit trail drift.
 *
 * It does not weaken anything. The connection's role is unchanged, so RLS is
 * still bypassed on this path and `assertCan` is still the authorization. What
 * the claim buys is an actor for the triggers, and the ability for database-side
 * guards such as require_lead_for_completion to see who is asking.
 */
export async function withActor<T>(
  userId: string,
  run: (tx: Tx) => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claims}, true)`,
    );
    return run(tx);
  });
}
