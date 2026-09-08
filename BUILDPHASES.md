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

## Phase 2 — Design system realisation `[ ]`

- [ ] `globals.css` token block complete
- [ ] `PriorityIcon`, `StateIcon`, `MemberAvatar`, `AvatarGroup`, `LabelChip`, `DateChip`, `IssueIdBadge`, `Kbd`, `EmptyState`, `ProgressRing`, `InlineEditableText`
- [ ] All primitives rendered on `/dev/kitchen-sink` in every meaningful state
- [ ] Hover/focus/active states match `docs/06-UX-LAYOUT-SPEC.md` §5
- [ ] Zero raw hex values under `src/components/` (verified by grep)

**DoD:** the kitchen-sink page shows every primitive in every state and reads as Plane.

---

## Phase 3 — Database schema `[ ]`

**Blocked on:** Supabase project + `DATABASE_URL`.

- [ ] Every enum, table and index from `docs/04-DATA-MODEL.md` as Drizzle schema files
- [ ] Migrations generated and applied to Supabase
- [ ] Hand-authored SQL for extensions, the `search_vector` generated column, and all triggers
- [ ] Idempotent seed: workspace row, 3 teams, default state/label templates, 1 admin invite

**DoD:** schema visible in the Supabase dashboard; `drizzle-kit push` is a no-op; seed runs twice cleanly.

---

## Phase 4 — RLS & authorization `[ ]`

**Blocked on:** Phase 3.

- [ ] Helper functions: `is_active_member`, `is_workspace_admin`, `is_team_lead`, `is_project_member`, `can_manage_project`
- [ ] RLS enabled with policies on every table per `docs/04-DATA-MODEL.md` §9
- [ ] `src/lib/auth/permissions.ts` with `assertCan()` mirroring the policy matrix
- [ ] `supabase/tests/rls.sql` passing every negative assertion

**DoD:** the RLS suite runs green and the cross-team read test fails to read, as expected.

---

## Phase 5 — Authentication `[ ]`

**Blocked on:** Google + GitHub OAuth credentials.

- [ ] `/sign-in` with Google and GitHub OAuth
- [ ] `/auth/callback` route handler
- [ ] `handle_new_user` trigger enforcing invite-gating
- [ ] `middleware.ts`: session refresh, route protection, inactive-member rejection, MFA gate
- [ ] `/invite/[token]` page
- [ ] TOTP enrolment and challenge at `/mfa`, enforced for privileged roles
- [ ] Rejection UX for uninvited emails

**DoD:** an uninvited account is rejected clearly; an invited one lands on `/home`; an admin without MFA is forced to enrol.

---

## Phase 6 — App shell `[ ]`

- [ ] `(app)/layout.tsx` with sidebar and header
- [ ] `AppSidebar` with all sections, collapse, persisted state
- [ ] `SidebarProjectTree` reading real teams and projects
- [ ] `Header` with breadcrumbs, new-issue button, bell, user menu
- [ ] `/home` dashboard with real stat queries
- [ ] `loading.tsx`, `error.tsx`, `not-found.tsx` at each segment

**DoD:** the whole information architecture is navigable; every route renders a shell.

---

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
