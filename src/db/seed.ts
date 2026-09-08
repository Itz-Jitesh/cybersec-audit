/**
 * Idempotent seed. Run with `pnpm db:seed`.
 *
 * Creates the three teams the workspace ships with and one open administrator
 * invite for SEED_ADMIN_EMAIL, which is what makes the first sign-in possible:
 * handle_new_user rejects any email without a matching open invite, so without
 * this row nobody can get in.
 *
 * Running it twice makes no new rows. It is the only file permitted to talk to
 * the database outside the application's own access paths, and it uses the
 * migration connection string rather than the service role key.
 *
 * Imports are relative and the file is run by Node's native type stripping, so
 * no extra tooling is needed to execute it.
 */

import postgres from "postgres";

import { DEFAULT_TEAMS, WORKSPACE_NAME } from "../lib/constants/defaults.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set.`);
  }
  return value;
}

const databaseUrl = required("DATABASE_URL");
/** The email that receives the bootstrap administrator invite. */
const adminEmail = required("SEED_ADMIN_EMAIL");

const sql = postgres(databaseUrl, { max: 1 });

async function seed(): Promise<void> {
  console.warn(`Seeding workspace "${WORKSPACE_NAME}".`);

  for (const team of DEFAULT_TEAMS) {
    const [row] = await sql`
      insert into teams (name, slug, color)
      values (${team.name}, ${team.slug}, ${team.color})
      on conflict (slug) do nothing
      returning id
    `;
    console.warn(
      row
        ? `  created team ${team.slug}`
        : `  team ${team.slug} already present`,
    );
  }

  // The partial unique index on (email) where accepted_at is null already
  // guarantees one open invite per address, so the conflict clause is what makes
  // a second run a no-op rather than an error.
  const [invite] = await sql`
    insert into invites (email, role, expires_at)
    values (${adminEmail}, 'admin', now() + interval '30 days')
    on conflict do nothing
    returning token
  `;

  if (invite) {
    console.warn(`  created admin invite for ${adminEmail}`);
    console.warn(`  invite token: ${invite.token}`);
  } else {
    console.warn(
      `  an open or accepted invite for ${adminEmail} already exists`,
    );
  }

  console.warn("Seed complete.");
}

try {
  await seed();
} finally {
  await sql.end();
}
