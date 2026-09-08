# 03 — Technical Requirements Document

## 1. Stack (locked — do not deviate without editing this doc first)

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | Next.js App Router | 15.x | Server Components cut client JS; Vercel-native |
| Language | TypeScript | 5.x, `strict: true` | Non-negotiable |
| Runtime | Node 20 LTS | — | Vercel default |
| Package manager | pnpm | 9.x | Fast, strict, good with monorepo-ish layouts |
| Styling | Tailwind CSS | v4 | CSS-variable-driven theming = one-file reskin later |
| Components | shadcn/ui (Radix primitives) | latest | Owned source, not a dependency; accessible by default |
| Database | Supabase Postgres | 15 | Managed, RLS, realtime, ap-south-1 |
| ORM / migrations | Drizzle ORM + drizzle-kit | latest | Typed schema, plain SQL migrations, RLS-friendly |
| Auth | Supabase Auth (`@supabase/ssr`) | latest | OAuth + TOTP MFA out of the box |
| Realtime | Supabase Realtime (Postgres changes) | — | No extra service, no Redis |
| File storage | Supabase Storage | — | Avatars, issue attachments |
| Server state | TanStack Query v5 | 5.x | Cache + optimistic updates + realtime invalidation |
| Client state | Zustand | 5.x | Ephemeral UI only (modals, sidebar, selection) |
| Rich text | TipTap | 2.x | Issue descriptions, comments, pages |
| DnD | `@dnd-kit/core` + `sortable` | latest | Kanban, list reorder, calendar drag |
| Forms | react-hook-form + zod | latest | Shared zod schemas between client and server actions |
| Dates | date-fns | 4.x | Tree-shakeable |
| Charts | Recharts | 2.x | Burndown, analytics |
| Icons | lucide-react | latest | Matches Plane's visual weight |
| Email | Resend + react-email | latest | Invite emails only |
| Hosting | Vercel | Hobby → Pro if needed | — |

**Explicitly forbidden:** Prisma (RLS friction), MobX, Redux, styled-components, Material UI, Chakra, moment.js, axios, any component library other than shadcn/ui, any auth library other than Supabase Auth.

## 2. Repository layout

```
/
├─ CLAUDE.md
├─ AGENTS.md
├─ docs/                      # this pack, committed
├─ drizzle/                   # generated SQL migrations
├─ public/brand/              # logo assets
├─ src/
│  ├─ app/
│  │  ├─ (auth)/              # unauthenticated routes
│  │  │  ├─ sign-in/page.tsx
│  │  │  ├─ invite/[token]/page.tsx
│  │  │  └─ mfa/page.tsx
│  │  ├─ (app)/               # authenticated shell
│  │  │  ├─ layout.tsx        # sidebar + header shell
│  │  │  ├─ home/page.tsx
│  │  │  ├─ my-issues/page.tsx
│  │  │  ├─ notifications/page.tsx
│  │  │  ├─ teams/[teamSlug]/page.tsx
│  │  │  ├─ projects/[projectId]/
│  │  │  │  ├─ issues/page.tsx
│  │  │  │  ├─ issues/[issueId]/page.tsx
│  │  │  │  ├─ cycles/page.tsx
│  │  │  │  ├─ cycles/[cycleId]/page.tsx
│  │  │  │  ├─ modules/page.tsx
│  │  │  │  ├─ modules/[moduleId]/page.tsx
│  │  │  │  ├─ views/page.tsx
│  │  │  │  ├─ pages/page.tsx
│  │  │  │  ├─ analytics/page.tsx
│  │  │  │  └─ settings/page.tsx
│  │  │  └─ admin/            # workspace admin panel
│  │  ├─ auth/callback/route.ts
│  │  ├─ api/                 # route handlers ONLY where a server action can't work
│  │  ├─ layout.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ ui/                  # shadcn primitives, unmodified API
│  │  ├─ layout/              # sidebar, header, breadcrumbs, command palette
│  │  ├─ issues/              # issue card, row, detail panel, quick-add, filters
│  │  ├─ views/               # list, kanban, calendar, spreadsheet renderers
│  │  ├─ cycles/ modules/ pages/ admin/
│  │  └─ shared/              # avatar, priority-icon, state-icon, date-picker, empty-state
│  ├─ db/
│  │  ├─ schema/              # one file per domain: issues.ts, projects.ts, …
│  │  ├─ index.ts             # drizzle client
│  │  └─ queries/             # reusable typed query functions
│  ├─ lib/
│  │  ├─ supabase/            # client.ts, server.ts, middleware.ts
│  │  ├─ auth/                # session helpers, role guards
│  │  ├─ realtime/            # channel subscription hooks
│  │  ├─ validators/          # zod schemas, shared client+server
│  │  └─ utils/
│  ├─ actions/                # 'use server' mutations, one file per domain
│  ├─ hooks/
│  ├─ stores/                 # zustand
│  ├─ types/
│  └─ middleware.ts           # session refresh + route protection
└─ supabase/
   └─ migrations/             # RLS policies, triggers, functions (hand-written SQL)
```

## 3. Data access architecture

Three access paths, each with a clear rule:

1. **Server Components → Drizzle directly.** Initial page data. Uses a connection with the authenticated user's context; RLS still applies via `set local role` / JWT claims pattern, or the query explicitly scopes by membership. Fast, no waterfall.
2. **Client mutations → Server Actions.** All writes. Each action: validate with zod → check permission → mutate → `revalidatePath` where needed. Never call Supabase directly from a client component for writes.
3. **Client reads/refetch → TanStack Query hitting server actions or route handlers.** Used after the initial render for filtered/paginated data.

