import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  getActiveCycleIds,
  getProjectsWithCycles,
  snapshotCycleCounts,
} from "@/db/queries/cycles";
import { cycleSnapshots } from "@/db/schema";
import { serverEnv } from "@/lib/env.server";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target (see vercel.json): snapshots every active cycle once a
 * day so burndown charts show history. Authorization is the shared
 * CRON_SECRET — Vercel sends it in the Authorization header automatically
 * for cron jobs configured in the same project.
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const projectIds = await getProjectsWithCycles();

  let snapshotted = 0;
  for (const projectId of projectIds) {
    const cycleIds = await getActiveCycleIds(projectId, today);
    for (const cycleId of cycleIds) {
      const counts = await snapshotCycleCounts(cycleId);
      await upsertSnapshot(cycleId, today, counts);
      snapshotted += 1;
    }
  }

  return NextResponse.json({ ok: true, snapshotted, date: today });
}

async function upsertSnapshot(
  cycleId: string,
  date: string,
  counts: { total: number; completed: number; started: number; pending: number },
) {
  // Counts come from the query layer with short names; the table spells them
  // out, so map rather than spread.
  const row = {
    totalIssues: counts.total,
    completedIssues: counts.completed,
    startedIssues: counts.started,
    pendingIssues: counts.pending,
  };
  await db
    .insert(cycleSnapshots)
    .values({ cycleId, snapshotDate: date, ...row })
    .onConflictDoUpdate({
      target: [cycleSnapshots.cycleId, cycleSnapshots.snapshotDate],
      set: row,
    });
}
