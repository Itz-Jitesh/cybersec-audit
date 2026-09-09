# CURATIVE TEST GUIDE — CyberSec Atria IT Project Tracker

A curated, human-testable walkthrough of every feature that exists as of **Phase 10** (commit `a934ac5`).

> **Goal:** a second person (or you, after a break) can verify the whole app in ~30 minutes with zero prior context.
> **Legend:** 🏁 = start here · ✅ = expected outcome · ❌ = this should **never** happen · 🐛 = known issue / not yet built

---

## Table of contents

1. [Before you start](#1-before-you-start)
2. [Auth & invites (Phase 5)](#2-auth--invites-phase-5)
3. [App shell & home (Phase 6)](#3-app-shell--home-phase-6)
4. [Teams, projects & settings (Phase 7)](#4-teams-projects--settings-phase-7)
5. [Issues (Phase 8)](#5-issues-phase-8)
6. [Views & filtering (Phase 9)](#6-views--filtering-phase-9)
7. [Cycles, modules, realtime, search (Phase 10)](#7-cycles-modules-realtime-search-phase-10)
8. [Automated test suites](#8-automated-test-suites)
---

## 1. Before you start

### Prereq: environment

| Item | Value / command |
|---|---|
| Node + pnpm | `pnpm --version` → 9+ |
| Supabase env | `DATABASE_URL`, `DATABASE_POOL_URL` (recommended), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (real key), `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` |
| Your OAuth | Google + GitHub enabled in Supabase dashboard; your Google client user-type **External** (see §2) |

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Local server → `http://localhost:3000` |
| `pnpm typecheck` | TypeScript strict |
| `pnpm lint` | ESLint (0 warnings) |
| `pnpm build` | Production build |
| `pnpm db:test` | All SQL/RLS/auth suites |
| `pnpm test:sanitize` | XSS sanitiser unit tests |
| `pnpm test:qr` | TOTP QR round-trip test |
| `pnpm db:generate` | Drizzle migration diff |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:seed` | Idempotent seed |

### The user you'll test as

Two roles are useful:

- **`itsjitesh.work@gmail.com`** — the bootstrap **admin** (invite is open). Sign in with this first.
- A **second Gmail** — invite them in §4. They'll be a plain `member`; you use this to verify cross-team *isolation* (the security-critical part).

> 🏁 Start logged out. All routes except `/sign-in`, `/invite/[token]`, `/mfa`, `/dev/*` should bounce you to `/sign-in`.

---

## 2. Auth & invites (Phase 5)

### 🏁 T1 — Sign in with Google

1. Open `http://localhost:3000` → redirects to `/sign-in`.
2. Click **Continue with Google** → Google consent → back to app.
3. ✅ Land on `/home` (logged-in, admin). First sign-in: complete TOTP enrolment if prompted (§2.2).
4. ✅ `/home` shows empty-state text ("no open/overdue" etc.) — correct until you create work in §5.
5. ✅ Top-right avatar menu shows your name + email (your Gmail).
6. ❌ You should **never** see `403 org_internal`. If you do → your Google OAuth client is **Internal**/*Testing*; flip to External/In production (Google Cloud Console → OAuth consent screen).
7. 🐛 GitHub button may not be enabled — that's the dashboard setup step (Phase 5 wait item), not a code fault.

### 🏁 T2 — Two-factor enrolment (first sign-in)

1. After Google sign-in you should be prompted to set up TOTP.
2. ✅ A QR code renders (PNG, scannable) inside the dialog.
3. Open **Google Authenticator** / **Authy** → Add account → **Scan QR**.
4. ✅ The 6-digit code authenticates and you land on `/home`.
5. ✅ After enrolment, `/mfa` shows "Remove 2FA" + the recovery codes are NOT printed (Supabase provides none — see notes).
6. ✅ On next sign-in you'll be asked for a code.

> 🐛 If the QR **does not scan**, see §9 (known issue, fixed in `064a7ea` — should scan now).

### 🏁 T3 — Invite gate (security)

1. Log out (avatar menu → Sign out).
2. Open a **private/incognito** window.
3. Try `http://localhost:3000/invite/00000000-0000-0000-0000-000000000000`:
   - ✅ 200 with "This invite is not valid" friendly notice (not a 500).
4. Try `http://localhost:3000/invite/not-a-uuid`:
   - ✅ 200 with the same friendly notice (this was the fix commit `210c1cc`).
5. Go to Supabase → **Table Editor → invites** → copy your real **admin invite token** (`ed72b711-…` for `itsjitesh.work@gmail.com`).
   - Open ` ` → ✅ shows invite details + "Accept".
6. Sign in with a **different Gmail that has no invite** → ✅ you get a rejection screen ("not invited") and **no user is created** in `auth.users` (the `handle_new_user` trigger aborts).

### 🏁 T4 — MFA challenge on a fresh session

- Sign out, sign in again → ✅ asked for TOTP code. Wrong code → ✅ rejected with a message.

---

## 3. App shell & home (Phase 6)

1. While logged in, check the **layout**:
   - ✅ Left **sidebar**: workspace header w/ logo + name, primary nav (Home, My Issues, Inbox, Projects, Notifications), Favorites section (empty until you star), teams & projects tree, user footer.
   - ✅ Top **header**: breadcrumbs (path from tree), **search button (⌘K)**, **New issue** button, **bell** (notifications), **avatar menu**.
2. **Collapse the sidebar**:
   - Click the logo/workspace header area or press **`Cmd+\`** → ✅ sidebar collapses to icons; press again → expands.
   - ✅ This survives a **reload** (persisted in localStorage).
3. **Navigation**:
   - ✅ /home, /my-issues, /inbox, /projects, /notifications all render (no 404).
   - ✅ A **project link** appears in the tree once you create one in §4.
4. **Breadcrumbs**: open `/projects/<id>/issues` → ✅ header shows `Projects → <name> → Issues` (no raw UUID).
5. **"New issue" button** in header → opens the create modal even from a non-project page (uses the first project you belong to). ✅
6. **Keyboard**:
   - **`Cmd+K`** → ✅ command palette opens with search input + suggestions (Phase 10). Type a term → issues/cycles/modules/pages results. `Esc` closes.
   - **`?`** → ✅ cheat sheet dialog listing shortcuts.
---

## 4. Teams, projects & settings (Phase 7)

> These actions are **workspace-admin only**. With `itsjitesh` (admin) signed in.

### 🏁 T5 — Create a team

1. Sidebar → **admin** section → `/admin`.
2. ✅ Page lists current teams (from seed: `tech`, `design`, `rnd`).
3. Click **Create team** → name `Test Team` → Save.
4. ✅ Toast + team appears in list.
5. Click the team → ✅ detail page with **leads**, **members**, and project grid (empty yet).
6. ✅ Buttons: **Edit** (rename), **Delete** (admin only; requires typing the name).

### 🏁 T6 — Create a project

1. Sidebar → **Projects** (`/projects`) → **New project** (or `+` in sidebar footer).
2. Modal fields:
   - **Name** — `Website Revamp`
   - **Identifier** — auto-suggested (`WEBSITE`); ✅ debounced uniqueness check turns green if available, error if taken.
   - **Team** — pick your new team.
   - **Lead** — pick yourself.
   - **Icon** — pick an emoji.
3. Save → ✅ project created with **6 default states** + **7 default labels** (visible in Settings), and you're a **project admin**.
4. ✅ New project appears in the sidebar tree under its team and in Favorites once starred (star icon on project page / rows).
5. **Identifier rule**: try to create another project with the same identifier in a different team → ✅ rejected (case-insensitive, DB enforced).

### 🏁 T7 — Project settings (admin)

Open `/projects/<id>/settings`:

- **General** — rename, update icon, description. ✅ persists.
- **Members** — add/remove members; ✅ you can't remove the **last project admin** (blocked).
- **States** — you'll find the 6 defaults (Backlog, Todo, In Progress, In Review, Done, Cancelled).
  - **Drag a state** to reorder → ✅ order persists.
  - Try to **delete a state with issues** → ✅ refused (`STATE_IN_USE`).
  - Try to **delete the last/default state** → ✅ refused.
- **Labels** — add/rename/delete; deleting a label with issues is allowed (cascades).
- **Danger zone** — archive project (takes it out of the active tree); delete project (type name to confirm).

### 🏁 T8 — Cross-team isolation (security-critical)

1. Invite your **second Gmail** (admin section → Invite members) with a **plain member** role, **no team assignment given** till they accept.
2. Sign in as them (accept invite) → open the project you created → ❌ they should **not** see it (not a project member).
3. In `Test Team` settings, add them as a member of `Test Team` only.
4. As the second user: → ✅ they now see only projects in `Test Team`, **nothing from `tech`/`design`/`rnd`** (RLS + `assertCan`).

---

## 5. Issues (Phase 8)

### 🏁 T9 — Create an issue

1. Open `/projects/<id>/issues` (or press `C`).
2. Click **New issue** → modal:
   - Title + description (TipTap rich editor).
   - Assignee (member list), priority (Urgent→Low), labels.
3. Save → ✅ row appears in **Backlog** group at the bottom; toast confirms.
4. ✅ Sequence ID visible (`WEB-1`) and auto-increments: create 2 more issues → `WEB-2`, `WEB-3`.

### 🏁 T10 — List interactions

- **Group headers** are collapsible: click a **chevron** → ✅ issues fold under it.
- **Click the row** → ✅ peek overlay (right side) with quick-edit chips.
- **Chips** on the row: click **state / priority / assignee / labels** → pick → ✅ updates instantly (optimistic) and syncs via realtime (see §7 cross-browser).
- **Drag a row** to another state group → ✅ state changes, order persists.
- **Bulk select**: Shift+click two rows, or click checkbox → ✅ bulk bar appears with actions (assign, label, state, **archive**, **delete**).
- **Archive** needs confirm (type na    me).

### 🏁 T11 — Full issue page (peek → page)

1. Open the peek overlay → ✅ **"Open full page"** → `/projects/<id>/issues/<issueId>`.
2. Page shows: **Title**, **description editor** (autosave on blur), **right column** with state/priority/assignee/date chips, **sub-issues** (add a sub-issue), **related issues** (add relation → both sides see it), **links** (external URL), **attachments** (drag a file → uploads to Supabase Storage under `{projectId}/{issueId}/`), **comments** (write one), **activity feed** (who changed what, with timestamps).

### 🏁 T12 — Comments, mentions, reactions

1. Write a comment with `@someone` mention → ✅ autocomplete; mention appears as a chip; **notification fires** (§7.4).
2. Add a reaction (the fixed 7-emoji set) to a comment → ✅ counter updates.
3. **Edit** a comment (author only) → ✅ allowed; as a **different user** → ❌ edit hidden/forbidden.
4. **Delete** a comment (author or project manager) → ✅ works; else forbidden.

### 🏁 T13 — Archive / restore / delete

1. Archive an issue → ✅ disappears from list (and its group).
2. Open the **archived** view (filter/archive toggle) → unarchive → ✅ back in list+group.
3. Delete an issue that **has a label & assignee** → ✅ succeeds (regression: this used to fail; fixed in `0007_activity_cascade_guard`). Verify no error toast; activity feed shows a "deleted" entry.
9. [Known issues & gaps](#9-known-issues--gaps)