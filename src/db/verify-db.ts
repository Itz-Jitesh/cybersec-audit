/**
 * Read-only Phase 3 verification. Prints the evidence the Definition of Done
 * needs: extensions, tables, triggers, the search_vector column, the Drizzle
 * migration journal and the seeded rows.
 *
 *   node --env-file=.env.local src/db/verify-db.ts
 *
 * No psql on this machine, so the same driver as the seed script runs the
 * queries. The script writes nothing; it only selects.
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

/** The 28 tables docs/04-DATA-MODEL.md defines. */
const EXPECTED_TABLES = [
  "audit_log",
  "comment_reactions",
  "comments",
  "cycle_snapshots",
  "cycles",
  "favorites",
  "invites",
  "issue_activity",
  "issue_assignees",
  "issue_attachments",
  "issue_labels",
  "issue_links",
  "issue_relations",
  "issue_subscribers",
  "issues",
  "labels",
  "module_issues",
  "modules",
  "notifications",
  "pages",
  "profiles",
  "project_members",
  "projects",
  "states",
  "team_members",
  "teams",
  "views",
  "workspace_members",
] as const;

/** Triggers docs/04-DATA-MODEL.md §8 requires besides set_updated_at. */
const EXPECTED_TRIGGERS = [
  "assign_issue_sequence",
  "auto_subscribe",
  "fanout_notifications",
  "log_assignee_activity",
  "log_issue_activity",
  "log_label_activity",
  "set_completed_at",
  "set_updated_at",
] as const;

interface ExtensionRow {
  extname: string;
}
interface TableRow {
  table_name: string;
}
interface TriggerRow {
  trigger_name: string;
}
interface ColumnRow {
  column_name: string;
}
interface IndexRow {
  indexname: string;
}
interface CountRow {
  count: number;
}
interface TeamRow {
  name: string;
  slug: string;
}
interface InviteRow {
  email: string;
  role: string;
  accepted_at: Date | null;
}

const results: string[] = [];
let failures = 0;

function report(label: string, ok: boolean, detail: string): void {
  if (!ok) {
    failures += 1;
  }
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

try {
  const extensions = await sql<ExtensionRow[]>`
    select extname from pg_extension
    where extname in ('pgcrypto', 'citext')
    order by extname
  `;
  const extensionNames = extensions.map((row) => row.extname);
  report(
    "extensions",
    extensionNames.includes("pgcrypto") && extensionNames.includes("citext"),
    extensionNames.join(", ") || "none found",
  );

  const tables = await sql<TableRow[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;
  const tableNames = tables.map((row) => row.table_name);
  const missingTables = EXPECTED_TABLES.filter(
    (name) => !tableNames.includes(name),
  );
  report(
    "public tables",
    missingTables.length === 0,
    `${tableNames.length} present${
      missingTables.length > 0 ? `, missing: ${missingTables.join(", ")}` : ""
    }`,
  );

  const triggers = await sql<TriggerRow[]>`
    select distinct trigger_name from information_schema.triggers
    where trigger_schema = 'public'
    order by trigger_name
    limit 100
  `;
  const triggerNames = triggers.map((row) => row.trigger_name);
  const missingTriggers = EXPECTED_TRIGGERS.filter(
    (name) => !triggerNames.includes(name),
  );
  report(
    "triggers",
    missingTriggers.length === 0,
    `${triggerNames.length} distinct${
      missingTriggers.length > 0 ? `, missing: ${missingTriggers.join(", ")}` : ""
    }`,
  );

  const searchVector = await sql<ColumnRow[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'issues'
      and column_name = 'search_vector'
  `;
  report(
    "issues.search_vector",
    searchVector.length === 1,
    searchVector.length === 1 ? "generated column present" : "not found",
  );

  const ginIndex = await sql<IndexRow[]>`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'issues'
      and indexname = 'issues_search_vector_idx'
  `;
  report(
    "issues_search_vector_idx",
    ginIndex.length === 1,
    ginIndex.length === 1 ? "gin index present" : "not found",
  );

  try {
    const journal = await sql<CountRow[]>`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `;
    report(
      "drizzle journal",
      journal[0].count === 1,
      `${journal[0].count} migration(s) recorded by db:migrate`,
    );
  } catch {
    report("drizzle journal", false, "not found — pnpm db:migrate not run yet");
  }

  const teams = await sql<TeamRow[]>`
    select name, slug from teams order by slug limit 10
  `;
  report(
    "seeded teams",
    teams.length === 3,
    teams.map((team) => team.slug).join(", ") || "none",
  );

  const invites = await sql<InviteRow[]>`
    select email, role::text as role, accepted_at from invites
    order by created_at desc limit 5
  `;
  const openAdminInvite = invites.find(
    (invite) => invite.role === "admin" && invite.accepted_at === null,
  );
  report(
    "open admin invite",
    openAdminInvite !== undefined,
    openAdminInvite
      ? `${openAdminInvite.email} (expires per seed: 30 days)`
      : "no open admin invite — first sign-in would be rejected",
  );
} catch (error) {
  process.exitCode = 1;
  console.error(
    `Verification could not run: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
} finally {
  await sql.end();
}

for (const line of results) {
  console.warn(line);
}
if (results.length > 0) {
  console.warn(
    failures === 0
      ? "PHASE 3 VERIFY: pass"
      : `PHASE 3 VERIFY: ${failures} check(s) failed`,
  );
}