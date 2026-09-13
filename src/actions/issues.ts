"use server";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
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
import { withActor } from "@/db/actor";
import {
  issueAssignees,
  issueAttachments,
  issueLabels,
  issueLinks,
  issueRelations,
  issues,
  issueSubscribers,
  moduleIssues,
  states,
} from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/utils/sanitize-html";
import {
  addAttachmentSchema,
  addLinkSchema,
  attachmentIdSchema,
  bulkUpdateSchema,
  createIssueSchema,
  issueIdSchema,
  linkIdSchema,
  relationSchema,
  setAssigneesSchema,
  setLabelsSchema,
  setParentSchema,
  updateIssueOrderSchema,
  updateIssueSchema,
} from "@/lib/validators/issue";

/** Gap between adjacent issues, leaving room to insert between them. */
const SORT_STEP = 1000;

/**
 * Every action here resolves the issue's project before checking permission,
 * because the client sends an issue id and the permission is scoped to the
 * project. Resolving it server-side means a caller cannot claim an issue
 * belongs to a project they happen to be a member of.
 */
async function projectOfIssue(issueId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: issues.projectId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  return row?.projectId ?? null;
}

/** Resolves the issue and guards it in one step, since every action needs both. */
async function guardIssue(
  issueId: string,
  ability: "issue.write" | "issue.delete",
) {
  // The failure is typed ActionResult<never>, whose false branch is assignable
  // to every caller's own ActionResult<T>.
  const projectId = await projectOfIssue(issueId);
  if (!projectId) {
    return {
      ok: false as const,
      result: fail<never>("That issue no longer exists.", "NOT_FOUND"),
    };
  }

  const user = await getCurrentUser();
  const guard = await assertCan(user, { kind: ability, projectId });
  if (!guard.ok) {
    return { ok: false as const, result: denied<never>(guard) };
  }

  return { ok: true as const, projectId, userId: user?.id ?? null };
}

/**
 * For changes that add or remove a row: the issue list itself has to be
 * re-rendered on the server, so the next navigation does not show a stale set.
 */
function revalidateProject(projectId: string): void {
  revalidatePath(`/projects/${projectId}/issues`);
  revalidatePath("/home");
  revalidatePath("/my-issues");
}

/**
 * For field edits made from the list — state, priority, assignees, labels,
 * order. The client has already patched exactly this row into the TanStack
 * cache under the optimistic contract, so revalidating the issues route would
 * make Next re-render the whole page and stream it back inside the action's
 * response: a dozen serialised reads and a full RSC payload to deliver a change
 * the browser is already showing. That was the single largest cost of clicking
 * a chip. The aggregate views are still marked stale, since nothing on the
 * client patched those.
 */
function revalidateAggregates(): void {
  revalidatePath("/home");
  revalidatePath("/my-issues");
}