**Realtime layer:** Supabase Realtime subscribes to Postgres changes on `issues`, `comments`, `notifications` filtered by project. On an event, the handler calls `queryClient.setQueryData` (surgical patch) or `invalidateQueries` (fallback). It does **not** refetch the whole page.

### 3.1 Optimistic update contract
Every mutation that affects a visible list (state change, drag, priority, assignee) must:
1. Cancel in-flight queries for that key
2. Snapshot previous cache
3. Apply optimistic patch
4. On error, roll back and toast the failure
5. On settle, invalidate

## 4. Auth architecture

```
User clicks "Continue with Google"
  → supabase.auth.signInWithOAuth({ provider, redirectTo: /auth/callback })
  → Google consent
  → /auth/callback route handler exchanges code for session
  → Postgres trigger `handle_new_user` fired on auth.users insert:
       - looks up invites WHERE email = new.email AND accepted_at IS NULL AND expires_at > now()
       - if none found: raise exception → user is rejected, session destroyed
       - if found: insert into profiles, insert into workspace_members with invited role,
                   insert into team_members if invite carried a team, mark invite accepted
  → middleware checks: session valid? membership active? MFA satisfied if required?
  → redirect to /home
```

Rules:
- `middleware.ts` runs on every non-static route. It refreshes the Supabase session cookie and redirects unauthenticated users to `/sign-in`.
- MFA: `aal2` required for `admin` / `president` / `co_president`. If session is `aal1` and role requires `aal2`, middleware redirects to `/mfa`.
- Invite tokens are opaque UUIDs stored in `invites.token`, single-use, 7-day expiry.
- Deactivated members (`workspace_members.is_active = false`) are rejected at middleware, not just hidden in the UI.

## 5. Authorization

Two enforcement layers, both mandatory:

1. **Postgres RLS** — the real boundary. Every table has RLS enabled. Policies are written as SQL in `supabase/migrations/`, never generated by an agent without review.
2. **Application guards** — `assertCan(user, 'project:delete', projectId)` at the top of every server action. Fails fast with a typed error before hitting the DB.

Helper SQL functions (defined once, used in every policy):
```sql
is_workspace_admin(uid)      -- admin | president | co_president
is_team_lead(uid, team_id)
is_project_member(uid, project_id)
can_write_project(uid, project_id)
```

## 6. Vercel constraints and how each is handled

| Constraint | Implication | Mitigation |
|---|---|---|
| No long-running processes | No Celery/BullMQ worker | Vercel Cron for the only scheduled jobs (cycle status rollover, invite expiry cleanup) |
| Serverless function timeout (10s hobby / 60s pro) | No heavy batch jobs | All mutations are single-row or small batch; analytics computed with SQL aggregates, not app-side loops |
| No Redis | No custom pub/sub, no rate-limit store | Supabase Realtime for pub/sub; `@upstash/ratelimit` only if abuse appears (unlikely at 30 users) |
| No local filesystem | No file writes | Supabase Storage for all uploads |
| Cold starts | First request after idle is slow | Server Components + edge middleware keep the critical path light; acceptable at this scale |
| Connection limits | Serverless × Postgres = connection exhaustion | **Always use Supabase's transaction pooler URL (port 6543) at runtime**; session pooler (5432) only for migrations |

## 7. Realtime scaling note

30 concurrent users × ~3 open channels each = ~90 concurrent Realtime connections. Supabase free tier allows 200 concurrent connections; Pro allows 500. Fine. But: subscribe **per project**, not per issue. One channel per open project view, torn down on navigation. Never open a channel per rendered card.

## 8. Performance requirements

- Issue list must render 500 issues without jank → virtualise list and spreadsheet layouts with `@tanstack/react-virtual` once a project exceeds 100 issues.
- Kanban columns paginate at 50 cards with "load more".
- All list queries paginate server-side. No `SELECT *` without a limit.
- Required indexes are specified in [[04-DATA-MODEL]] — they are not optional.

## 9. Testing requirements

- **Vitest** for validators, permission helpers, and pure utils.
- **RLS test suite**: a SQL script that impersonates each role and asserts read/write outcomes on every table. This is the single most important test in the project — it is what stops the R&D team reading Tech's issues.
- **Playwright** smoke suite (Phase 12 only): sign in → create issue → move on kanban → comment → verify realtime in second browser context.
- No unit tests on React components. Not worth it here.

## 10. Error handling and observability

- `error.tsx` and `not-found.tsx` at every route segment boundary.
- All server actions return a discriminated union `{ ok: true, data } | { ok: false, error, code }`. Never throw raw to the client.
- `sonner` toasts for all user-facing outcomes.
- Vercel Analytics + Speed Insights enabled. Sentry optional, add only if you hit real bugs in production.

## 11. Conventions (enforced in CLAUDE.md / AGENTS.md)

- Files: `kebab-case.tsx`. Components: `PascalCase`. Hooks: `useCamelCase`. DB columns: `snake_case`. TS fields: `camelCase` (Drizzle maps).
- Server Components by default. `'use client'` only when the component needs state, effects, or event handlers — and then push it to the leaf.
- No `any`. No `@ts-ignore`. No non-null assertion `!` except immediately after an explicit null check.
- Every server action file starts with `'use server'` and every exported function validates its input with zod as line one.
- Tailwind only. Zero inline `style={{}}` except for dynamic colour values coming from the DB (state/label colours).
- All colours referenced as CSS variables via Tailwind tokens. **No raw hex in any component file.** This is what makes the cybersec reskin a one-file change later.
