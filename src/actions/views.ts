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
import { getViewForGuard } from "@/db/queries/views";
import { views } from "@/db/schema";
import { assertCan, canManageProject } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createViewSchema,
  duplicateViewSchema,
  updateViewSchema,
  viewIdSchema,
} from "@/lib/validators/view";

/**
 * Saved views.
 *
 * The access rule from docs/04-DATA-MODEL.md §9: anyone who can read the
 * project may create a view in it; only the owner may edit one; the owner or a
 * project manager may delete one. Reading is scoped in the query rather than
 * here, since a list has to filter rather than refuse.
 *
 * A view is a stored query. That makes the filters blob part of the trust
 * boundary — savedFilterSchema drops projectId precisely so that a view cannot
 * name a project other than the one it lives in.
 */

function revalidateViews(projectId: string): void {
  revalidatePath(`/projects/${projectId}/views`);
}

export async function createView(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createView", async () => {
    const parsed = createViewSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const [row] = await db
      .insert(views)
      .values({
        projectId: parsed.data.projectId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        filters: parsed.data.filters,
        displayProps: parsed.data.displayProps,
        layout: parsed.data.layout,
        access: parsed.data.access,
        ownerId: user.id,
        createdBy: user.id,
      })
      .returning({ id: views.id });

    revalidateViews(parsed.data.projectId);
    return ok({ id: row.id });
  });
}

export async function updateView(input: unknown): Promise<ActionResult<null>> {
  return guarded("updateView", async () => {
    const parsed = updateViewSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const existing = await getViewForGuard(parsed.data.viewId);
    if (!existing || !existing.projectId) {
      return fail("That view no longer exists.", "NOT_FOUND");
    }

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: existing.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // Editing is the owner's alone. A project manager can remove a view they
    // dislike but cannot rewrite what it means and leave someone else's name
    // on it.
    if (existing.ownerId !== user.id) {
      return fail("Only the owner can edit this view.", "FORBIDDEN");
    }

    await db
      .update(views)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
        ...(parsed.data.filters !== undefined
          ? { filters: parsed.data.filters }
          : {}),
        ...(parsed.data.displayProps !== undefined
          ? { displayProps: parsed.data.displayProps }
          : {}),
        ...(parsed.data.layout !== undefined
          ? { layout: parsed.data.layout }
          : {}),
        ...(parsed.data.access !== undefined
          ? { access: parsed.data.access }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(views.id, parsed.data.viewId));

    revalidateViews(existing.projectId);
    return ok(null);
  });
}

export async function duplicateView(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("duplicateView", async () => {
    const parsed = duplicateViewSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const existing = await getViewForGuard(parsed.data.viewId);
    if (!existing || !existing.projectId) {
      return fail("That view no longer exists.", "NOT_FOUND");
    }

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: existing.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // Someone else's private view is not visible, so it cannot be copied.
    if (existing.access === "private" && existing.ownerId !== user.id) {
      return fail("That view no longer exists.", "NOT_FOUND");
    }

    // The copy is private and owned by whoever made it, whatever the original
    // was. Duplicating a public view is not a way to publish under your name.
    const [row] = await db
      .insert(views)
      .values({
        projectId: existing.projectId,
        name: parsed.data.name,
        description: existing.description,
        filters: existing.filters,
        displayProps: existing.displayProps,
        layout: existing.layout,
        access: "private",
        ownerId: user.id,
        createdBy: user.id,
      })
      .returning({ id: views.id });

    revalidateViews(existing.projectId);
    return ok({ id: row.id });
  });
}

export async function deleteView(input: unknown): Promise<ActionResult<null>> {
  return guarded("deleteView", async () => {
    const parsed = viewIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const existing = await getViewForGuard(parsed.data.viewId);
    if (!existing || !existing.projectId) {
      return fail("That view no longer exists.", "NOT_FOUND");
    }

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "project.read",
      projectId: existing.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const isOwner = existing.ownerId === user.id;
    const canManage = await canManageProject(user.id, existing.projectId);
    if (!isOwner && !canManage) {
      return fail("Only the owner can delete this view.", "FORBIDDEN");
    }

    await db.delete(views).where(eq(views.id, parsed.data.viewId));

    revalidateViews(existing.projectId);
    return ok(null);
  });
}
