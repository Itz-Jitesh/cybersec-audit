import "server-only";

import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Audit entries for the operations docs/04-DATA-MODEL.md §6 names: invites sent
 * and revoked, role changes, deactivations, and project or team deletion.
 *
 * Unlike issue_activity, which is written entirely by triggers, these record
 * intent that only the action knows — who asked for a deletion and what its
 * name was before it stopped existing.
 */
export async function writeAudit(entry: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata ?? null,
  });
}
