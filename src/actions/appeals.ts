"use server";

import { and, asc, eq, sql } from "drizzle-orm";
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
import { type Tx, withActor } from "@/db/actor";
import { issueAppeals, issues, states } from "@/db/schema";
import { assertCan } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { sanitizeRichText } from "@/lib/utils/sanitize-html";
import {
  appealIdSchema,
  completionAppealSchema,
  createIssueAppealSchema,
  decideAppealSchema,
} from "@/lib/validators/appeal";

/**
 * The approval workflow.
 *
 * Leads, members and mentors do not open issues and do not close them. They
 * raise an appeal — a create appeal carrying the issue they want, or a
 * completion appeal on one they believe is finished — and an approver decides.
 * Approving a create appeal writes the issue; approving a completion appeal
 * moves the issue into the project's completed state. The appeal row survives
 * either way, so who asked and who agreed stays on the record.
 *
 * Nobody decides their own appeal. That is enforced by the policy in
 * 0012_appeals.sql and again here, because a lead raising an appeal is the
 * normal case under these rules, not an edge one — their appeal escalates to a
 * workspace admin.
 */

const SORT_STEP = 1024;

function revalidateProjectViews(projectId: string): void {
  revalidatePath(`/projects/${projectId}/issues`);
  revalidatePath(`/projects/${projectId}/appeals`);
  revalidatePath("/home");
  revalidatePath("/my-issues");
}

/** Where a new issue starts in this project: the default state, else the first. */
async function startingStateId(projectId: string): Promise<string | null> {
  const [fallback] = await db
    .select({ id: states.id })
    .from(states)
    .where(and(eq(states.projectId, projectId), eq(states.isDefault, true)))
    .limit(1);
  if (fallback) return fallback.id;

  const [first] = await db
    .select({ id: states.id })
    .from(states)
    .where(eq(states.projectId, projectId))
    .orderBy(asc(states.sequence))
    .limit(1);
  return first?.id ?? null;
}

async function completedStateId(projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: states.id })
    .from(states)
    .where(and(eq(states.projectId, projectId), eq(states.group, "completed")))
    .orderBy(asc(states.sequence))
    .limit(1);
  return row?.id ?? null;
}

/** One appeal with the project it belongs to, or null. */
async function appealContext(appealId: string) {
  const [row] = await db
    .select({
      id: issueAppeals.id,
      projectId: issueAppeals.projectId,
      kind: issueAppeals.kind,
      status: issueAppeals.status,
      issueId: issueAppeals.issueId,
      title: issueAppeals.title,
      descriptionHtml: issueAppeals.descriptionHtml,
      descriptionJson: issueAppeals.descriptionJson,
      proposedPriority: issueAppeals.proposedPriority,
      requestedBy: issueAppeals.requestedBy,
    })
    .from(issueAppeals)
    .where(eq(issueAppeals.id, appealId))
    .limit(1);
  return row ?? null;
}

export async function createIssueAppeal(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("createIssueAppeal", async () => {
    const parsed = createIssueAppealSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "appeal.create",
      projectId: parsed.data.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    const [created] = await withActor(user.id, (tx) =>
      tx
        .insert(issueAppeals)
        .values({
          projectId: parsed.data.projectId,
          kind: "create",
          title: parsed.data.title,
          descriptionHtml: parsed.data.descriptionHtml
            ? sanitizeRichText(parsed.data.descriptionHtml)
            : null,
          descriptionJson: parsed.data.descriptionJson ?? null,
          proposedPriority: parsed.data.proposedPriority,
          note: parsed.data.note ?? null,
          requestedBy: user.id,
        })
        .returning({ id: issueAppeals.id }),
    );

    revalidateProjectViews(parsed.data.projectId);
    return ok(created);
  });
}

export async function requestIssueCompletion(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return guarded("requestIssueCompletion", async () => {
    const parsed = completionAppealSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const [issue] = await db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, parsed.data.issueId))
      .limit(1);
    if (!issue) return fail("That issue no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "appeal.create",
      projectId: issue.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    // One open request per issue per person. Asking twice should be a no-op
    // rather than two rows for a lead to decide separately.
    const [existing] = await db
      .select({ id: issueAppeals.id })
      .from(issueAppeals)
      .where(
        and(
          eq(issueAppeals.issueId, parsed.data.issueId),
          eq(issueAppeals.requestedBy, user.id),
          eq(issueAppeals.status, "pending"),
        ),
      )
      .limit(1);
    if (existing) {
      return ok(existing);
    }

    const [created] = await withActor(user.id, (tx) =>
      tx
        .insert(issueAppeals)
        .values({
          projectId: issue.projectId,
          kind: "complete",
          issueId: parsed.data.issueId,
          note: parsed.data.note ?? null,
          requestedBy: user.id,
        })
        .returning({ id: issueAppeals.id }),
    );

    revalidateProjectViews(issue.projectId);
    return ok(created);
  });
}

/**
 * Approve: write the thing that was asked for, then mark the appeal approved.
 *
 * Both happen in one transaction under the decider's claim, so the activity
 * triggers attribute the issue and the state change to the person who actually
 * agreed to it, and notify_appeal can tell the requester.
 */
