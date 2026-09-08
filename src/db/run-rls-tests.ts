/**
 * Runner for supabase/tests/rls.sql — the RLS assertion suite from
 * docs/04-DATA-MODEL.md §10.
 *
 * `pnpm db:test:rls` shells out to psql, which is not installed on this
 * machine, so this runner executes the same SQL file through the postgres
 * driver the rest of the database tooling uses. It needs a dedicated
 * connection because the suite's result table is a temp table that lives for
 * the session.
 *
 *   node --env-file=.env.local src/db/run-rls-tests.ts
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
  await sql.file("supabase/tests/rls.sql");

  const results = await sql<ResultRow[]>`
    select test, pass, detail from pg_temp.rls_test_results order by test
  `;

  for (const row of results) {
    console.warn(`${row.pass ? "PASS" : "FAIL"}  ${row.test} — ${row.detail}`);
  }

  const failures = results.filter((row) => !row.pass).length;
  console.warn(
    failures === 0
      ? `RLS SUITE: pass (${results.length} assertions)`
      : `RLS SUITE: ${failures} FAILURE(S) of ${results.length} assertions`,
  );
  if (failures > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  process.exitCode = 1;
  console.error(
    `RLS suite could not run: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
} finally {
  await sql.end();
}