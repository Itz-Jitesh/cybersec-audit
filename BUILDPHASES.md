# BUILDPHASES.md — CyberSec Atria IT Project Tracker

Working build tracker. Derived from `docs/07-BUILD-PHASES.md`, which stays authoritative if the two ever disagree.

## Rules of engagement

1. One phase per working session. Never start the next phase early.
2. A phase is done only when every checkbox is ticked **and** its Definition of Done is satisfied.
3. `pnpm typecheck` and `pnpm lint` must pass before a phase is declared done.
4. Commit at the end of each phase with the message `phase N: <name>`, then stop.
5. Wait for the user's explicit confirmation before beginning the next phase.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done and confirmed

---

## Phase 1 — Scaffold & tooling  `[~]` awaiting review

- [x] Next.js 15 App Router + TypeScript strict, pnpm, `src/` source root
- [x] Locked dependency set installed, nothing extra
- [x] Tailwind v4 wired to the full token set from `docs/05-DESIGN-SYSTEM.md` §1
- [x] `next/font` for Inter (400/500/600) and JetBrains Mono (400/500)
- [x] Type scale defined exactly, including `text-2xs` 10px and `text-sm` 13px/20px
- [x] shadcn/ui initialised (new-york, neutral, CSS variables) with all listed primitives
- [x] ESLint + Prettier + `simple-import-sort`, `pnpm lint` clean
- [x] Folder structure from `docs/03-TRD.md` §2 created, `.gitkeep` where empty
- [x] Drizzle + drizzle-kit configured
- [x] Supabase clients at `src/lib/supabase/{client,server,middleware}.ts`
- [x] Env validation with zod at `src/lib/env.ts`, fails loudly at boot
- [ ] Deployed to Vercel and building — **needs the user's Vercel and Supabase accounts**

### Notes from this phase

- The shadcn CLI reserves `bg-accent` for its raised hover surface, which in this
  design is `--bg-70` rather than the brand blue. The CSS variable `--accent`
  still holds the blue exactly as the design doc specifies; the utility class for
  it is `bg-brand`, and `bg-accent` is mapped to `--bg-70` so the vendored
  primitives inherit the correct Plane surfaces.
- Every shadcn semantic variable (`--background`, `--primary`, `--border`, and so
  on) is defined in terms of a design token, so the primitives reskin with
  everything else and none of them carries a colour of its own.
- `docs/tokens-raw.txt` and `docs/layout-raw.txt` do not exist yet, so the
  approximate palette from `docs/05-DESIGN-SYSTEM.md` §1 is in place. Once the
  real values are extracted from `app.plane.so`, replacing the token block in
  `src/app/globals.css` is the only change required.

**DoD:** `pnpm dev` renders a dark page using the tokens; Vercel preview URL is live.

---

## Phase 2 — Design system realisation  `[~]` awaiting review

- [x] `globals.css` token block complete
- [x] `PriorityIcon`, `StateIcon`, `MemberAvatar`, `AvatarGroup`, `LabelChip`, `DateChip`, `IssueIdBadge`, `Kbd`, `EmptyState`, `ProgressRing`, `InlineEditableText`
- [x] All primitives rendered on `/dev/kitchen-sink` in every meaningful state
- [x] Hover/focus/active states match `docs/05-DESIGN-SYSTEM.md` §5
- [x] Zero raw hex values under `src/components/` and `src/app/` (verified by grep)

### Notes from this phase

- Only `state-icon.tsx` and `label-chip.tsx` use an inline `style`, and both use
  it solely for a colour that arrives as a prop from the database, which is the
  single exemption the conventions allow.
- `MemberAvatar` picks its fallback background from eight existing tokens rather
  than a new palette, so avatars reskin with everything else. The hash is FNV-1a,
  which is pure and gives the server and the client the same colour, so there is
  no hydration mismatch.
- The kitchen-sink demo data lives in `src/lib/dev/kitchen-sink-fixtures.ts`. It
  contains literal colours because it stands in for rows from the states and
  labels tables, and it sits outside `src/app` and `src/components` so the
  no-raw-colour grep over those directories stays clean.
- The prompt pack points at `docs/06-UX-LAYOUT-SPEC.md` §5 for the interaction
  table, but that section is the `/home` route. The table is
  `docs/05-DESIGN-SYSTEM.md` §5, which is what was implemented.
- Verified by grep over the compiled stylesheet that every custom utility
  resolves to a variable rather than a literal: `.h-row` to `var(--row-h)`,
  `.text-priority-urgent` to `var(--priority-urgent)`, and so on.
- Not verified in a browser. The Chrome extension was not connected, and
  Playwright is a phase 12 dependency, so it was not added early. The page needs
  a visual pass by eye.

**DoD:** the kitchen-sink page shows every primitive in every state and reads as Plane.

---

## Phase 3 — Database schema  `[~]` applied, awaiting review

**Blocked on:** `DATABASE_URL` from a Supabase project.

- [x] Every enum, table and index from `docs/04-DATA-MODEL.md` as Drizzle schema files
- [x] Drizzle migration generated; a second `db:generate` reports no changes
- [x] Hand-authored SQL for extensions, the `search_vector` generated column, and all triggers
- [x] Idempotent seed: 3 teams and the bootstrap administrator invite
- [x] Migrations applied to Supabase
- [x] Seed executed twice against the real database

### Run order

Not simply "Drizzle then SQL", because the extensions have to exist before any
table is created:

1. `supabase/migrations/0001_extensions.sql`
2. `drizzle/0000_*.sql` via `pnpm db:migrate`
3. `supabase/migrations/0002_search_vector.sql`, then `0003_triggers.sql`

### Decisions that departed from the documents

Three gaps in `docs/04-DATA-MODEL.md` forced a choice. Each is listed here
because each is a change the user should either confirm or overrule.

- **`comments` and `comment_reactions` have no column list.** The data model
  references comments in its index list, its trigger table and its RLS matrix,
  but never defines the table. The columns implemented follow the feature
  description in `docs/02-PRD.md` §4: `content_html`, `content_json`,
  `is_edited`, and a reactions table keyed on `(comment_id, user_id, emoji)`.
  Mentioned users are parsed out of the HTML by `fanout_notifications`, so
  mentions need no table of their own.
- **`invites.invited_by` and `teams.created_by` are now nullable.** The document
  marks both not-null with a foreign key to `profiles`. The first administrator
  has to be invited before any profile can exist, because `handle_new_user`
  rejects an email with no open invite — so a not-null inviter makes the
  workspace impossible to bootstrap. Null now means "created by the seed
  script"; every invite made from the admin panel still carries a real inviter.
- **There is no `workspaces` table.** The prompt pack asks the seed to insert a
  workspace row, but the data model defines no such table and states there is
  exactly one workspace. The name is therefore a constant, `WORKSPACE_NAME` in
  `src/lib/constants/defaults.ts`, rather than a row.

### Other notes

- `auth.users` is not modelled in Drizzle. Declaring it made drizzle-kit emit a
  `CREATE TABLE` for a table Supabase already owns, so the foreign key from
  `profiles.id`, with its `ON DELETE CASCADE`, is added by hand at the top of
  `0003_triggers.sql`.
- `assign_issue_sequence` increments and reads `sequence_counter` in one
  `UPDATE ... RETURNING`, so two concurrent inserts into the same project
  serialise on the project row and cannot receive the same number.
- `fanout_notifications` serves both the `comments` and `issue_activity`
  triggers. Mention ids are collected into an array before the insert rather
  than inside it, because `NEW` has no `content_html` field on the
  `issue_activity` side and referencing it there would fail at execution time.
- `pnpm db:seed` runs through Node's native TypeScript stripping, so no test
  runner or transpiler was added for it.