export async function createIssue(
  input: unknown,
): Promise<ActionResult<{ id: string; sequenceId: number }>> {
  return guarded("createIssue", async () => {
    const parsed = createIssueSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    // issue.create, not issue.write: opening an issue outright is the workspace
    // admin roles' alone. A lead, a member or a mentor raises a create appeal
    // and an approver turns it into the issue — see src/actions/appeals.ts.
    const guard = await assertCan(user, {
      kind: "issue.create",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // An absent state means "wherever new issues start in this project", which
    // only the project knows.
    let stateId = parsed.data.stateId;
    if (!stateId) {
      const [fallback] = await db
        .select({ id: states.id })
        .from(states)
        .where(
          and(
            eq(states.projectId, parsed.data.projectId),
            eq(states.isDefault, true),
          ),
        )
        .limit(1);

      if (!fallback) {
        const [first] = await db
          .select({ id: states.id })
          .from(states)
          .where(eq(states.projectId, parsed.data.projectId))
          .orderBy(asc(states.sequence))
          .limit(1);
        if (!first) {
          return fail(
            "This project has no states to put an issue in.",
            "CONFLICT",
          );
        }
        stateId = first.id;
      } else {
        stateId = fallback.id;
      }
    }

    // New issues go to the bottom of their group.
    const [last] = await db
      .select({ sortOrder: issues.sortOrder })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, parsed.data.projectId),
          eq(issues.stateId, stateId),
        ),
      )
      .orderBy(sql`${issues.sortOrder} desc`)
      .limit(1);

    const created = await db.transaction(async (tx) => {
      const [issue] = await tx
        .insert(issues)
        .values({
          projectId: parsed.data.projectId,
          // sequenceId is assigned by the assign_issue_sequence trigger; the
          // value here is a placeholder the trigger overwrites before insert.
          sequenceId: 0,
          name: parsed.data.name,
          descriptionHtml: parsed.data.descriptionHtml
            ? sanitizeRichText(parsed.data.descriptionHtml)
            : null,
          descriptionJson: parsed.data.descriptionJson ?? null,
          stateId,
          priority: parsed.data.priority,
          parentId: parsed.data.parentId ?? null,
          cycleId: parsed.data.cycleId ?? null,
          startDate: parsed.data.startDate ?? null,
          targetDate: parsed.data.targetDate ?? null,
          estimatePoint: parsed.data.estimatePoint ?? null,
          sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
          createdBy: user.id,
        })
        .returning({ id: issues.id, sequenceId: issues.sequenceId });

      if (parsed.data.assigneeIds?.length) {
        await tx.insert(issueAssignees).values(
          parsed.data.assigneeIds.map((userId) => ({
            issueId: issue.id,
            userId,
          })),
        );
      }

      if (parsed.data.labelIds?.length) {
        await tx.insert(issueLabels).values(
          parsed.data.labelIds.map((labelId) => ({
            issueId: issue.id,
            labelId,
          })),
        );
      }

      if (parsed.data.moduleIds?.length) {
        await tx.insert(moduleIssues).values(
          parsed.data.moduleIds.map((moduleId) => ({
            issueId: issue.id,
            moduleId,
          })),
        );
      }

      return issue;
    });

    revalidateProject(parsed.data.projectId);
    return ok(created);
  });
}

export async function updateIssue(input: unknown): Promise<ActionResult<null>> {
  return guarded("updateIssue", async () => {
    const parsed = updateIssueSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;
    if (!guard.userId) return fail("You must be signed in.", "UNAUTHENTICATED");

    const { issueId, ...changes } = parsed.data;

    // A state change has to be attributable: log_issue_activity takes its actor
    // from auth.uid(), and require_lead_for_completion decides whether this
    // person may move the issue into a completed state at all.
    const result = await withActor(guard.userId, (tx) =>
      tx
        .update(issues)
        .set({
          ...(changes.name !== undefined && { name: changes.name }),
          ...(changes.descriptionHtml !== undefined && {
            descriptionHtml: sanitizeRichText(changes.descriptionHtml),
          }),
          ...(changes.descriptionJson !== undefined && {
            descriptionJson: changes.descriptionJson,
          }),
          ...(changes.stateId !== undefined && { stateId: changes.stateId }),
          ...(changes.priority !== undefined && { priority: changes.priority }),
          ...(changes.parentId !== undefined && { parentId: changes.parentId }),
          ...(changes.cycleId !== undefined && { cycleId: changes.cycleId }),
          ...(changes.startDate !== undefined && {
            startDate: changes.startDate,
          }),
          ...(changes.targetDate !== undefined && {
            targetDate: changes.targetDate,
          }),
          ...(changes.estimatePoint !== undefined && {
            estimatePoint: changes.estimatePoint,
          }),
        })
        .where(eq(issues.id, issueId))
        .returning({ id: issues.id }),
    ).catch((error: unknown) => {
      // The completion gate raises rather than returning, because a trigger has
      // no other way to refuse. Anything else is a real failure.
      if (
        error instanceof Error &&
        error.message.includes("COMPLETION_NEEDS_LEAD")
      ) {
        return "needs-lead" as const;
      }
      throw error;
    });

    if (result === "needs-lead") {
      return fail(
        "Only a team lead can mark an issue completed. Raise a completion appeal instead.",
        "FORBIDDEN",
      );
    }

    revalidateAggregates();
    return ok(null);
  });
}

/**
 * A drag carries both the destination group and the position within it, so the
 * state change and the reorder are one update. The new sort_order is the
 * midpoint of the two neighbours, which leaves every other row untouched.
 */
