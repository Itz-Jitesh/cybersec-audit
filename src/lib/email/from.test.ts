/**
 * Unit tests for the From-header composer.
 *
 *   pnpm test:email
 *
 * Small, but this is the exact shape that silently broke a real invite: the
 * variable held "CyberSec Atria" and no address at all.
 */

import assert from "node:assert/strict";

import { composeFrom } from "./from.ts";

const USER = "club@example.com";

const CASES: { from: string | undefined; expected: string; why: string }[] = [
  {
    from: undefined,
    expected: USER,
    why: "unset falls back to the sending account",
  },
  {
    from: "CyberSec Atria",
    expected: `CyberSec Atria <${USER}>`,
    why: "a bare display name is paired with the account",
  },
  {
    from: "CyberSec Atria <invites@club.dev>",
    expected: "CyberSec Atria <invites@club.dev>",
    why: "a full header is left alone",
  },
  {
    from: "invites@club.dev",
    expected: "invites@club.dev",
    why: "a bare address is already valid",
  },
];

let failures = 0;
for (const { from, expected, why } of CASES) {
  try {
    assert.equal(composeFrom(from, USER), expected);
    console.warn(`PASS  ${why}`);
  } catch (error) {
    failures += 1;
    console.warn(`FAIL  ${why} — ${error instanceof Error ? error.message : error}`);
  }
}

console.warn(
  failures === 0
    ? `EMAIL SUITE: pass (${CASES.length} assertions)`
    : `EMAIL SUITE: ${failures} FAILURE(S) of ${CASES.length}`,
);
if (failures > 0) process.exitCode = 1;
