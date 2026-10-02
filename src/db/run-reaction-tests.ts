/**
 * Runner for supabase/tests/reactions.sql — the appeal workflow assertions.
 *
 * Fixtures are self-contained: the suite provisions its own two teams, three
 * members, project and issue through the invite gate, and deletes them again.
 *
 *   node --env-file=.env.local src/db/run-appeal-tests.ts
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
  await sql.file("supabase/tests/reactions.sql");

  const results = await sql<ResultRow[]>`
    select test, pass, detail from pg_temp.reaction_test_results order by test
  `;

  for (const row of results) {
    console.warn(`${row.pass ? "PASS" : "FAIL"}  ${row.test} — ${row.detail}`);
  }

  const failures = results.filter((row) => !row.pass).length;
  console.warn(
    failures === 0
      ? `REACTION SUITE: pass (${results.length} assertions)`
      : `REACTION SUITE: ${failures} FAILURE(S) of ${results.length}`,
  );

  if (failures > 0) process.exitCode = 1;
} finally {
  await sql.end();
}