export async function approveAppeal(
  input: unknown,
): Promise<ActionResult<{ issueId: string | null }>> {
  return guarded("approveAppeal", async () => {
    const parsed = decideAppealSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const appeal = await appealContext(parsed.data.appealId);
    if (!appeal) return fail("That appeal no longer exists.", "NOT_FOUND");
    if (appeal.status !== "pending") {
      return fail("That appeal has already been decided.", "CONFLICT");
    }

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "appeal.decide",
      projectId: appeal.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    if (appeal.requestedBy === user.id) {
      return fail(
        "You cannot approve your own appeal. Ask a workspace admin.",
        "FORBIDDEN",
      );
    }

    const stateId =
      appeal.kind === "create"
        ? await startingStateId(appeal.projectId)
        : await completedStateId(appeal.projectId);

    if (!stateId) {
      return fail(
        appeal.kind === "create"
          ? "This project has no states to put an issue in."
          : "This project has no completed state to move the issue to.",
        "CONFLICT",
      );
    }

    const issueId = await withActor(user.id, async (tx) => {
      if (appeal.kind === "create") {
        const [last] = await tx
          .select({ sortOrder: issues.sortOrder })
          .from(issues)
          .where(
            and(
              eq(issues.projectId, appeal.projectId),
              eq(issues.stateId, stateId),
            ),
          )
          .orderBy(sql`${issues.sortOrder} desc`)
          .limit(1);

        const [issue] = await tx
          .insert(issues)
          .values({
            projectId: appeal.projectId,
            // Overwritten by the assign_issue_sequence trigger.
            sequenceId: 0,
            name: appeal.title ?? "Untitled",
            descriptionHtml: appeal.descriptionHtml,
            descriptionJson: appeal.descriptionJson,
            stateId,
            priority: appeal.proposedPriority,
            sortOrder: (last?.sortOrder ?? 0) + SORT_STEP,
            // The issue belongs to the person who asked for it, not to the lead
            // who agreed — they are the one who will work on it.
            createdBy: appeal.requestedBy,
          })
          .returning({ id: issues.id });

        await settle(
          tx,
          appeal.id,
          user.id,
          "approved",
          parsed.data.decisionNote,
          issue.id,
        );
        return issue.id;
      }

      if (!appeal.issueId) {
        throw new Error("A completion appeal without an issue id.");
      }

      await tx
        .update(issues)
        .set({ stateId })
        .where(eq(issues.id, appeal.issueId));

      await settle(
        tx,
        appeal.id,
        user.id,
        "approved",
        parsed.data.decisionNote,
        null,
      );
      return appeal.issueId;
    });

    revalidateProjectViews(appeal.projectId);
    return ok({ issueId });
  });
}

export async function rejectAppeal(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("rejectAppeal", async () => {
    const parsed = decideAppealSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const appeal = await appealContext(parsed.data.appealId);
    if (!appeal) return fail("That appeal no longer exists.", "NOT_FOUND");
    if (appeal.status !== "pending") {
      return fail("That appeal has already been decided.", "CONFLICT");
    }

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "appeal.decide",
      projectId: appeal.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    if (appeal.requestedBy === user.id) {
      return fail("You cannot decide your own appeal.", "FORBIDDEN");
    }

    await withActor(user.id, (tx) =>
      settle(
        tx,
        appeal.id,
        user.id,
        "rejected",
        parsed.data.decisionNote,
        null,
      ),
    );

    revalidateProjectViews(appeal.projectId);
    return ok(null);
  });
}

/** Withdrawing your own request, while it is still undecided. */
export async function cancelAppeal(
  input: unknown,
): Promise<ActionResult<null>> {
  return guarded("cancelAppeal", async () => {
    const parsed = appealIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    const appeal = await appealContext(parsed.data.appealId);
    if (!appeal) return fail("That appeal no longer exists.", "NOT_FOUND");

    const user = await getCurrentUser();
    const guard = await assertCan(user, {
      kind: "appeal.create",
      projectId: appeal.projectId,
    });
    if (!guard.ok) return denied(guard);
    if (!user) return fail("You must be signed in.", "UNAUTHENTICATED");

    if (appeal.requestedBy !== user.id) {
      return fail(
        "Only the person who raised it can withdraw it.",
        "FORBIDDEN",
      );
    }
    if (appeal.status !== "pending") {
      return fail("That appeal has already been decided.", "CONFLICT");
    }

    await withActor(user.id, (tx) =>
      tx
        .update(issueAppeals)
        .set({ status: "cancelled", decidedAt: new Date() })
        .where(eq(issueAppeals.id, appeal.id)),
    );

    revalidateProjectViews(appeal.projectId);
    return ok(null);
  });
}

/** The one write that closes an appeal, so every path records the same columns. */
async function settle(
  tx: Tx,
  appealId: string,
  deciderId: string,
  status: "approved" | "rejected",
  decisionNote: string | undefined,
  createdIssueId: string | null,
): Promise<void> {
  await tx
    .update(issueAppeals)
    .set({
      status,
      decidedBy: deciderId,
      decidedAt: new Date(),
      decisionNote: decisionNote ?? null,
      ...(createdIssueId !== null && { createdIssueId }),
    })
    .where(eq(issueAppeals.id, appealId));
}
