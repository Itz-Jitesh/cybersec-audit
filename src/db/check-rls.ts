/**
 * Read-only RLS status report. Confirms that every public table has row level
 * security enabled and counts the installed policies.
 *
 *   node --env-file=.env.local src/db/check-rls.ts
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

interface TableRow {
  relname: string;
  relrowsecurity: boolean;
}
interface CountRow {
  count: number;
}

try {
  const tables = await sql<TableRow[]>`
    select c.relname, c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `;
  const withoutRls = tables.filter((table) => !table.relrowsecurity);
  console.warn(
    `tables: ${tables.length}, RLS enabled: ${tables.length - withoutRls.length}`,
  );
  for (const table of withoutRls) {
    console.warn(`  MISSING RLS: ${table.relname}`);
  }

  const policies = await sql<CountRow[]>`
    select count(*)::int as count from pg_policies where schemaname = 'public'
  `;
  console.warn(`policies: ${policies[0].count}`);

  const helpers = await sql<CountRow[]>`
    select count(*)::int as count from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'is_active_member', 'is_workspace_admin', 'is_team_lead',
        'is_project_member', 'can_manage_project'
      )
  `;
  console.warn(`helper functions present: ${helpers[0].count} / 5`);

  console.warn(
    withoutRls.length === 0 && helpers[0].count === 5
      ? "RLS CHECK: pass"
      : "RLS CHECK: incomplete",
  );
} finally {
  await sql.end();
}
