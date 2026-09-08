/**
 * Applies the hand-authored SQL files under supabase/migrations/ that
 * drizzle-kit does not manage.
 *
 *   node --env-file=.env.local src/db/apply-sql.ts supabase/migrations/0001_extensions.sql
 *
 * This machine has no psql, no Supabase CLI and no Docker, so the files are
 * executed with the same postgres driver the seed script uses. postgres.js
 * sends a parameter-free, multi-statement file over the simple query
 * protocol, which is what a `psql -f` invocation does.
 *
 * Run order (BUILDPHASES.md, Phase 3):
 *   1. supabase/migrations/0001_extensions.sql   (this script)
 *   2. pnpm db:migrate                            (drizzle/0000_*.sql)
 *   3. supabase/migrations/0002_search_vector.sql (this script)
 *   4. supabase/migrations/0003_triggers.sql      (this script)
 *
 * Every file is idempotent — "if not exists" / "or replace" / "drop trigger
 * if exists" throughout — so a failed run can simply be resumed.
 */

import postgres from "postgres";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

const databaseUrl = required("DATABASE_URL");
const sql = postgres(databaseUrl, { max: 1 });

const paths = process.argv.slice(2);

if (paths.length === 0) {
  console.warn(
    "Usage: node --env-file=.env.local src/db/apply-sql.ts <file.sql> [<file.sql> ...]",
  );
  process.exitCode = 1;
} else {
  try {
    for (const path of paths) {
      console.warn(`Applying ${path} ...`);
      await sql.file(path);
      console.warn("  applied.");
    }
    console.warn("Done.");
  } catch (error) {
    process.exitCode = 1;
    console.error(
      `Apply failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await sql.end();
  }
}