/**
 * Runner for supabase/tests/projects.sql — the phase 7 provisioning and state
 * guard assertions. Same shape and same reasoning as the other two runners.
 *
 *   node --env-file=.env.local src/db/run-project-tests.ts
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
  await sql.file("supabase/tests/projects.sql");

  const results = await sql<ResultRow[]>`
    select test, pass, detail from pg_temp.project_test_results order by test
  `;

  for (const row of results) {
    console.warn(`${row.pass ? "PASS" : "FAIL"}  ${row.test} — ${row.detail}`);
  }

  const failures = results.filter((row) => !row.pass).length;
  console.warn(
    failures === 0
      ? `PROJECT SUITE: pass (${results.length} assertions)`
      : `PROJECT SUITE: ${failures} FAILURE(S) of ${results.length} assertions`,
  );
  if (failures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  process.exitCode = 1;
  console.error(
    `Project suite could not run: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
} finally {
  await sql.end();
}