export async function updateIssueOrder(
  input: unknown,
): Promise<ActionResult<{ sortOrder: number }>> {
  return guarded("updateIssueOrder", async () => {
    const parsed = updateIssueOrderSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    const neighbourIds = [parsed.data.beforeId, parsed.data.afterId].filter(
      (id): id is string => id !== null,
    );

    const neighbours = neighbourIds.length
      ? await db
          .select({ id: issues.id, sortOrder: issues.sortOrder })
          .from(issues)
          .where(inArray(issues.id, neighbourIds))
      : [];

    const before = neighbours.find((row) => row.id === parsed.data.beforeId);
    const after = neighbours.find((row) => row.id === parsed.data.afterId);

    let sortOrder: number;
    if (before && after) {
      sortOrder = (before.sortOrder + after.sortOrder) / 2;
    } else if (before) {
      sortOrder = before.sortOrder + SORT_STEP;
    } else if (after) {
      sortOrder = after.sortOrder - SORT_STEP;
    } else {
      sortOrder = SORT_STEP;
    }

    await db
      .update(issues)
      .set({ stateId: parsed.data.stateId, sortOrder })
      .where(eq(issues.id, parsed.data.issueId));

    revalidateAggregates();
    return ok({ sortOrder });
  });
}

export async function deleteIssue(input: unknown): Promise<ActionResult<null>> {
  return guarded("deleteIssue", async () => {
    const parsed = issueIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    // Deletion is the only irreversible act left on an issue now that archiving
    // is gone, and issue.delete is held to the workspace admin roles.
    const guard = await guardIssue(parsed.data.issueId, "issue.delete");
    if (!guard.ok) return guard.result;

    await db.delete(issues).where(eq(issues.id, parsed.data.issueId));

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

export async function setAssignees(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("setAssignees", async () => {
    const parsed = setAssigneesSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    // Replaced as a set rather than diffed, so the activity trigger sees one
    // removal and one addition per actual change and nothing for a no-op.
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ userId: issueAssignees.userId })
        .from(issueAssignees)
        .where(eq(issueAssignees.issueId, parsed.data.issueId));

      const current = new Set(existing.map((row) => row.userId));
      const next = new Set(parsed.data.userIds);

      const removed = [...current].filter((id) => !next.has(id));
      const added = [...next].filter((id) => !current.has(id));

      if (removed.length > 0) {
        await tx
          .delete(issueAssignees)
          .where(
            and(
              eq(issueAssignees.issueId, parsed.data.issueId),
              inArray(issueAssignees.userId, removed),
            ),
          );
      }

      if (added.length > 0) {
        await tx
          .insert(issueAssignees)
          .values(
            added.map((userId) => ({ issueId: parsed.data.issueId, userId })),
          )
          .onConflictDoNothing();
      }
    });

    revalidateAggregates();
    return ok(null);
  });
}

export async function setLabels(input: unknown): Promise<ActionResult<null>> {
  return guarded("setLabels", async () => {
    const parsed = setLabelsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ labelId: issueLabels.labelId })
        .from(issueLabels)
        .where(eq(issueLabels.issueId, parsed.data.issueId));

      const current = new Set(existing.map((row) => row.labelId));
      const next = new Set(parsed.data.labelIds);

      const removed = [...current].filter((id) => !next.has(id));
      const added = [...next].filter((id) => !current.has(id));

      if (removed.length > 0) {
        await tx
          .delete(issueLabels)
          .where(
            and(
              eq(issueLabels.issueId, parsed.data.issueId),
              inArray(issueLabels.labelId, removed),
            ),
          );
      }

      if (added.length > 0) {
        await tx
          .insert(issueLabels)
          .values(
            added.map((labelId) => ({ issueId: parsed.data.issueId, labelId })),
          )
          .onConflictDoNothing();
      }
    });

    revalidateAggregates();
    return ok(null);
  });
}

