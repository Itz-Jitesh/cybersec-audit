"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { writeAudit } from "@/actions/audit";
import {
  type ActionResult,
  denied,
  fail,
  guarded,
  invalid,
  ok,
} from "@/actions/result";
import { db } from "@/db";
import { profiles, workspaceMembers } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { changeRoleSchema, setActiveSchema } from "@/lib/validators/admin";

/**
 * Membership administration: role changes and deactivation.
 *
 * Two rules hold in both directions here and in the policies, and neither is a
 * UI nicety:
 *
 *  - Nobody edits their own membership row. Without that, a co_president who
 *    passes is_workspace_admin can promote themselves to admin, which makes the
 *    role ladder decorative. The RLS suite asserts the database half of this.
 *  - The workspace never runs out of admins. Demoting or deactivating the last
 *    one locks everybody out of the admin panel permanently, with no recovery
 *    path short of editing the database by hand.
 */

const ADMIN_CLASS = ["admin", "president", "co_president"] as const;

async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(workspaceMembers)
    .where(
      and(
        ne(workspaceMembers.userId, excludeUserId),
        eq(workspaceMembers.isActive, true),
        inArray(workspaceMembers.role, [...ADMIN_CLASS]),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function changeMemberRole(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("changeMemberRole", async () => {
    const parsed = changeRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    if (parsed.data.userId === user.id) {
      return fail(
        "You cannot change your own role. Ask another admin.",
        "FORBIDDEN",
      );
    }

    const [target] = await db
      .select({
        role: workspaceMembers.role,
        isActive: workspaceMembers.isActive,
        name: profiles.displayName,
      })
      .from(workspaceMembers)
      .innerJoin(profiles, eq(profiles.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.userId, parsed.data.userId))
      .limit(1);

    if (!target) return fail("That member no longer exists.", "NOT_FOUND");
    if (target.role === parsed.data.role) return ok(null);

    const wasAdmin = (ADMIN_CLASS as readonly string[]).includes(target.role);
    const willBeAdmin = (ADMIN_CLASS as readonly string[]).includes(
      parsed.data.role,
    );

    if (wasAdmin && !willBeAdmin && target.isActive) {
      const others = await countOtherActiveAdmins(parsed.data.userId);
      if (others === 0) {
        return fail(
          "That is the last active admin. Promote someone else first.",
          "CONFLICT",
        );
      }
    }

    await db
      .update(workspaceMembers)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(workspaceMembers.userId, parsed.data.userId));

    await writeAudit({
      actorId: user.id,
      action: "member.role_changed",
      entityType: "workspace_member",
      entityId: parsed.data.userId,
      metadata: { name: target.name, from: target.role, to: parsed.data.role },
    });

    revalidatePath("/admin/members");
    revalidatePath("/admin");
    return ok(null);
  });
}

export async function setMemberActive(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("setMemberActive", async () => {
    const parsed = setActiveSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "workspace.admin" });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    if (parsed.data.userId === user.id) {
      return fail("You cannot deactivate yourself.", "FORBIDDEN");
    }

    const [target] = await db
      .select({
        role: workspaceMembers.role,
        isActive: workspaceMembers.isActive,
        name: profiles.displayName,
      })
      .from(workspaceMembers)
      .innerJoin(profiles, eq(profiles.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.userId, parsed.data.userId))
      .limit(1);

    if (!target) return fail("That member no longer exists.", "NOT_FOUND");
    if (target.isActive === parsed.data.isActive) return ok(null);

    if (
      !parsed.data.isActive &&
      (ADMIN_CLASS as readonly string[]).includes(target.role)
    ) {
      const others = await countOtherActiveAdmins(parsed.data.userId);
      if (others === 0) {
        return fail(
          "That is the last active admin. Promote someone else first.",
          "CONFLICT",
        );
      }
    }

    await db
      .update(workspaceMembers)
      .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
      .where(eq(workspaceMembers.userId, parsed.data.userId));

    await writeAudit({
      actorId: user.id,
      action: parsed.data.isActive ? "member.reactivated" : "member.deactivated",
      entityType: "workspace_member",
      entityId: parsed.data.userId,
      metadata: { name: target.name },
    });

    revalidatePath("/admin/members");
    revalidatePath("/admin");
    return ok(null);
  });
}
