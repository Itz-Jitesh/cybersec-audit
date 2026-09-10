import "server-only";

import type { z } from "zod";

import type { AbilityResult } from "@/lib/auth/permissions";

/**
 * The return shape every server action shares, per docs/03-TRD.md §10. Actions
 * never throw to the client: a thrown error in a server action reaches the
 * browser as an opaque digest, which tells the user nothing and gives the UI
 * nothing to show.
 */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; code: ActionErrorCode };

export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STATE_IN_USE"
  | "LAST_STATE"
  | "DEFAULT_STATE"
  /** The person is already on the team — a race, not the normal path. */
  | "ALREADY_MEMBER"
  /** Removing this person would leave a populated team with no lead. */
  | "LAST_LEAD"
  | "UNEXPECTED";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T>(
  error: string,
  code: ActionErrorCode = "UNEXPECTED",
): ActionResult<T> {
  return { ok: false, error, code };
}

/** Turns a zod failure into the action shape, surfacing the first message. */
export function invalid<T>(error: z.ZodError): ActionResult<T> {
  const first = error.issues[0];
  return {
    ok: false,
    error: first?.message ?? "That input is not valid.",
    code: "VALIDATION",
  };
}

/** Turns an assertCan denial into the action shape. */
export function denied<T>(
  result: Extract<AbilityResult, { ok: false }>,
): ActionResult<T> {
  return { ok: false, error: result.error, code: result.code };
}

/**
 * Wraps the body of an action so an unexpected database error becomes a result
 * rather than an exception. The real error is logged server-side; the client is
 * told something went wrong without leaking the query that failed.
 */
export async function guarded<T>(
  label: string,
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    console.error(`[action:${label}]`, error);
    return fail("Something went wrong. Try again.", "UNEXPECTED");
  }
}
