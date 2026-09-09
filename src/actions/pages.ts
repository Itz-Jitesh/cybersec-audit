"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import {
  type ActionResult,
  denied,
  fail,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { assertCan, canManageProject } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/utils/sanitize-html";
import {
  createPageSchema,
  pageIdSchema,
  updatePageSchema,
} from "@/lib/validators/page";

/**
 * Project pages.
 *
 * Editing is owner-only, the same rule saved views use, with project managers
 * able to delete. The body is sanitised on the way in for the same reason
 * comments are: TipTap HTML written by one member is rendered in another
 * member's browser, so anything the editor did not produce has to be stripped
 * at the boundary rather than trusted.
 */

async function loadPageContext(
  pageId: string,
): Promise<{ projectId: string; ownerId: string } | null> {
  const [row] = await db
    .select({ projectId: pages.projectId, ownerId: pages.ownerId })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!row?.projectId) return null;
  return { projectId: row.projectId, ownerId: row.ownerId };
}

export async function createPage(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createPage", async () => {
    const parsed = createPageSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const [row] = await db
      .insert(pages)
      .values({
        projectId: parsed.data.projectId,
        title: parsed.data.title,
        access: parsed.data.access,
        ownerId: user.id,
        createdBy: user.id,
      })
      .returning({ id: pages.id });

    revalidatePath(`/projects/${parsed.data.projectId}/pages`);
    return ok({ id: row.id });
  });
}

export async function updatePage(
  input: unknown,
): Promise<ActionResult<{ updatedAt: string }>> {
  return guarded("updatePage", async () => {
    const parsed = updatePageSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const context = await loadPageContext(parsed.data.pageId);
    if (!context) return fail("That page no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: context.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    if (context.ownerId !== user.id) {
      return fail("Only the page's owner can edit it.", "FORBIDDEN");
    }

    const updatedAt = new Date();
    await db
      .update(pages)
      .set({
        ...(parsed.data.title !== undefined && { title: parsed.data.title }),
        ...(parsed.data.access !== undefined && { access: parsed.data.access }),
        ...(parsed.data.contentHtml !== undefined && {
          contentHtml: sanitizeRichText(parsed.data.contentHtml),
        }),
        ...(parsed.data.contentJson !== undefined && {
          contentJson: parsed.data.contentJson,
        }),
        updatedAt,
      })
      .where(eq(pages.id, parsed.data.pageId));

    // The list is server-rendered and ordered by updated_at, so an autosave
    // that did not revalidate would leave a stale order behind it.
    revalidatePath(`/projects/${context.projectId}/pages`);
    return ok({ updatedAt: updatedAt.toISOString() });
  });
}

export async function deletePage(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("deletePage", async () => {
    const parsed = pageIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const context = await loadPageContext(parsed.data.pageId);
    if (!context) return fail("That page no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: context.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const manages = await canManageProject(user.id, context.projectId);
    if (context.ownerId !== user.id && !manages) {
      return fail(
        "Only the page's owner or a project admin can delete it.",
        "FORBIDDEN",
      );
    }

    await db.delete(pages).where(eq(pages.id, parsed.data.pageId));

    revalidatePath(`/projects/${context.projectId}/pages`);
    return ok(null);
  });
}
