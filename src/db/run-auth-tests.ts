/**
 * Runner for supabase/tests/auth.sql — the invite-gate assertions for
 * supabase/migrations/0006_handle_new_user.sql.
 *
 * Same shape as src/db/run-rls-tests.ts, and for the same reason: psql is not
 * installed here, and the suite's result table is a temp table that lives for
 * the duration of one connection.
 *
 *   node --env-file=.env.local src/db/run-auth-tests.ts
 *
 * Exit code 0 when every assertion passed, 1 otherwise.
 */

import postgres from "postgres";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

const sql = postgres(required("DATABASE_URL"), { max: 1 });

interface ResultRow {
  test: string;
  pass: boolean;
  detail: string;
}

try {
  await sql.file("supabase/tests/auth.sql");

  const results = await sql<ResultRow[]>`
    select test, pass, detail from pg_temp.auth_test_results order by test
  `;

  for (const row of results) {
    console.warn(`${row.pass ? "PASS" : "FAIL"}  ${row.test} — ${row.detail}`);
  }

  const failures = results.filter((row) => !row.pass).length;
  console.warn(
    failures === 0
      ? `AUTH SUITE: pass (${results.length} assertions)`
      : `AUTH SUITE: ${failures} FAILURE(S) of ${results.length} assertions`,
  );
  if (failures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  process.exitCode = 1;
  console.error(
    `Auth suite could not run: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
} finally {
  await sql.end();
}
