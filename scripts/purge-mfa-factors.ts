/**
 * One-off: remove every enrolled MFA factor and its challenges.
 *
 * The application no longer challenges anything, so these rows are inert, but
 * the user asked for the slate to be clean. Prints what it removed.
 *
 *   node --env-file=.env.local scripts/_mfa-purge.ts
 */
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set.");
}

const sql = postgres(databaseUrl, { max: 1 });

const before = await sql`
  select f.id, f.factor_type, f.status, u.email
    from auth.mfa_factors f
    join auth.users u on u.id = f.user_id
`;
console.warn("factors before: " + JSON.stringify(before, null, 1));

const challenges = await sql`delete from auth.mfa_challenges returning id`;
const factors = await sql`delete from auth.mfa_factors returning id`;

console.warn(
  `deleted ${challenges.length} challenge(s) and ${factors.length} factor(s)`,
);

console.warn(
  "factors after: " +
    JSON.stringify(await sql`select count(*)::int as n from auth.mfa_factors`),
);
console.warn(
  "aal2 sessions remaining: " +
    JSON.stringify(
      await sql`select count(*)::int as n from auth.sessions where aal = 'aal2'`,
    ),
);

await sql.end();
