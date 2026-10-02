"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
import { commentReactions, comments, issues } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { isEmptyRichText, sanitizeRichText } from "@/lib/utils/sanitize-html";

const createCommentSchema = z.object({
  issueId: z.string().uuid(),
  contentHtml: z.string().trim().min(1, "Write something first.").max(20_000),
  contentJson: z.unknown().optional(),
});

const updateCommentSchema = z.object({
  commentId: z.string().uuid(),
  contentHtml: z.string().trim().min(1).max(20_000),
  contentJson: z.unknown().optional(),
});

const commentIdSchema = z.object({ commentId: z.string().uuid() });

const reactionSchema = z.object({
  commentId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(16),
});

async function issueContext(issueId: string) {
  const [row] = await db
    .select({ projectId: issues.projectId })
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);
  return row?.projectId ?? null;
}

async function commentContext(commentId: string) {
  const [row] = await db
    .select({
      issueId: comments.issueId,
      authorId: comments.authorId,
      projectId: issues.projectId,
    })
    .from(comments)
    .innerJoin(issues, eq(issues.id, comments.issueId))
    .where(eq(comments.id, commentId))
    .limit(1);
  return row ?? null;
}

export async function createComment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createComment", async () => {
    const parsed = createCommentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const projectId = await issueContext(parsed.data.issueId);
    if (!projectId) return fail("That issue no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, { kind: "issue.write", projectId });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const safeHtml = sanitizeRichText(parsed.data.contentHtml);
    if (isEmptyRichText(safeHtml)) {
      return fail("Write something first.", "VALIDATION");
    }

    // The insert fires auto_subscribe and fanout_notifications. Notifications
    // are never written from here; the trigger owns that table.
    const [created] = await withActor(user.id, (tx) =>
      tx
        .insert(comments)
        .values({
          issueId: parsed.data.issueId,
          authorId: user.id,
          // Sanitised on the way in, so the stored value is safe for every
          // reader forever rather than depending on each renderer remembering.
          contentHtml: safeHtml,
          contentJson: parsed.data.contentJson ?? null,
        })
        .returning({ id: comments.id }),
    );

    revalidatePath(`/projects/${projectId}/issues/${parsed.data.issueId}`);
    return ok(created);
  });
}

export async function updateComment(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("updateComment", async () => {
    const parsed = updateCommentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const context = await commentContext(parsed.data.commentId);
    if (!context) return fail("That comment no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "issue.write",
      projectId: context.projectId,
    });
    if (!guard.ok) return denied(guard);

    // Editing is the author's alone. A project admin may delete a comment but
    // not rewrite it, because putting words in someone's mouth is a different
    // power from removing them.
    if (context.authorId !== user?.id) {
      return fail("Only the author can edit a comment.", "FORBIDDEN");
    }

    const safeHtml = sanitizeRichText(parsed.data.contentHtml);
    if (isEmptyRichText(safeHtml)) {
      return fail("Write something first.", "VALIDATION");
    }

    await db
      .update(comments)
      .set({
        contentHtml: safeHtml,
        contentJson: parsed.data.contentJson ?? null,
        isEdited: true,
      })
      .where(eq(comments.id, parsed.data.commentId));

    revalidatePath(`/projects/${context.projectId}/issues/${context.issueId}`);
    return ok(null);
  });
}

export async function deleteComment(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("deleteComment", async () => {
    const parsed = commentIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const context = await commentContext(parsed.data.commentId);
    if (!context) return fail("That comment no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();

    // The author always may; anyone else needs the project-manage bar, which is
    // what comment:delete_any means in docs/04-DATA-MODEL.md §9.
    if (context.authorId !== user?.id) {
      const guard = await assertCan(user, {
        kind: "project.manage",
        projectId: context.projectId,
      });
      if (!guard.ok) return denied(guard);
    } else {
      const guard = await assertCan(user, {
        kind: "issue.write",
        projectId: context.projectId,
      });
      if (!guard.ok) return denied(guard);
    }

    await db.delete(comments).where(eq(comments.id, parsed.data.commentId));

    revalidatePath(`/projects/${context.projectId}/issues/${context.issueId}`);
    return ok(null);
  });
}

export async function toggleReaction(
  input: unknown,
): Promise<ActionResult<{ reacted: boolean }>> {
  return guarded("toggleReaction", async () => {
    const parsed = reactionSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const context = await commentContext(parsed.data.commentId);
    if (!context) return fail("That comment no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "issue.write",
      projectId: context.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // Whatever this person already holds on this comment, whichever emoji it
    // is. The lookup is deliberately not filtered by emoji: a person has one
    // reaction per comment, so picking a second one replaces the first.
    const [existing] = await db
      .select({ id: commentReactions.id, emoji: commentReactions.emoji })
      .from(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, parsed.data.commentId),
          eq(commentReactions.userId, user.id),
        ),
      )
      .limit(1);

    if (existing?.emoji === parsed.data.emoji) {
      await db
        .delete(commentReactions)
        .where(eq(commentReactions.id, existing.id));
      revalidatePath(
        `/projects/${context.projectId}/issues/${context.issueId}`,
      );
      return ok({ reacted: false });
    }

    // Replace as delete-then-insert rather than an update, so the write still
    // goes through the insert policy that pins user_id to the caller. There is
    // no update policy on this table and adding one would widen the matrix for
    // no gain.
    await withActor(user.id, async (tx) => {
      if (existing) {
        await tx
          .delete(commentReactions)
          .where(eq(commentReactions.id, existing.id));
      }
      await tx.insert(commentReactions).values({
        commentId: parsed.data.commentId,
        userId: user.id,
        emoji: parsed.data.emoji,
      });
    });

    revalidatePath(`/projects/${context.projectId}/issues/${context.issueId}`);
    return ok({ reacted: true });
  });
}
