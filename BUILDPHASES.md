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

## Phase 7 — Teams & projects `[ ]`

- [ ] Team CRUD scoped to admin/lead, plus the team detail page
- [ ] Project create modal: name, auto-suggested identifier, team, lead, icon
- [ ] On create: seed 6 default states, 7 default labels, creator as project admin
- [ ] Project settings: general, members, states editor with drag-reorder, labels editor, danger zone
- [ ] Favorites, appearing in the sidebar

**DoD:** you can create a team, create a project in it, and its states and labels exist automatically.

---

## Phase 8 — Issues core `[ ]`

- [ ] Issue create modal and per-group inline quick-add
- [ ] Sequence-ID trigger verified under concurrency (`CTF-1`, `CTF-2`, no gaps)
- [ ] List layout: grouping, collapsible sticky headers, inline chip editing
- [ ] Issue detail as peek overlay and full page, with a TipTap description
- [ ] Sub-issues, relations, links, attachments
- [ ] Comments with mentions and reactions
- [ ] Activity feed rendered from `issue_activity`
- [ ] Archive and delete with confirmation
- [ ] Multi-select with a bulk actions bar

**DoD:** the full issue lifecycle works end to end and every change lands in the activity feed.

---

## Phase 9 — Views & filtering `[ ]`

- [ ] Kanban with dnd-kit: cross-column state change, intra-column reorder, optimistic
- [ ] Calendar with drag-to-reschedule
- [ ] Spreadsheet with sticky first column, sorting, inline editing
- [ ] `FilterBar`: filters, group-by, sort, display properties
- [ ] Per-user layout and filter persistence, plus the `views` table for saved views
- [ ] Saved Views CRUD with private/public access
- [ ] Virtualisation for list and spreadsheet above 100 rows

**DoD:** all four layouts render the same filtered set; switching layouts preserves filters.

---

## Phase 10 — Cycles, modules, realtime, search `[ ]`

- [ ] Cycle CRUD, assignment, detail with burndown, completion and transfer flow
- [ ] `cycle_snapshots` via Vercel Cron
- [ ] Module CRUD, issue assignment, progress
- [ ] Supabase Realtime: per-project channel, surgical cache patching
- [ ] Notification fan-out trigger, inbox popover, `/notifications`
- [ ] `Cmd+K` palette with full-text issue search and command mode
- [ ] Keyboard shortcuts from `docs/06-UX-LAYOUT-SPEC.md` §15 plus the `?` cheat sheet

**DoD:** a drag in one browser appears in a second within a second; a mention produces a notification.

---

## Phase 11 — Admin, pages, analytics `[ ]`

**Blocked on:** Resend API key.

- [ ] Admin panel: general, members, bulk invites, teams, audit log
- [ ] Invite emails via Resend and react-email
- [ ] Role changes and deactivation, with audit entries
- [ ] Pages: list, editor, autosave, access control
- [ ] Project analytics: open/closed trend, state distribution, per-assignee load, overdue count
- [ ] Passkey (WebAuthn) enrolment as an alternative second factor

**DoD:** the real members can be invited from the UI and receive working emails.

---

## Phase 12 — Hardening, responsive, deploy `[ ]`

- [ ] Delete `/dev/kitchen-sink` and every seed or debug route
- [ ] Responsive pass: sidebar to drawer below 1024px, kanban horizontal scroll, detail panel to full-screen sheet, touch targets at least 40px
- [ ] Playwright smoke suite
- [ ] Lighthouse: performance at least 85, accessibility at least 95
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` is absent from the client bundle
- [ ] Rate-limit the invite endpoint
- [ ] Production Supabase config: email/password disabled, redirect allowlist, PITR if on Pro
- [ ] Custom domain and production env vars on Vercel
- [ ] Onboard the real members

**DoD:** 20 real users signed in, one real cycle running.

---

## Phase 13 — Cybersecurity reskin `[ ]`

Separate effort, after the product is live.

- [ ] New palette applied to the `globals.css` token block only
- [ ] Optional display font for page titles
- [ ] Brand assets swapped
- [ ] Zero component files modified