- **Applied on 8 Sep 2026, verified 8/8 PASS.** With no psql, CLI or Docker on
  this machine, the three hand-authored files ran through
  `src/db/apply-sql.ts` (the same `postgres` driver as the seed script) in the
  documented run order, with `pnpm db:migrate` between 0001 and 0002. The
  direct `db.<ref>.supabase.co` host is IPv6-only and unreachable here, so
  `DATABASE_URL` uses the session pooler at `aws-0-ap-northeast-1` with
  `sslmode=require`; the region was located by probing the shared gateways
  with the project's own credentials. `src/db/verify-db.ts` reports the
  evidence: extensions, 28 tables, 8 triggers, the `search_vector` column and
  its GIN index, one recorded Drizzle migration, three seeded teams, one open
  admin invite. Seed run 2 changed nothing, proving idempotency, and
  `db:generate` after apply reports no schema changes. First-apply NOTICEs
  from 0003 ("does not exist, skipping") are the idempotent drop statements,
  not errors.
- `pnpm db:test:rls` shells out to `psql`, which is not installed on this
  machine. Phase 4 needs either the Postgres client tools or the Supabase CLI.

**DoD:** schema visible in the Supabase dashboard; `drizzle-kit push` is a no-op; seed runs twice cleanly.

---

## Phase 4 — RLS & authorization  `[x]` done

- [x] Helper functions: `is_active_member`, `is_workspace_admin`, `is_team_lead`, `is_project_member`, `can_manage_project`
- [x] RLS enabled with policies on every table per `docs/04-DATA-MODEL.md` §9
- [x] `src/lib/auth/permissions.ts` with `assertCan()` mirroring the policy matrix
- [x] `supabase/tests/rls.sql` passing every negative assertion — 36 assertions green
- [x] Three authorization defects found on audit and fixed in `0005_security_fixes.sql`

### Defects found auditing phases 3 and 4

All three were live in the applied database before this migration.

- **An administrator could edit their own `workspace_members` row.** The policy
  checked `is_workspace_admin` and stopped there, so a `co_president`, who
  passes that check, could promote themselves to `admin`, and any administrator
  could undo their own deactivation. Role changes now require a second
  administrator, on both update and delete.
- **`profiles.email` was editable by its owner.** A policy restricts which rows
  an update touches but not which columns, and the `BEFORE UPDATE` column guard
  the specification calls for had not been written. Email is the key
  `handle_new_user` matches invites on, so a member could have aligned their
  address with a pending administrator invite. `guard_profile_immutable_columns`
  now raises on any change to `id` or `email`.
- **`fanout_notifications` leaked issue content across project boundaries.** It
  parses recipient ids out of `data-mention-id` attributes in comment HTML,
  which the commenter controls, and inserts as `SECURITY DEFINER`, so the write
  bypassed RLS entirely. Mentioning any workspace user id delivered them the
  issue title and the comment text regardless of project membership. Every
  candidate recipient is now checked with `is_project_member` against the
  issue's own project.

### Notes on the test suite

- Five new assertions cover the fixes, each paired with a positive control so a
  test cannot pass by simply failing to observe anything: an administrator still
  changes another member's role, a member still edits their own bio, and a
  mention still reaches a project member.
- The mention assertions count inbox rows as the table owner rather than as the
  commenter. Counting them while impersonating the commenter proved nothing,
  because `notifications_select` limits every reader to their own rows, so both
  counts came back zero whether the fix worked or not. The first version of this
  test was vacuous for exactly that reason.
- Assertion blocks must `commit`. Results live in a temp table, so a block that
  rolls back discards its own verdict along with its side effects.
- The suite runs through `src/db/run-rls-tests.ts` rather than `psql`, which is
  not installed on this machine. It is repeatable: run three times in a row, it
  reports 36 passes each time and leaves no fixture rows behind.

## Phase 5 — Authentication  `[~]` code complete, awaiting dashboard setup

- [x] `/sign-in` with Google and GitHub OAuth
- [x] `/auth/callback` route handler
- [x] `handle_new_user` trigger enforcing invite-gating, applied and asserted
- [x] `middleware.ts`: session refresh, route protection, inactive-member rejection, MFA gate
- [x] `/invite/[token]` page with distinct expired and already-used states
- [x] TOTP enrolment and challenge at `/mfa`, enforced for privileged roles
- [x] Rejection UX for uninvited emails
- [x] `src/lib/auth/session.ts`, which phase 4 had left unwritten
- [x] `supabase/tests/auth.sql` — 11 assertions on the invite gate
- [ ] Google and GitHub providers enabled in the Supabase dashboard
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to the project's real publishable key
- [ ] End-to-end sign-in performed by a human

### Where the invite gate lives, and why

In the `handle_new_user` trigger, not in the callback route. Supabase creates the
`auth.users` row the moment a provider returns a verified identity, before any
application code runs, so a check in the route handler would leave a real
account behind for anyone who completed a Google consent screen. Raising inside
the trigger aborts that insert in the same transaction. The auth suite asserts
this directly: after a rejected attempt there is no profile **and no auth user**.

The callback matches on the string `NO_INVITE` to show the rejection screen
rather than a generic failure, because someone turned away here has usually just
been told by a friend that they have access.

### Notes from this phase

- Membership and the second-factor requirement are evaluated only in middleware.
  The callback redirects to `/home` and lets middleware decide, so the rule has
  one implementation rather than two that can drift.
- `getSession()` uses `supabase.auth.getUser()`, not `getSession()` from the SDK.
  The latter reads the cookie without verifying it, so a forged or stale cookie
  would be believed.
- `src/lib/env.ts` was split, with the server half moved to `env.server.ts` and
  marked `server-only`. The combined module was imported by client components,
  which put the *names* of the secret variables into the browser bundle. No
  value ever leaked — verified by grepping `.next/static` — but the names are
  gone now too.
- `SUPABASE_SERVICE_ROLE_KEY` became optional at boot and is read through
  `requireServiceRoleKey()`. Nothing in the request path uses it, and requiring
  it broke every build on a machine with no reason to hold it.
- The RLS suite's five test users are now provisioned through the invite gate
  rather than inserted directly, since the gate would otherwise reject them.
  This is a better fixture: if provisioning breaks, the suite fails instead of
  passing against rows the application could never have produced.
- `pnpm db:test:rls` no longer shells out to `psql`, which is not installed
  here. Both suites run through the postgres driver the rest of the tooling
  uses. `pnpm db:test` runs them together.
- `public/brand/logo-full.svg` is a **placeholder** lockup. Replace it with the
  real asset; nothing else needs to change.
- Supabase issues no printed recovery codes for TOTP, so `/mfa` says an admin
  can remove the factor instead of offering a recovery-code link.

### Verified

- Auth suite: 11 assertions green, run repeatedly, no fixture rows left behind.
- RLS suite: still 36 assertions green after the fixture change.
- Route behaviour against a running dev server: `/sign-in` and `/invite/:token`
  serve 200 without a session; `/home`, `/my-issues` and `/mfa` redirect to
  `/sign-in`; `/auth/callback` without a code redirects to
  `/sign-in?error=auth_failed`; the rejection state renders the notice and does
  not offer the OAuth buttons.
- No secret name or value appears in the client bundle.
- No `signInWithPassword`, `signInWithOtp`, `signUp` or `signInAnonymously`
  anywhere in `src/`.

### Before this can be used by a real person

`docs/supabase-config.md` has the full list. The short version: enable Google
and GitHub in the dashboard, disable the email provider, set the redirect
allowlist, enable TOTP, and put the project's publishable key in
`.env.local` — it currently still holds the placeholder from phase 1. The
bootstrap administrator invite for `itsjitesh.work@gmail.com` is open and valid.

