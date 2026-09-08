"use server";

import { and, eq } from "drizzle-orm";
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
import { favorites } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { toggleFavoriteSchema } from "@/lib/validators/favorite";

/**
 * Stars or unstars an entity for the current user.
 *
 * The row is always keyed to the caller's own id, never to an id supplied by
 * the client, so there is no way to write a favorite into someone else's
 * sidebar.
 */
export async function toggleFavorite(
  input: unknown,
): Promise<ActionResult<{ isFavorite: boolean }>> {
  return guarded("toggleFavorite", async () => {
    const parsed = toggleFavoriteSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.read" });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // Starring a project you cannot open would put an unreachable row in your
    // sidebar, so membership is checked rather than assumed.
    if (parsed.data.entityType === "project") {
      const visible = await assertCan(user, {
        kind: "project.read",
        projectId: parsed.data.entityId,
      });
      if (!visible.ok) return denied(visible);
    }

    const [existing] = await db
      .select({ id: favorites.id })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, user.id),
          eq(favorites.entityType, parsed.data.entityType),
          eq(favorites.entityId, parsed.data.entityId),
        ),
      )
      .limit(1);

    if (existing) {
      await db.delete(favorites).where(eq(favorites.id, existing.id));
      revalidatePath("/", "layout");
      return ok({ isFavorite: false });
    }

    await db.insert(favorites).values({
      userId: user.id,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
    });

    revalidatePath("/", "layout");
    return ok({ isFavorite: true });
  });
}
