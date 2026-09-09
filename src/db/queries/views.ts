import "server-only";

import { and, desc, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { profiles, views } from "@/db/schema";
import {
  type DisplayProps,
  type IssueLayout,
  parseStoredDisplayProps,
  parseStoredFilters,
  parseStoredLayout,
  type SavedFilters,
} from "@/lib/validators/view";

/**
 * Reads for saved views.
 *
 * As everywhere in src/db/queries, the connection carries BYPASSRLS, so the
 * visibility rule from docs/04-DATA-MODEL.md §9 — public views in a project you
 * belong to, plus your own private ones — is written into the WHERE clause
 * here rather than left to a policy. The caller must still have passed
 * assertCan for project.read on the project.
 */

const VIEW_LIMIT = 100;

export interface ViewRow {
  id: string;
  name: string;
  description: string | null;
  layout: IssueLayout;
  access: "private" | "public";
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  filters: SavedFilters;
  displayProps: DisplayProps;
  updatedAt: Date;
}

export async function getProjectViews(
  projectId: string,
  userId: string,
): Promise<ViewRow[]> {
  const rows = await db
    .select({
      id: views.id,
      name: views.name,
      description: views.description,
      layout: views.layout,
      access: views.access,
      ownerId: views.ownerId,
      ownerName: profiles.displayName,
      ownerAvatarUrl: profiles.avatarUrl,
      filters: views.filters,
      displayProps: views.displayProps,
      updatedAt: views.updatedAt,
    })
    .from(views)
    .innerJoin(profiles, eq(profiles.id, views.ownerId))
    .where(
      and(
        eq(views.projectId, projectId),
        // A private view belongs to its owner and to nobody else, however the
        // project is shared.
        or(eq(views.access, "public"), eq(views.ownerId, userId)),
      ),
    )
    .orderBy(desc(views.updatedAt))
    .limit(VIEW_LIMIT);

  return rows.map((row) => ({
    ...row,
    layout: parseStoredLayout(row.layout),
    filters: parseStoredFilters(row.filters),
    displayProps: parseStoredDisplayProps(row.displayProps),
  }));
}

/** The row itself plus the two ids permission decisions need. */
export async function getViewForGuard(viewId: string) {
  const [row] = await db
    .select({
      id: views.id,
      projectId: views.projectId,
      ownerId: views.ownerId,
      access: views.access,
      name: views.name,
      description: views.description,
      layout: views.layout,
      filters: views.filters,
      displayProps: views.displayProps,
    })
    .from(views)
    .where(eq(views.id, viewId))
    .limit(1);

  return row ?? null;
}
