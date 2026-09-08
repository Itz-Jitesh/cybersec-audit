# 07 — Build Phases

One phase per agent session. Commit and tag at the end of each. Do not start a phase until the previous phase's Definition of Done is manually verified.

Corresponding prompts are in [[08-PROMPT-PACK]], numbered identically.

---

## Phase 0 — Pre-build (you, not the agent)
- [ ] Complete every item in [[01-PRE-BUILD-CHECKLIST]]
- [ ] Repo created, `docs/` committed with this pack
- [ ] `CLAUDE.md` and `AGENTS.md` placed at repo root
- [ ] `docs/tokens-raw.txt` and `docs/layout-raw.txt` populated from real measurements

**DoD:** you can paste Phase 1's prompt without needing to answer any question.

---

## Phase 1 — Scaffold & tooling
- [ ] Next.js 15 App Router + TypeScript strict, pnpm
- [ ] Tailwind v4 configured with the full token set from [[05-DESIGN-SYSTEM]]
- [ ] `next/font` for Inter + JetBrains Mono
- [ ] shadcn/ui initialised, all listed primitives installed
- [ ] ESLint + Prettier + `simple-import-sort`, `pnpm lint` clean
- [ ] Folder structure from [[03-TRD]] §2 created with `.gitkeep` where empty
- [ ] Drizzle + drizzle-kit configured, connects to Supabase
- [ ] Supabase clients: `lib/supabase/{client,server,middleware}.ts`
- [ ] Env validation with zod at `lib/env.ts`, fails loudly at boot
- [ ] Deploy the empty app to Vercel and confirm it builds

**DoD:** `pnpm dev` renders a dark page using your tokens; Vercel preview URL is live.

---

## Phase 2 — Design system realisation
- [ ] `globals.css` token block complete
- [ ] All `components/shared/*` built and rendered on a `/dev/kitchen-sink` route (delete before prod)
- [ ] `PriorityIcon`, `StateIcon`, `MemberAvatar`, `AvatarGroup`, `LabelChip`, `DateChip`, `IssueIdBadge`, `Kbd`, `EmptyState`, `ProgressRing`, `InlineEditableText`
- [ ] Hover/focus/active states match [[06-UX-LAYOUT-SPEC]] §5 table
- [ ] Zero raw hex values in any component file (grep to verify)

**DoD:** kitchen-sink page shows every primitive in every state and it looks like Plane.

---

## Phase 3 — Database schema
- [ ] Every enum, table, index from [[04-DATA-MODEL]] as Drizzle schema files
- [ ] Migrations generated and applied to Supabase
- [ ] All triggers and functions written as hand-authored SQL in `supabase/migrations/`
- [ ] Seed script: workspace row, 3 teams, default states/labels templates, 1 admin invite for your email

**DoD:** schema visible in Supabase dashboard; `drizzle-kit push` is a no-op; seed runs idempotently.

---

## Phase 4 — RLS & authorization
- [ ] Helper functions (`is_active_member`, `is_workspace_admin`, `is_team_lead`, `is_project_member`, `can_manage_project`)
- [ ] RLS enabled + policies on every table per [[04-DATA-MODEL]] §9
- [ ] `lib/auth/permissions.ts` with `assertCan()` mirroring the policy matrix
- [ ] `supabase/tests/rls.sql` written and passing all five negative assertions

**DoD:** the RLS test suite runs green, and the cross-team read test **fails to read** as expected.

---

## Phase 5 — Authentication
- [ ] `/sign-in` with Google + GitHub OAuth
- [ ] `/auth/callback` route handler
- [ ] `handle_new_user` trigger enforcing invite-gating
- [ ] `middleware.ts` — session refresh, route protection, inactive-member rejection, MFA gate
- [ ] `/invite/[token]` page
- [ ] TOTP enrolment + challenge at `/mfa`, enforced for privileged roles
- [ ] Rejection UX for uninvited emails

**DoD:** an uninvited Google account is rejected with a clear message; an invited one lands on `/home`; an admin without MFA is forced to enrol.

---

## Phase 6 — App shell
- [ ] `(app)/layout.tsx` with sidebar + header
- [ ] `AppSidebar` with all sections, collapse, persisted state
- [ ] `SidebarProjectTree` reading real teams/projects
- [ ] `Header` with breadcrumbs, new-issue button, bell, user menu
- [ ] `/home` dashboard with real stat queries
- [ ] `loading.tsx`, `error.tsx`, `not-found.tsx` at each segment

**DoD:** you can navigate the whole information architecture; every route renders a shell even if the content is a placeholder.

---

