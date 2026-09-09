import "server-only";

import { and, desc, eq, or } from "drizzle-orm";

import { db } from "@/db";
import { pages, profiles } from "@/db/schema";

/**
 * Reads for project pages.
 *
 * Access mirrors views: a page is either public to the project or private to
 * its owner. Callers assert project.read first; the per-row rule is applied
 * here, because Drizzle reads bypass RLS and the list must not leak titles.
 */

const PAGE_LIMIT = 200;

export interface PageRow {
  id: string;
  title: string;
  access: "private" | "public";
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  isArchived: boolean;
  updatedAt: Date;
}

export async function getProjectPages(
  projectId: string,
  userId: string,
): Promise<PageRow[]> {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      access: pages.access,
      ownerId: pages.ownerId,
      ownerName: profiles.displayName,
      ownerAvatarUrl: profiles.avatarUrl,
      isArchived: pages.isArchived,
      updatedAt: pages.updatedAt,
    })
    .from(pages)
    .innerJoin(profiles, eq(profiles.id, pages.ownerId))
    .where(
      and(
        eq(pages.projectId, projectId),
        eq(pages.isArchived, false),
        or(eq(pages.access, "public"), eq(pages.ownerId, userId)),
      ),
    )
    .orderBy(desc(pages.updatedAt))
    .limit(PAGE_LIMIT);
}

export interface PageDetail extends PageRow {
  projectId: string;
  contentHtml: string | null;
  contentJson: unknown;
}

/**
 * One page, without the access rule applied — the caller decides, because the
 * detail route has to tell "not found" apart from "not yours" to render the
 * right thing.
 */
export async function getPage(pageId: string): Promise<PageDetail | null> {
  const [row] = await db
    .select({
      id: pages.id,
      projectId: pages.projectId,
      title: pages.title,
      access: pages.access,
      ownerId: pages.ownerId,
      ownerName: profiles.displayName,
      ownerAvatarUrl: profiles.avatarUrl,
      isArchived: pages.isArchived,
      updatedAt: pages.updatedAt,
      contentHtml: pages.contentHtml,
      contentJson: pages.contentJson,
    })
    .from(pages)
    .innerJoin(profiles, eq(profiles.id, pages.ownerId))
    .where(eq(pages.id, pageId))
    .limit(1);

  if (!row || !row.projectId) return null;
  return { ...row, projectId: row.projectId };
}