export async function setParent(input: unknown): Promise<ActionResult<null>> {
  return guarded("setParent", async () => {
    const parsed = setParentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    if (parsed.data.parentId === parsed.data.issueId) {
      return fail("An issue cannot be its own parent.", "CONFLICT");
    }

    // Walking up from the proposed parent catches a cycle of any depth, not
    // just the one-step case. Without this, A→B→A makes the sub-issue tree
    // infinite and every renderer that walks it hangs.
    if (parsed.data.parentId) {
      let cursor: string | null = parsed.data.parentId;
      let hops = 0;

      while (cursor && hops < 50) {
        if (cursor === parsed.data.issueId) {
          return fail(
            "That would make the sub-issue tree loop back on itself.",
            "CONFLICT",
          );
        }
        const [row]: { parentId: string | null }[] = await db
          .select({ parentId: issues.parentId })
          .from(issues)
          .where(eq(issues.id, cursor))
          .limit(1);
        cursor = row?.parentId ?? null;
        hops += 1;
      }
    }

    await db
      .update(issues)
      .set({ parentId: parsed.data.parentId })
      .where(eq(issues.id, parsed.data.issueId));

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

/** The inverse of a directed relation, so both issues show it. */
const INVERSE: Record<string, string> = {
  blocks: "blocked_by",
  blocked_by: "blocks",
  relates_to: "relates_to",
  duplicate_of: "duplicate_of",
};

export async function addRelation(input: unknown): Promise<ActionResult<null>> {
  return guarded("addRelation", async () => {
    const parsed = relationSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    if (parsed.data.issueId === parsed.data.relatedIssueId) {
      return fail("An issue cannot relate to itself.", "CONFLICT");
    }

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    // The other issue must be one the user can write to as well, or a relation
    // becomes a way to write a row into a project you cannot see.
    const otherProject = await projectOfIssue(parsed.data.relatedIssueId);
    if (!otherProject) return fail("That issue no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const otherGuard = await assertCan(user, {
      kind: "issue.write",
      projectId: otherProject,
    });
    if (!otherGuard.ok) return denied(otherGuard);

    await db.transaction(async (tx) => {
      await tx
        .insert(issueRelations)
        .values({
          issueId: parsed.data.issueId,
          relatedIssueId: parsed.data.relatedIssueId,
          relationType: parsed.data.relationType,
          createdBy: guard.userId ?? parsed.data.issueId,
        })
        .onConflictDoNothing();

      // Written here rather than by a trigger so that removing one direction
      // removes both explicitly, per docs/04-DATA-MODEL.md §4.
      await tx
        .insert(issueRelations)
        .values({
          issueId: parsed.data.relatedIssueId,
          relatedIssueId: parsed.data.issueId,
          relationType: INVERSE[parsed.data.relationType] as
            "blocks" | "blocked_by" | "relates_to" | "duplicate_of",
          createdBy: guard.userId ?? parsed.data.issueId,
        })
        .onConflictDoNothing();
    });

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

export async function removeRelation(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("removeRelation", async () => {
    const parsed = relationSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    await db.transaction(async (tx) => {
      await tx
        .delete(issueRelations)
        .where(
          and(
            eq(issueRelations.issueId, parsed.data.issueId),
            eq(issueRelations.relatedIssueId, parsed.data.relatedIssueId),
            eq(issueRelations.relationType, parsed.data.relationType),
          ),
        );

      await tx
        .delete(issueRelations)
        .where(
          and(
            eq(issueRelations.issueId, parsed.data.relatedIssueId),
            eq(issueRelations.relatedIssueId, parsed.data.issueId),
            eq(
              issueRelations.relationType,
              INVERSE[parsed.data.relationType] as
                "blocks" | "blocked_by" | "relates_to" | "duplicate_of",
            ),
          ),
        );
    });

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

export async function addLink(input: unknown): Promise<ActionResult<null>> {
  return guarded("addLink", async () => {
    const parsed = addLinkSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;
    if (!guard.userId) return fail("You must be signed in.", "UNAUTHENTICATED");

    await db.insert(issueLinks).values({
      issueId: parsed.data.issueId,
      url: parsed.data.url,
      title: parsed.data.title || null,
      createdBy: guard.userId,
    });

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

export async function removeLink(input: unknown): Promise<ActionResult<null>> {
  return guarded("removeLink", async () => {
    const parsed = linkIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const [link] = await db
      .select({ issueId: issueLinks.issueId })
      .from(issueLinks)
      .where(eq(issueLinks.id, parsed.data.linkId))
      .limit(1);

    if (!link) return fail("That link no longer exists.", "NOT_FOUND");

    const guard = await guardIssue(link.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    await db.delete(issueLinks).where(eq(issueLinks.id, parsed.data.linkId));

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

export async function addAttachment(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("addAttachment", async () => {
    const parsed = addAttachmentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;
    if (!guard.userId) return fail("You must be signed in.", "UNAUTHENTICATED");

    // The path is rebuilt from values the server already trusts rather than
    // taken from the client, so a caller cannot register a row pointing at
    // someone else's object in the bucket.
    const expectedPrefix = `${guard.projectId}/${parsed.data.issueId}/`;
    if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
      return fail("That file was not uploaded for this issue.", "VALIDATION");
    }

    await db.insert(issueAttachments).values({
      issueId: parsed.data.issueId,
      storagePath: parsed.data.storagePath,
      fileName: parsed.data.fileName,
      fileSize: parsed.data.fileSize,
      mimeType: parsed.data.mimeType,
      uploadedBy: guard.userId,
    });

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

export async function removeAttachment(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("removeAttachment", async () => {
    const parsed = attachmentIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const [attachment] = await db
      .select({ issueId: issueAttachments.issueId })
      .from(issueAttachments)
      .where(eq(issueAttachments.id, parsed.data.attachmentId))
      .limit(1);

    if (!attachment) return fail("That file no longer exists.", "NOT_FOUND");

    const guard = await guardIssue(attachment.issueId, "issue.write");
    if (!guard.ok) return guard.result;

    await db
      .delete(issueAttachments)
      .where(eq(issueAttachments.id, parsed.data.attachmentId));

    revalidateProject(guard.projectId);
    return ok(null);
  });
}

/**
 * One call for a bulk edit rather than a loop from the client. A loop would be
 * N round trips, N revalidations, and a half-applied result if the tab closed
 * partway through.
 */
export async function bulkUpdateIssues(
  input: unknown,
): Promise<ActionResult<{ updated: number }>> {
  return guarded("bulkUpdateIssues", async () => {
    const parsed = bulkUpdateSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const rows = await db
      .select({ id: issues.id, projectId: issues.projectId })
      .from(issues)
      .where(inArray(issues.id, parsed.data.issueIds));

    if (rows.length === 0) return fail("Nothing to update.", "NOT_FOUND");

    // A selection can in principle span projects, so every project involved is
    // checked. One failure denies the whole call rather than silently applying
    // to the permitted subset.
    const projectIds = [...new Set(rows.map((row) => row.projectId))];
    const user = await getCurrentUser();

    for (const projectId of projectIds) {
      const guard = await assertCan(user, { kind: "issue.write", projectId });
      if (!guard.ok) return denied(guard);
    }

    const ids = rows.map((row) => row.id);

    await db.transaction(async (tx) => {
      if (
        parsed.data.stateId !== undefined ||
        parsed.data.priority !== undefined
      ) {
        await tx
          .update(issues)
          .set({
            ...(parsed.data.stateId !== undefined && {
              stateId: parsed.data.stateId,
            }),
            ...(parsed.data.priority !== undefined && {
              priority: parsed.data.priority,
            }),
          })
          .where(inArray(issues.id, ids));
      }

      const addAssigneeIds = parsed.data.addAssigneeIds ?? [];
      if (addAssigneeIds.length > 0) {
        await tx
          .insert(issueAssignees)
          .values(
            ids.flatMap((issueId) =>
              addAssigneeIds.map((userId) => ({ issueId, userId })),
            ),
          )
          .onConflictDoNothing();
      }

      const addLabelIds = parsed.data.addLabelIds ?? [];
      if (addLabelIds.length > 0) {
        await tx
          .insert(issueLabels)
          .values(
            ids.flatMap((issueId) =>
              addLabelIds.map((labelId) => ({ issueId, labelId })),
            ),
          )
          .onConflictDoNothing();
      }
    });

    for (const projectId of projectIds) {
      revalidateProject(projectId);
    }

    return ok({ updated: ids.length });
  });
}

/** Subscribe or unsubscribe the current user from an issue's notifications. */
export async function toggleSubscription(
  input: unknown,
): Promise<ActionResult<{ subscribed: boolean }>> {
  return guarded("toggleSubscription", async () => {
    const parsed = issueIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const guard = await guardIssue(parsed.data.issueId, "issue.write");
    if (!guard.ok) return guard.result;
    if (!guard.userId) return fail("You must be signed in.", "UNAUTHENTICATED");
    const actorId = guard.userId;

    const [existing] = await db
      .select({ id: issueSubscribers.id })
      .from(issueSubscribers)
      .where(
        and(
          eq(issueSubscribers.issueId, parsed.data.issueId),
          eq(issueSubscribers.userId, actorId),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .delete(issueSubscribers)
        .where(eq(issueSubscribers.id, existing.id));
      revalidateAggregates();
      return ok({ subscribed: false });
    }

    // Through withActor so notify_issue_subscribed can attribute the follow and
    // tell the team lead, the assignees and the existing followers about it.
    await withActor(actorId, (tx) =>
      tx
        .insert(issueSubscribers)
        .values({ issueId: parsed.data.issueId, userId: actorId })
        .onConflictDoNothing(),
    );

    revalidateAggregates();
    return ok({ subscribed: true });
  });
}
