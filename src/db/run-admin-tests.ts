/**
 * Runner for supabase/tests/admin.sql — the phase 11 admin and page access matrix.
 *
 * Fixtures are self-contained — the suite provisions its own team, project and
 * three members through the invite gate, so it can run in any order.
 *
 *   node --env-file=.env.local src/db/run-admin-tests.ts
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
  await sql.file("supabase/tests/admin.sql");

  const results = await sql<ResultRow[]>`
    select test, pass, detail from pg_temp.admin_test_results order by test
  `;

  for (const row of results) {
    console.warn(`${row.pass ? "PASS" : "FAIL"}  ${row.test} — ${row.detail}`);
  }

  const failures = results.filter((row) => !row.pass).length;
  console.warn(
    failures === 0
      ? `ADMIN SUITE: pass (${results.length} assertions)`
      : `ADMIN SUITE: ${failures} FAILURE(S) of ${results.length}`,
  );

  if (failures > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