## Phase 6 — App shell  `[~]` awaiting review

- [x] `(app)/layout.tsx` with sidebar and header
- [x] `AppSidebar` with all sections, collapse, persisted state, `Cmd+\` toggle
- [x] `SidebarProjectTree` reading real teams and projects
- [x] `Header` with breadcrumbs, new-issue button, bell, user menu
- [x] `/home` dashboard with real stat queries
- [x] `loading.tsx` and `error.tsx` at every segment, `not-found.tsx` where a
      dynamic segment can genuinely miss
- [x] A page behind every sidebar link, so no link leads to a 404
- [ ] Seen by a human with a real session

### Notes from this phase

- The navigation tree is three flat queries rather than one relational query
  with `with`. The shape the sidebar needs is a grouping the database cannot
  return directly, and a nested query would fan out into a join per project.
- Every `/home` figure is a SQL aggregate. Counting in the application would
  mean fetching every assigned issue in order to throw all but the number away,
  which `docs/03-TRD.md` §3 rules out.
- A workspace administrator sees every team in the sidebar; everyone else sees
  only their own. That mirrors the RLS boundary, so the tree does not advertise
  teams the user cannot open.
- Projects start collapsed and teams start expanded. A team with eight projects
  would otherwise open into a wall of forty rows.
- Sidebar shape is a preference, so it lives in localStorage through a zustand
  `persist` store and never reaches the server.
- Breadcrumbs are derived from the path against the tree the shell already
  loaded, so they cost no extra query. A segment with no match is dropped
  rather than rendered raw, because a uuid in a breadcrumb tells nobody
  anything.

### Two defects fixed while building this

- **The kitchen sink had become unreachable.** Phase 5's middleware protects
  every route that is not explicitly public, which silently included
  `/dev/kitchen-sink` — the page that exists to be looked at during review.
  `/dev` is now public in development only, and the directory is deleted
  wholesale in phase 12, so it is never reachable in production.
- **Google's brand hexes were sitting in `src/app`.** The mark is now served
  from `public/brand/google-mark.svg`. Those colours are fixed by Google and
  must *not* follow a re-theme, which is precisely what a raw hex inside a
  component would invite.

### Verified

- Typecheck, lint and production build clean; no raw hex outside the vendored
  shadcn primitives; no secret name or value in the client bundle.
- All six shell and dashboard queries executed against the live database
  through a temporary probe route, which has been removed. Confirming this
  mattered: these run on the very first sign-in, so a malformed one would have
  greeted the first real user with an error page.
- Route protection re-checked after the middleware change: `/dev/kitchen-sink`
  serves 200, the removed probe is a 404, and `/`, `/home`, `/my-issues` and a
  project route all redirect to `/sign-in` without a session.
- RLS suite 36 green, auth suite 11 green.

### Not verified

Nobody has signed in yet, so the authenticated shell has not been rendered by a
real session. The workspace also has no projects or issues, so the sidebar tree
and the dashboard will both be empty on first view — that is correct behaviour,
not a fault, and phase 7 is what fills them.

## Phase 7 — Teams & projects  `[~]` awaiting review

- [x] Team CRUD, admin scoped, reachable from `/admin`
- [x] Team detail page with leads, members and a project grid
- [x] Project create modal: name, auto-suggested identifier with a debounced
      uniqueness check, team, lead, icon
- [x] On create, in one transaction: 6 default states, 7 default labels, the
      creator as a project admin
- [x] Project settings: general, members, states editor with drag reorder,
      labels editor, danger zone
- [x] Favorites, appearing in the sidebar
- [x] `supabase/tests/projects.sql` — 9 assertions, green
- [ ] Exercised through the UI by a human with a real session

### The finding that matters most in this phase

**The application's database role bypasses row level security.** `DATABASE_URL`
connects as Supabase's `postgres` role, which carries `BYPASSRLS`. Verified
directly:

```
usr: postgres | superuser: false | bypassrls: true
```

Everything read or written through Drizzle — which is every Server Component and
every Server Action — is therefore **unconstrained by the policies in
`0004_rls.sql`**. Those policies still govern the Supabase client path, and the
RLS suite that exercises them is still meaningful, but they are not what stands
between a member and another team's data at runtime.

`docs/03-TRD.md` §3 anticipates this and permits it: the query "explicitly
scopes by membership". That is what this phase does — every function in
`src/db/queries/project.ts` scopes by membership, and every page calls
`assertCan` before reading. But it is a discipline rather than a mechanism: one
forgotten guard in a future phase is a silent cross-team leak that no test
currently catches, because the RLS suite exercises a path the application does
not use.

**This is worth a decision before phase 8**, which is where the volume of
queries increases sharply. The options, roughly in order of cost:

1. Point the runtime connection at a non-superuser role and keep the `postgres`
   role for migrations and the seed only. RLS then applies to application
   queries and becomes a real second layer rather than a parallel one.
2. Set `role` and `request.jwt.claims` per request on the runtime connection so
   Postgres evaluates policies as the calling user — the pattern `docs/03-TRD.md`
   §3 names first.
3. Keep explicit scoping, and add a test that asserts cross-team isolation
   through the application's own query functions rather than through raw SQL.

Doing nothing is also a choice, but it should be a deliberate one: at present
the `assertCan` call in each action is not a second layer of defence. It is the
only one.

### Notes from this phase

- `createProject` runs its four inserts in one transaction. A project with no
  states cannot hold an issue, and a project whose creator is not a member of it
  is unusable by the person who just made it, so a partial success would be
  worse than a failure.
- `reorderState` gives the moved row the midpoint of its two new neighbours, so
  a drag is a single-row update however long the list is and no other row is
  rewritten.
- `deleteState` refuses in three cases, each with its own code: the state holds
  issues (`STATE_IN_USE`), it is the last one (`LAST_STATE`), or it is the
  default (`DEFAULT_STATE`). The database is the backstop — `issues.state_id` is
  not null — but the action checks first so the user gets a sentence rather than
  a constraint violation.
- Deleting a label is allowed even when issues carry it, because `issue_labels`
  cascades and a tag costs nothing to reapply. Deleting a state is not, because
  an issue must be in some state. The asymmetry is deliberate.
- Both destructive dialogs require the name to be typed, and both actions
  re-check that string server-side. A dialog is a courtesy; the check is the
  control.
- `removeProjectMember` refuses to remove the last project admin, which would
  leave the project unmanageable by anyone below workspace admin.
- The identifier is fixed after creation. Changing it would rewrite the id of
  every issue that has already been linked or mentioned somewhere.
- `@dnd-kit/modifiers` was briefly added for `restrictToVerticalAxis` and then
  removed, since the phase permits only `core` and `sortable`. The modifier is
  four lines written inline instead. `@dnd-kit/utilities` is a real peer of
  `sortable` and is declared explicitly.
- Team management lives on `/admin` rather than waiting for phase 11. Actions
  with no way to reach them are not a feature, and without this there would be
  no way to create a team at all.
- `Toaster` was missing from the root layout. Every action in this phase reports
  its outcome through a toast, so none of them would have said anything.

### Verified

- Typecheck, lint and production build clean; no raw hex outside the vendored
  shadcn primitives.
- All 21 exported server actions call `assertCan` — checked by counting exports
  against guards per file.
- New project suite: 9 assertions green, covering six states, seven labels, one
  project admin, exactly one default state, case-insensitive identifier
  uniqueness, refusal to delete a state that holds issues, and the issue
  sequence starting at one and incrementing without gaps.
- RLS suite 36 green and auth suite 11 green, both unaffected.

### Not verified

No human has signed in, so none of this has been driven through the UI. The
drag-reorder, the debounced identifier check and the typed-confirmation dialogs
are all built to the spec and typecheck, but they have not been used.

## Phase 8 — Issues core  `[~]` awaiting review

- [x] Issue create modal and per-group inline quick-add
- [x] Sequence-ID trigger verified under real concurrency
- [x] List layout: grouping, collapsible sticky headers, inline chip editing
- [x] Issue detail as peek overlay and full page, one implementation
- [x] Sub-issues, relations, links, attachments
- [x] Comments with mentions and reactions
- [x] Activity feed rendered from `issue_activity`
- [x] Archive and delete
- [x] Multi-select with a bulk actions bar
- [ ] Driven through the UI by a human

### The bug this phase found

**Deleting an issue that had a label or an assignee failed outright.**

`issue_labels` and `issue_assignees` cascade from `issues`. On a delete Postgres
removes the issue row first and then fires the referential action that removes
the join rows, so `log_label_activity` and `log_assignee_activity` ran with the
parent already gone and tried to insert an `issue_activity` row pointing at it:

```
insert or update on table "issue_activity" violates foreign key constraint
"issue_activity_issue_id_issues_id_fk"
```

That is most issues. It had gone unnoticed because the activity triggers skip
entirely when `auth.uid()` is null, and every test before this one deleted its
fixtures as the table owner rather than as a signed-in user — so the whole class
of bug was invisible to the existing suites. Fixed in
`0007_activity_cascade_guard.sql`: a row disappearing because its issue was
deleted is not an unassignment or a label removal, and both functions now return
early when the parent is gone.

### Also fixed: the wrong connection pooler

`DATABASE_URL` was the **session** pooler on port 5432, which holds one backend
per client and caps at fifteen. `docs/03-TRD.md` §6 requires the **transaction**
pooler on 6543 for runtime queries. The concurrency test hit the cap directly —
six of twenty inserts failed with `max clients reached` — which is what thirty
people using the app at once would have looked like, except intermittently and
without anything pointing at the cause.

`src/db/index.ts` now prefers `DATABASE_POOL_URL` and falls back to
`DATABASE_URL`, warning in production when it has to. **Set
`DATABASE_POOL_URL` to the transaction pooler URI before real traffic.**

### Notes from this phase

- The list is one query. Assignees, labels and modules are aggregated to JSON
  inside it and sub-issue counts come from a lateral join, so a hundred issues
  is one round trip rather than three hundred.
- `updateIssueOrder` takes the destination state and the two neighbours in a
  single call, so a cross-group drag is one write and one activity row rather
  than a state change followed by a reorder.
- `setParent` walks up the ancestor chain rather than checking only the direct
  parent. Without that, A→B→A is accepted and every renderer that walks the
  sub-issue tree hangs.
- `addRelation` checks write permission on **both** issues. Otherwise a relation
  is a way to write a row into a project you cannot see.
- `addAttachment` rejects a storage path that does not begin with
  `{projectId}/{issueId}/`, so a caller cannot register a row pointing at
  someone else's object in the bucket.
- Comments can be deleted by the author or a project manager, but edited only by
  the author. Putting words in someone's mouth is a different power from
  removing them.
- Optimistic updates follow the five-step contract in `docs/03-TRD.md` §3.1.
  Archiving patches the row **out** of the cache rather than editing a field, so
  the list never refetches whole just to drop one row.
- Reactions are a fixed set of seven rather than a full picker. `emoji-mart` is
  three packages and a search grid; the reactions a tracker actually collects fit
  on one row. Flagged here since the prompt named the dependency.
- `@tiptap/pm` was installed alongside the named TipTap packages — it is their
  required peer, not an extra choice.

### Verified

- **20 concurrent inserts across 10 connections produced exactly 1..20**, no
  duplicates, no gaps, and the project counter landed on 20. This is the
  `UPDATE ... RETURNING` in `assign_issue_sequence` doing its job.
- 14 further checks against the live database, run as a signed-in user so the
  activity triggers actually fire: the created row, state changes carrying both
  display names, priority, rename keeping both titles, label and assignee
  entries, `auto_subscribe`, `completed_at` set and cleared as the state group
  crosses the completed boundary, archived issues leaving the list, the delete
  that used to fail, and `is_project_member` returning false for a workspace
  member who is in no team — the exact check `assertCan` makes.
- All 17 exported issue actions reach a permission guard, checked by parsing the
  file rather than by counting occurrences.
- RLS 36, auth 11, project 9, all green. Typecheck, lint and build clean, no raw
  hex outside the vendored primitives.

### Not verified

Still nobody signed in. The list, the peek overlay, the editor, drag ordering
and the bulk bar have never been rendered with real data by a person. Everything
above is the database and the server actions; the UI is built to spec and
compiles, and that is a weaker claim.

## Phase 9 — Views & filtering  `[~]` awaiting review

- [x] `FilterBar`: layout switcher, filters (state, priority, assignee, label, cycle, module, target date), group-by, display properties, sort, search, removable filter chips
- [x] List layout with dynamic grouping and working collapse
- [x] Kanban with dnd-kit: cross-column state change, intra-column reorder, optimistic, collapsible columns, 50-card pages
- [x] Calendar with drag-to-reschedule
- [x] Spreadsheet with sticky first column, sortable headers, inline editing
- [x] Per-user layout, filter and display persistence in localStorage
- [x] Saved Views CRUD with private/public access, backed by the `views` table
- [x] Virtualisation for list and spreadsheet above 100 rows
- [x] `supabase/tests/views.sql` — 9 assertions on the view access matrix
- [ ] Driven through the UI by a human

**DoD:** all four layouts render the same filtered set; switching layouts preserves filters. Met — see below.

### How switching layouts preserves filters

One store, `src/stores/project-view-store.ts`, holds layout, filters and display
properties keyed by project id. The four layout components take rows and render
them; none of them owns a filter. Switching layouts therefore changes which
component renders and nothing else, and the same is true of a saved view: it is
written into that store and the issues screen is navigated to. There is no
second code path for "viewing a view".

That the filter set survives a reload falls out of the same decision — the store
persists — which is what the phase asks for by "per-user layout and filter
persistence".

### The UI glitch this phase found

`FilterBar` drew its active-filter count and its checkbox ticks in
`bg-accent/20 text-accent` and `border-accent bg-accent`. Phase 2 remapped
`--color-accent` to `--bg-70`, shadcn's raised hover surface, because shadcn
reserves `bg-accent` for exactly that; the brand blue is exposed as `bg-brand`.
So the badge was grey on grey and a ticked checkbox looked identical to an
unticked one. Now `brand`.

### Notes from this phase

- Virtualisation is hand-written (`src/hooks/use-virtual-rows.ts`) because the
  dependency set is closed and a fixed row height makes windowing arithmetic
  rather than measurement. It takes either one height or an array of them: the
  spreadsheet is uniform 36px rows, but the grouped list interleaves 36px
  headers with 38px rows, so that path builds prefix sums and binary-searches
  them. Below 100 rows it disables itself and reports the full range — two
  hundred DOM nodes cost less than the scroll handler that would avoid them, and
  a list that windows at twenty rows is a list where Cmd+F finds nothing.
- The list now owns its scroll container rather than scrolling the page. That is
  what windowing needs, and it also makes the sticky group headers stick within
  the list, which is what the spec asks for.
- `groupBy` is presentational: `buildGroups` runs on rows already in hand and
  the server query ignores the field. It is therefore in the display props, not
  in the query key.
- The kanban drop sends the destination state and both neighbours in one call,
  so a cross-column move is a single write and a single activity row.
- Calendar drops set `target_date` only. Issues without one do not appear, and
  the bar says how many are hidden — a calendar that invents a date for an
  undated issue is one you cannot trust.
- Duplicating a view always produces a private view owned by whoever duplicated
  it. Copying a public view is not a way to publish under someone else's name,
  and someone else's private view is not visible so cannot be copied at all.
- Editing a view is the owner's alone; deleting it is the owner's or a project
  manager's. A manager can remove a view they object to but cannot rewrite what
  it means and leave another person's name on it.
- `savedFilterSchema` omits `projectId`. A stored filter blob that could name
  its own project would be a way to read another project's issues through a view
  you own.
- Every assertion block in `views.sql` commits rather than rolls back, for the
  reason phase 4 recorded: the verdict lives in a temp table written by the same
  transaction, so a rollback discards the answer along with the attempt and the
  test reads as missing rather than failing.

### Verified

- Typecheck, lint and production build clean. No raw hex outside the vendored
  shadcn primitives; no `bg-accent`/`text-accent` outside them either.
- View suite 9 green, covering: the owner reads their own private view; another
  project member cannot; that member does read the public one; a member of
  another team reads neither; a non-owner can neither edit nor delete a public
  view; a project manager can delete a view they do not own; a member of another
  team cannot create a view in the project; and nobody can create a view owned
  by someone else.
- RLS 36, auth 11, project 9, sanitiser 35 — all unaffected and green.
- Issues route first load 242 kB with all four layouts and dnd-kit, against
  335 kB before the audit with only the list.

### Not verified

Still nobody signed in. The drag interactions in particular — kanban reorder,
kanban cross-column, calendar reschedule — are the kind of thing that compiles
and typechecks and is still wrong in the hand. Column collapse, the "+N more"
day popover, spreadsheet horizontal scroll under a sticky column, and the
windowing boundary at a hundred rows have all been built to spec and none has
been scrolled by a person.

---

## Audit — bugs and performance, after phase 9

Found by reading the whole tree rather than by driving it, since nobody has
signed in yet. Fixed in one pass; commit `976e732`.

### Correctness

1. **Optimistic updates never applied.** The list rendered
   `["issues", projectId, groupBy, filters]`, every mutation read and wrote
   `["issues", projectId]`. The patch landed on a cache entry nobody rendered,
   so each chip edit waited on the server round trip and the refetch.
2. **Filters were dead for thirty seconds.** `groupBy` was in the query key
   although the server query ignores it, and `initialData` seeded every new key
   with the unfiltered rows — which counts as fresh under `staleTime`, so the
   fetch never ran.
3. **Group collapse did nothing.** `GroupHeader` computed `collapsed` and
   `ListLayout` never used it. The chevron rotated; the rows stayed.
4. **The description editor wrote on every parent render.** The flush effect
   depended on `onAutosave`, passed as an inline arrow, so its cleanup ran on
   every render — cancelling the debounce and firing a write. The timer handle
   was never nulled, so every later render fired another.

### Performance

5. **`postgres(..., { max: 1 })`** serialised every query in the process. The
   issues page issues eight reads in `Promise.all`; they ran one at a time.
   Now 10, with idle and connect timeouts.
6. **No request-level memoisation.** `getSession`, `getCurrentUser` and the
   four permission predicates each re-ran per call site — a Supabase auth round
   trip and a join for the layout and again for the page, plus one
   `isWorkspaceAdmin` per team in the layout's `canCreateProject` loop. All now
   wrapped in React `cache()`.
7. **Field edits revalidated the issues route**, so Next re-rendered the whole
   page server-side and streamed it inside the action response — for a change
   the browser was already showing. Split into `revalidateProject` (structural)
   and `revalidateAggregates` (`/home`, `/my-issues` only).
8. **The list route shipped the editor.** `IssueDetail` and `RichEditor` are
   now dynamic. First load 335 kB to 195 kB.
9. **Barrel imports.** `radix-ui` is imported from 22 files; without
   `optimizePackageImports` the whole primitive set compiles on every dev edit.
   Added, along with `lucide-react` and `date-fns`. `pnpm dev` runs Turbopack.
10. **Render fan-out.** `IssueListRow` memoised, its handler bag memoised,
    `buildGroups` memoised, and the collapse store read through selectors
    rather than by subscribing to the whole store.

### Known, not changed

- **Middleware costs two round trips on every request** — `auth.getUser()`
  against Supabase plus the `workspace_members` lookup — including every
  client-side navigation and every server action. It is the remaining floor on
  navigation latency. Reducing it means trusting something cached, which is an
  authorization decision, not a performance one.
- **No virtualisation.** Two hundred rows each mount five Radix dropdown roots.
  It is a phase 9 item and is still open.
- **`DATABASE_POOL_URL` is still unset**, so runtime queries use the session
  pooler on 5432, capped at fifteen clients.
- The hand-rolled sanitiser has been swapped for DOMPurify. See the note at
  the end of this file.

## Phase 10 — Cycles, modules, realtime, search  `[~]` awaiting review

- [x] Cycle CRUD, assignment, detail with burndown, completion and transfer flow
- [x] `cycle_snapshots` via Vercel Cron
- [x] Module CRUD, issue assignment, progress
- [x] Supabase Realtime: per-project channel, surgical cache patching
- [x] Notification fan-out trigger, inbox popover, `/notifications`
- [x] `Cmd+K` palette with full-text issue search and command mode
- [x] Keyboard shortcuts from `docs/06-UX-LAYOUT-SPEC.md` §15 plus the `?` cheat sheet

### Audit after phase 10

The phase-10 commit was reported done while three of its items were only half
built, so everything above was re-checked against the docs rather than trusted.
What that found, and what was done about it:

**Authorization — two real holes, both fixed.**

- `projects/[projectId]/cycles/page.tsx` and `cycles/[cycleId]/page.tsx` both
  called `assertCan(project.read)` and then discarded the result. Reads go
  through Drizzle, which bypasses RLS, so that check was the only thing in the
  way: any signed-in member could open any team's cycle list and burndown by
  id. Both now `notFound()` when the check fails.
- The `module_issues` policies checked membership of the *issue's* project and
  never looked at the module's. Since anyone may create an issue in their own
  project, a member of one team could attach their issue to any module in the
  workspace. `supabase/migrations/0008_module_issue_project_guard.sql` adds a
  `module_project_id` helper and rewrites all four policies to require both
  projects and to require that they are the same project. Found by a new
  assertion, not by reading.

**Completeness — the modules UI did not exist.** `src/actions/modules.ts` and
`src/db/queries/modules.ts` were complete, but `/projects/[id]/modules` was
still the phase-6 placeholder, so none of it was reachable. Built: the card
grid list (`docs/06-UX-LAYOUT-SPEC.md` §10), the detail page with description,
progress ring, status control and delete, and the attach/detach issue panel
with a debounced picker.

**Completeness — the palette had no command mode.** `>` now switches the
palette to actions only (create issue, go to home / my issues / notifications,
toggle sidebar, sign out), per `docs/06-UX-LAYOUT-SPEC.md` §13, and the search
debounce was corrected from 120ms to the 200ms the spec sets. Cycle and module
results now open their detail pages, which exist as of this phase.

**Dead controls.** The header's "New issue" button had no handler at all, and
"Profile settings" pointed at `/settings/profile`, which does not exist. The
button now opens the create modal for the project in the current path (and is
hidden where there is no project); the dead menu item was removed.

**Performance.** The app shell ran one `assertCan(team.manage)` per team on
every page in the app — six queries for the current team list — to decide
whether to show one button. `leadsAnyTeam` answers it with a single row.

**Test brittleness.** Two RLS assertions counted every project in the database
and expected exactly two, so they began failing the moment a real project
existed. They are now scoped to the suite's own fixtures.

### Not verified

- No screen has been driven by a human or a browser driver. Everything below
  the DoD line is asserted at the database and the type level only.
- The realtime DoD ("a drag in one browser appears in a second in a second")
  needs two browsers and has not been observed.
- `/my-issues` and `/drafts` are still placeholders. Neither appears in any
  phase checklist in `docs/07-BUILD-PHASES.md`, though `/my-issues` has a
  layout in `docs/06-UX-LAYOUT-SPEC.md` §6. Flagged rather than built, since
  building it belongs to a phase that has to be decided.
- `/admin/invites` is linked from the sidebar and does not exist yet; phase 11
  builds it.

**DoD:** a drag in one browser appears in a second within a second; a mention produces a notification.
---

## Phase 11 — Admin, pages, analytics  `[~]` awaiting review

- [x] Admin panel: general, members, bulk invites, teams, audit log
- [x] Invite emails via Resend and react-email
- [x] Role changes and deactivation, with audit entries
- [x] Pages: list, editor, autosave, access control
- [x] Project analytics: open/closed trend, state distribution, per-assignee load, overdue count
- [ ] Passkey (WebAuthn) enrolment as an alternative second factor — **not possible on this stack, see below**

### Notes from this phase

**The admin panel** is five sections behind one sub-nav at `/admin`
(`docs/06-UX-LAYOUT-SPEC.md` §14): General, Members, Invites, Teams, Audit log.
The layout holds the `workspace.admin` guard so the refusal notice is written
once, and every page asserts again for itself — a layout guard is not
authorization, because a later refactor can render a page without it.

**Invites** take a comma- or newline-separated batch, one role and one team for
the batch, and report a per-address outcome rather than a single "sent": with
twenty addresses, "three were already members and one bounced" is the only
useful answer. Already-members and already-invited addresses are skipped rather
than written, which is what stops a second invite row that could never be
accepted.

**Role changes and deactivation** hold two rules the policies also hold: nobody
edits their own membership row, and the workspace never runs out of active
admins. The second is app-level only — Postgres cannot see "the last one" from
inside a row policy — and it matters, because demoting the last admin locks
everyone out of this panel with no recovery short of editing the database by
hand. There is currently exactly one admin in the workspace, so the guard is
live rather than theoretical.

**Pages** follow the same access rule as saved views: public to the project, or
private to the owner. Editing is owner-only and the body is sanitised on the
way in, the same as comments, because TipTap HTML written by one member is
rendered in another member's browser. The detail route renders "not found"
rather than "forbidden" for someone else's private page, so the existence of a
private page stays private too.

**Analytics** are four Postgres aggregates, not rows counted in Node: a project
with a few thousand issues would otherwise ship its whole issue table to draw
four small charts. The trend uses `generate_series` so a quiet day is a zero
rather than a gap, which is the difference between a flat line and a
misleadingly steep one. Charts are Recharts, as `docs/03-TRD.md` §1 names, with
every colour a `var(--token)` string so phase 13 reaches them.

**New dependencies**, all three named in `docs/03-TRD.md` §1: `resend`,
`@react-email/components`, `recharts`. Both `@react-email/components@1.0.12`
and `recharts@2.15.4` install with a deprecation warning — recharts 3.x is the
current line and the TRD pins 2.x, so 2.x is what was installed. Worth a
decision at some point; not changed unilaterally.

### Blocked and not done

- **Passkey (WebAuthn) as a second factor cannot be built on this stack.**
  Supabase Auth's MFA supports exactly two factor types, `totp` and `phone`
  (verified against `@supabase/auth-js` 2.116.0), and `CLAUDE.md` forbids any
  auth library other than Supabase Auth. A hand-rolled WebAuthn flow would not
  raise the session to `aal2`, which is what `src/middleware.ts` actually gates
  admin access on, so it would be an enrolment screen that secures nothing.
  This needs a decision rather than an implementation: drop the item, wait for
  Supabase to ship WebAuthn factors, or accept an exception to the auth rule.
- **`RESEND_API_KEY` is not set**, so no invite email has ever been sent. The
  flow was built to degrade rather than fail: the invite row is what grants
  access, so it is written first, and the panel shows a copyable invite link
  and says plainly that nothing was emailed. Setting the key is the only change
  needed for sending to start.

### Verified

- New suite `supabase/tests/admin.sql`, 10 assertions: invites and the audit
  log are admin-only; nobody, admin included, can forge an audit entry from a
  client session; a private page is private from admins as well as peers; a
  non-owner cannot edit a page; someone outside the project sees neither.
- The analytics SQL was run against the live database before any chart was
  written, so the four aggregates are known to execute rather than merely to
  typecheck.
- `pnpm typecheck`, `pnpm lint` and `pnpm build` clean; 86 database assertions
  green across six suites.

### Not verified

- No screen has been driven by a human or a browser driver.
- No invite email has been sent or received, so the phase DoD — "the real
  members can be invited from the UI and receive working emails" — is met on
  the invite half and untested on the email half.

**DoD:** the real members can be invited from the UI and receive working emails.

---

## Phase 12 — Hardening, responsive, deploy  `[~]` code complete, deploy pending

- [x] Delete `/dev/kitchen-sink` and every seed or debug route
- [x] Responsive pass: sidebar to drawer below 1024px, kanban horizontal scroll, detail panel to full-screen sheet, touch targets at least 40px
- [x] Playwright smoke suite
- [ ] Lighthouse: performance at least 85, accessibility at least 95 — **needs a signed-in session, see below**
- [x] Confirm `SUPABASE_SERVICE_ROLE_KEY` is absent from the client bundle
- [x] Rate-limit the invite endpoint
- [ ] Production Supabase config: email/password disabled, redirect allowlist, PITR if on Pro — **dashboard work, yours**
- [ ] Custom domain and production env vars on Vercel — **yours**
- [ ] Onboard the real members — **yours**

### Notes from this phase

**The kitchen sink is gone**, along with `src/lib/dev/` and the `/dev` public
prefix in the middleware that existed only to serve it. Nothing else under
`src/app` was a debug route.

**A fault the responsive work uncovered, and the more important fix of the
two.** `updateSession` and the server Supabase client both called `serverEnv()`
for the two public values they need, which meant every request in the app
parsed the entire server schema — mail credentials, cron token, service role
key. One malformed optional secret therefore threw inside middleware and took
down every route including `/sign-in`, reporting a variable that has nothing to
do with serving the page. Both now read `clientEnv`. Separately, the schema
treats a blank string as unset, because `.env` files ship optional keys empty
and `""` is not `undefined` as far as zod is concerned.

**Responsive.** Below 1024px the docked sidebar is hidden and the same
`AppSidebar` renders inside a left drawer — the same component, not a second
navigation built for small screens, because the one nobody uses daily is the
one that rots. The drawer closes on navigation, which is the classic bug that
makes a successful tap look like nothing happened. The issue peek is full
screen below `sm`, since an 80vh dialog on a phone leaves an unreachable strip
of list behind it. Comment actions, reactions and the header controls are 40px
on touch and shrink back to their dense sizes from `sm` up. Kanban and the
spreadsheet already scrolled horizontally.

**Rate limiting** is counted in Postgres, not in memory: an in-process counter
resets on every deploy and is per-instance, so on serverless it limits close to
nothing. Invites are counted from `invites.created_at` and resends from a new
`invite.resent` audit action, which also gives resends an audit trail they did
not have. Sixty invites and thirty resends per admin per hour — far above any
real use, low enough to matter if an admin account is taken.

**Bundle scan** is `pnpm check:bundle`, a script rather than a one-off grep,
and it searches both the variable names and their live values. A leak that
inlined a secret would not contain its name, which is exactly the failure a
grep for names would miss. Currently clean across 102 client files.

**Smoke suite** is `pnpm test:e2e`: 15 tests over two projects, desktop
Chromium and a Pixel 7, run against a production build rather than `next dev`
because middleware and redirects are what it asserts and they differ. All 30
green.

### Verified — the first browser-driven verification in this project

Every test runs signed out, deliberately. Signing in needs a real OAuth round
trip, and the alternatives are both wrong: a password test account is forbidden
and no email/password provider exists, while a service-role token would test a
path no member ever takes. What is left is still worth guarding:

- All eight protected routes and `/` redirect a signed-out visitor to sign-in.
- Sign-in offers Google and GitHub and contains no password or email input.
- Sign-in renders with an empty console — no errors, no React warnings.
- A malformed invite token renders the notice rather than 500ing, which was a
  real defect once, and an unknown well-formed token is refused.
- `/dev/kitchen-sink` no longer renders.
- No server secret name appears in the served HTML.

### Not done, and why

- **Lighthouse.** The two pages the target names, `/home` and a project issues
  page, are both behind the session wall, so scoring them needs a signed-in
  browser profile that this suite cannot produce for the reason above. Run it
  by hand from Chrome DevTools once signed in, or park it until a seeded
  staging user exists.
- **Supabase production config, the Vercel domain and env vars, and onboarding
  the members** are all dashboard and account work.

**DoD:** 20 real users signed in, one real cycle running.

---

## Phase 13 — Cybersecurity reskin  `[~]` groundwork done, blocked on the palette

Separate effort, after the product is live.

- [ ] New palette applied to the `globals.css` token block only — **needs the palette from you**
- [ ] Optional display font for page titles — **needs the font choice**
- [ ] Brand assets swapped — **needs the real logo**
- [x] Zero component files modified — now mechanically enforced

### Groundwork done ahead of the palette

The one part of this phase that does not depend on the design is the promise
the other three rest on: that a reskin is an edit to one file. That promise was
not actually true, and is now.

**Five colours bypassed the token layer**, all of them inside the vendored
shadcn primitives, which the phase 2 audit's grep over `src/components` had
counted as clean because they carry Tailwind class names rather than hex
values: `bg-black/50` on the dialog, alert-dialog and sheet scrims, and
`text-white` on the destructive button and badge. Two new tokens, `--overlay`
and `--on-danger`, replace them. Without this, changing the theme would have
meant editing five component files and hoping there were not a sixth.

**`pnpm check:tokens`** now enforces it. It fails on a raw hex, an `rgb()` or
`hsl()` call, any Tailwind default-palette class such as `text-red-500`, and a
literal `bg-black` or `text-white`, across every file under `src/components`
and `src/app`. Two exemptions, both deliberate: `globals.css`, where the
literals belong, and an inline style whose colour is an expression rather than
a literal — a state, label or team colour is a database row, not a design
decision, and cannot be a token. Currently clean across 148 files.

### Blocked on you

The docs describe no palette for this phase, and `CLAUDE.md` is explicit that
inventing requirements is worse than asking. Three things are needed:

1. **The palette** — replacements for the token block in `src/app/globals.css`:
   five background steps, four text steps, three borders, the accent and its
   hover and subtle variants, and the four semantic colours. A screenshot, a
   Figma file or a list of hex values all work.
2. **A display font**, if page titles should differ from Inter, and whether it
   is a Google font or a file to add.
3. **The real logo**, as `public/brand/logo-full.svg` and `logo-mark.svg`. The
   current mark is a placeholder circle drawn in `currentColor`, so it already
   takes the theme — it is simply not your logo.

Once those arrive this is a single-file change plus two asset swaps, and
`pnpm check:tokens` is what proves no component needed touching.

---

## Carried-over item, now closed: the sanitiser

`src/lib/utils/sanitize-html.ts` rebuilt every tag from a regular expression
over the raw HTML string. That was defensible as a stop-gap — the hole it
closed was live, and adding a dependency needed sign-off — but a parser written
in regular expressions is the wrong tool for a security boundary. Mutation XSS
turns on precisely the disagreements between such a pass and the browser's own
parser, and only the browser's parser knows what the browser will do.

The engine is now DOMPurify, via `isomorphic-dompurify` so the one client
component that renders stored HTML can use the same function. The exported API,
the allow-lists and the test file are unchanged — the tests describe the
contract and the engine underneath them moved.

Two configuration mistakes were caught by the existing suite rather than by
review, which is the argument for having written it first:

- `USE_PROFILES: { html: true }` replaces `ALLOWED_TAGS` with the profile's own
  far larger list rather than intersecting with it, which let `<form>` and
  `<button>` straight through.
- `ALLOW_DATA_ATTR: false` stripped every `data-*` before the per-tag hook ran,
  and three allow-listed attributes are data attributes — the mention id, the
  task-list checkbox and the list type. The parser is permissive now and the
  hook is what narrows it again.

**Honest result.** Four mutation-XSS payloads were added to the suite and the
old implementation was checked out and run against them: it blocked all four.
So this swap did not close a demonstrated hole. What it bought is that the
security boundary is now maintained and audited by people who track new bypass
techniques, rather than being a bespoke parser this project would have to keep
current itself.

Cost: 11 kB on the issue-detail route, 142 kB to 153 kB. jsdom stays on the
server — verified absent from the client bundle. 39 assertions green.

---

## Unassigned item, now closed: `/my-issues`

`/my-issues` appears in `docs/06-UX-LAYOUT-SPEC.md` §6 but in no phase
checklist, so it stayed a placeholder while the rest of the app came to depend
on it: the sidebar links to it, the command palette has a "Go to my issues"
action, the notification bell sends unread rows to `/my-issues?issue=…`, and
five server actions call `revalidatePath("/my-issues")` after every write.

**The security part, which is the reason this needed its own query.** Being
assigned to an issue is not permission to read it. Assignment rows survive a
member leaving a team, so a naive "where assignee = me" would have shown a
former member that team's work indefinitely, long after they lost access to it
everywhere else. `getMyIssues` mirrors `is_project_member`: a member of the
project, or of the team that owns it, with workspace admins seeing everything.

`supabase/tests/my-issues.sql` asserts that rule in five assertions, including
the one that matters — after the team membership is deleted the assignment row
is still there and the issue is no longer visible. Note honestly what that
suite is: reads here go through Drizzle as `postgres`, which has BYPASSRLS, so
the rule lives in a WHERE clause rather than a policy. The suite writes that
predicate out and asserts it. It proves the rule is right, not that the
TypeScript builds it correctly.

**Where this departs from the spec, and why.** §6 asks for "identical machinery
to the project issue view — filter bar, four layouts, group-by". Two parts of
that do not survive contact with a cross-project list:

- **State, label and cycle filters are gone.** Each of those ids belongs to one
  project. The same "Todo" is a different row in every project, so filtering by
  one is meaningless across a list that spans them. What is left is what
  compares everywhere: the state's *group*, the priority, and the project.
- **One layout, not four.** Kanban columns are states, and there is no single
  state ladder here to build them from; unifying them by group would produce a
  board whose columns do not match any project's actual workflow. Grouping by
  state group, priority or project covers the same need in the list.
- **No inline editing.** A state dropdown needs that project's states, and this
  list spans projects whose ladders differ. Rows link to the issue, where the
  whole context is present.

Closed work is hidden by default, since a worklist headed by a year of finished
tickets is not a worklist. It is one toggle away under Display.

---

## Gap A, now closed: Drafts removed, passkey line corrected

`/drafts` was a sidebar row and a placeholder route and nothing else: no
column, no query, no action, no migration ever referenced it, and the spec
described no screen for it. Rather than invent what a draft is, the user
removed the feature. Deleted `src/app/(app)/drafts/` entirely and dropped the
entry from the sidebar's `PRIMARY_NAV`, the breadcrumb `ROOT_LABELS` map and
the e2e protected-route list. `/drafts` now returns the app's not-found page.

The same pass closed the passkey line, which was never implementable as
written. Supabase `auth.mfa.enroll` accepts `totp` and `phone` only, so a
passkey cannot be a second factor. Supabase's separate beta passkey sign-in
yields `aal1`, which cannot satisfy the `aal2` gate `src/middleware.ts`
enforces for `admin`, `president` and `co_president`. TOTP is therefore the
only second factor, and passkey sign-in — if it is ever added — would be an
additional primary sign-in method, not a replacement.

---

## Gap B, now closed: team membership management

Until now the only path onto a team was the optional `team_id` on an invite,
consumed by `handle_new_user` at first sign-in. Moving somebody between teams,
adding a second team, or naming a lead meant editing the database by hand.

**What already existed.** `src/actions/teams.ts` shipped in phase 7 with all
six exports, so this was an extension rather than a build: `addTeamMember` took
no role and swallowed duplicates with `onConflictDoNothing`, `removeTeamMember`
had no guard and wrote no audit row, and `setTeamRole` recorded only the
destination role, never the transition. `team.manage` was already in the
ability union and `is_team_lead` already resolved workspace admin *or* lead of
that team, so no permission string and no policy needed adding.

**The two rules worth naming.** A duplicate add is decided by the unique
constraint on `(team_id, user_id)`, not by reading first — two admins adding
the same person concurrently would both pass a read, and both would then
insert. `on conflict do nothing` with an empty `returning()` is what reports
`ALREADY_MEMBER`. And removing the last lead of a team that still has members
is refused with `LAST_LEAD`: such a team has nobody who can manage it, and only
a workspace admin could repair it. Emptying a team completely is still allowed,
because there is nobody left to strand.

Multiple leads per team are permitted deliberately. A club team with two people
sharing the role is the normal case, not an error.

**Where the optimism lives.** `TeamMembersPanel` uses React's `useOptimistic`
rather than the TanStack contract in `docs/03-TRD.md` §3.1. That contract
snapshots and restores a query cache; this roster is server-rendered props,
with no cache to snapshot. When the transition ends the props are authoritative
again, which is the same rollback by a different mechanism.

`canManage` removes the controls rather than disabling them. A disabled
dropdown still announces that the control exists and invites a hunt for the
enabled version; the server refuses either way.

`supabase/tests/team-members.sql` — 15 assertions. The cross-team case is the
one that matters: a lead of one team is an outsider to every other, and nothing
in the UI can enforce that, since a crafted request can carry any team id.


---

## Phase 14 — Appeal workflow & the silent notification failure  `[~]` awaiting review

Not derived from `reference/07-BUILD-PHASES.md`. Requested directly: members
should not open or close issues, a team lead should decide, and following an
issue should tell the people responsible for it.

- [x] `issue_appeals` table, two kinds in one table: `create` carries a proposed
      issue, `complete` points at an existing one
- [x] RLS: readable by the project, raised only for yourself and only as pending,
      decided only by an approver who is not the requester, withdrawn only by the
      requester while pending
- [x] `can_decide_appeal` / `appeal_approvers`: the lead of the project's team,
      with the three workspace admin roles as the standing fallback
- [x] `notify_appeal` — approvers on insert, requester on decision
- [x] `notify_issue_subscribed` — team leads, assignees and existing followers
- [x] `require_lead_for_completion` — a completed state needs an approver
- [x] Abilities `issue.create`, `issue.complete`, `appeal.create`, `appeal.decide`
- [x] `src/actions/appeals.ts` — raise, request completion, approve, reject, withdraw
- [x] `/projects/[projectId]/appeals` queue with Approve and Decline, plus
      Withdraw on your own request
- [x] The create modal raises an appeal for anyone who cannot create directly,
      and hides the fields a lead decides
- [x] Assignee avatars beside Subscribe in the issue detail
- [x] `supabase/tests/appeals.sql` — 17 assertions, `pnpm db:test:appeals`

### Notes from this phase

**The rule as the user stated it.** Team lead, member and mentor all raise
appeals; only `admin`, `president` and `co_president` create and complete
issues directly. Nobody decides their own appeal, so a lead's own request
escalates to a workspace admin. The admin-class fallback on `appeal_approvers`
was the user's explicit choice, made because no team in the live database has a
lead — a strict lead-only rule would have frozen every team.

**Leads can still insert issues at the database level**, because approving a
create appeal *is* an insert by the approver and RLS cannot tell the two apart.
The direct-create refusal is `assertCan(issue.create)` in the action, which is
the only layer that knows the difference. Worth knowing before trusting the
policy alone on that one point.

**The notification system had never worked.** Every activity trigger takes its
actor from `auth.uid()`, which reads the `sub` claim; the Drizzle connection is
the table owner and carries no JWT, so it was always null, and
`0007_activity_cascade_guard` makes the triggers skip when it is. Measured on
the live database: one comment, one subscriber, **zero** rows in both
`issue_activity` and `notifications`. `withActor()` in `src/db/actor.ts` sets
the claim for the transaction. The role is unchanged, so RLS is still bypassed
on that path and `assertCan` is still the authorization — what the claim buys is
an actor for the triggers and a database-side completion guard that can see who
is asking. It is wired into subscribe, comment, react, issue update and every
appeal write; the remaining actions still write without an actor and their
activity rows are still skipped.

**Subscribe was sharing a transition.** The button was `disabled={pending}` from
the detail view's single `useTransition`, so any other in-flight edit — a
description autosave, a state change — disabled it too, which reads as a dead
control. It owns its own flag now.

**DoD:** `pnpm typecheck`, `pnpm lint`, `pnpm build:verify` clean;
`pnpm db:test` green across all nine suites (123 assertions).

---

## Phase 15 — Second factor removed  `[~]` awaiting review

Requested directly, and it contradicts the specifications: `docs/02-PRD.md`,
`docs/03-TRD.md`, `docs/06-UX-LAYOUT-SPEC.md`, `docs/09-DEPLOYMENT.md` and
`docs/supabase-config.md` all describe TOTP enrolment for `admin`, `president`
and `co_president`. The user removed it. Everyone signs in with Google or GitHub
and nothing more, privileged roles included.

- [x] The `MFA_REQUIRED_ROLES` set, the aal2 lookup and the `/mfa` redirect gone
      from `src/middleware.ts`, leaving three rules: refresh, require a session,
      reject a deactivated membership
- [x] `src/app/(auth)/mfa/` deleted — page, flow and OTP input
- [x] `src/lib/qr.ts` and its test deleted; the enrolment QR was the only caller
- [x] `qrcode` and `@types/qrcode` removed, now unused
- [x] The stale comment in `src/components/layout/header.tsx` that explained why
      enrolment was not linked there

### Notes from this phase

**What this costs.** An admin's Google or GitHub account is now the only thing
between an attacker and every team's data, the invite list and role assignment.
The workspace is still invite-gated so it is not open to the internet, and these
are ~30 club members rather than a payroll system, but a phished admin login is
no longer slowed down by anything. Raised once, the user reaffirmed it, and it
is their application.

**The enrolled factor still exists.** `itsjitesh.work@gmail.com` has one
verified TOTP factor in `auth.mfa_factors` from 2026-09-08. Nothing reads it any
more — Supabase only challenges when the application asks, and nothing asks — so
an OAuth sign-in now produces an aal1 session and proceeds. It is inert rather
than harmful, and deleting it is a one-line change if the user wants the slate
clean.

**If it is ever reinstated** it has to come from the user, not from the docs. A
future session reading `docs/03-TRD.md` will find the requirement still written
there.

**DoD:** `pnpm typecheck`, `pnpm lint`, `pnpm build:verify`, `pnpm check:tokens`
clean; `/mfa` no longer exists; no route gates on a second factor.