## Phase 7 — Teams & projects
- [ ] Team CRUD (admin/lead scoped) + team detail page
- [ ] Project create modal: name, identifier (auto-suggested from name), team, lead, icon
- [ ] On project create: seed 6 default states + 7 default labels + creator as project admin
- [ ] Project settings page: general, members, states editor (drag-reorder), labels editor, danger zone
- [ ] Favorites (star projects, appear in sidebar)

**DoD:** you can create a team, create a project inside it, and its states/labels exist automatically.

---

## Phase 8 — Issues core
- [ ] Issue create modal + inline quick-add per group
- [ ] Sequence-ID trigger verified (`CTF-1`, `CTF-2`, no gaps under concurrency)
- [ ] List layout with grouping, collapsible sticky headers, inline chip editing
- [ ] Issue detail (peek overlay + full page) with TipTap description
- [ ] Sub-issues, relations, links, attachments
- [ ] Comments with mentions and reactions
- [ ] Activity feed rendering from `issue_activity`
- [ ] Archive/delete with confirmation
- [ ] Multi-select + bulk actions bar

**DoD:** full issue lifecycle works end-to-end and every change appears in the activity feed.

---

## Phase 9 — Views & filtering
- [ ] Kanban with dnd-kit, cross-column state change, intra-column reorder, optimistic
- [ ] Calendar with drag-to-reschedule
- [ ] Spreadsheet with sticky column, sorting, inline editing
- [ ] `FilterBar` — filters, group-by, sort, display properties
- [ ] Per-user layout/filter persistence (localStorage + `views` table for saved views)
- [ ] Saved Views CRUD with private/public access
- [ ] Virtualisation for list + spreadsheet above 100 rows

**DoD:** all four layouts render the same filtered set consistently; switching layouts preserves filters.

---

## Phase 10 — Cycles, modules, realtime, search
- [ ] Cycle CRUD, assignment, detail with burndown, completion + transfer flow
- [ ] `cycle_snapshots` cron via Vercel Cron
- [ ] Module CRUD, issue assignment, progress
- [ ] Supabase Realtime: per-project channel, surgical cache patching for issues/comments/notifications
- [ ] Notification fan-out trigger + inbox popover + `/notifications`
- [ ] `Cmd+K` palette with full-text issue search + command mode
- [ ] Keyboard shortcuts from [[06-UX-LAYOUT-SPEC]] §15 + `?` cheat sheet

**DoD:** open two browsers as two users; a drag in one appears in the other within a second; a mention produces a notification.

---

## Phase 11 — Admin, pages, analytics
- [ ] Admin panel: general, members, invites (bulk), teams, audit log
- [ ] Invite emails via Resend + react-email template
- [ ] Role changes and deactivation, with audit entries
- [ ] Pages: list, editor, autosave, access control
- [ ] Project analytics tab: open/closed trend, state distribution, per-assignee load, overdue count
- [ ] Passkey (WebAuthn) enrolment as an alternative second factor

**DoD:** you can invite the real 20 members from the UI and they receive working emails.

---

## Phase 12 — Hardening, responsive, deploy
- [ ] Delete `/dev/kitchen-sink` and any seed/debug routes
- [ ] Responsive pass: sidebar → drawer below 1024px; kanban horizontal scroll; detail panel → full-screen sheet on mobile; touch targets ≥ 40px; spreadsheet gets a horizontal-scroll wrapper
- [ ] Playwright smoke suite
- [ ] Lighthouse: performance ≥ 85, accessibility ≥ 95 on `/home` and a project issues page
- [ ] Verify no `SUPABASE_SERVICE_ROLE_KEY` reachable from client bundle (`grep` the `.next` output)
- [ ] Rate-limit the invite endpoint
- [ ] Production Supabase config: disable email/password provider, set redirect allowlist, enable PITR if on Pro
- [ ] Custom domain + prod env vars on Vercel
- [ ] Onboard real members

**DoD:** 20 real users signed in, one real cycle running.

---

## Phase 13 — Cybersecurity reskin (later, separate effort)
- [ ] New palette applied to `globals.css` tokens only
- [ ] Optional display font for page titles
- [ ] Brand assets swapped
- [ ] Zero component files modified

---

## Phase estimate (solo, comfortable full-stack dev)

| Phase | Effort |
|---|---|
| 1–2 | 1–2 days |
| 3–4 | 2 days |
| 5 | 1–2 days |
| 6–7 | 2–3 days |
| 8 | 4–5 days |
| 9 | 4–5 days |
| 10 | 3–4 days |
| 11 | 2–3 days |
| 12 | 2–3 days |
| **Total** | **~4–5 weeks part-time, ~2.5 weeks focused** |
