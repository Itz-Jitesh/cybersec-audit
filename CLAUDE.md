# CLAUDE.md

Project: CyberSec Atria IT project tracker. A private, invite-only, Plane-equivalent project management app for a college cybersecurity club. Next.js 15 App Router on Vercel, Supabase Postgres, ~30 users.

Read this file fully before your first action in any session.

## Authoritative documents

Specifications live in `docs/`. When this file and a doc disagree, the doc wins. When a doc and the existing code disagree, stop and ask.

- `docs/02-PRD.md` — scope, roles, features, what is out of scope
- `docs/03-TRD.md` — stack, architecture, conventions
- `docs/04-DATA-MODEL.md` — schema, triggers, RLS matrix. Authoritative for anything database-related.
- `docs/05-DESIGN-SYSTEM.md` — tokens, typography, components
- `docs/06-UX-LAYOUT-SPEC.md` — screen-by-screen layout
- `docs/07-BUILD-PHASES.md` — what phase we are in and what "done" means
- `docs/tokens-raw.txt` — real colour values extracted from the reference app. Overrides colour values in the design doc.

Do not invent requirements. If a needed detail is absent from all docs, ask one question rather than choosing for the user.

## Commands

```
pnpm dev             # dev server
pnpm build           # production build — writes .next, do not run while dev is up
pnpm build:verify    # same build into .next-verify, safe alongside a running dev server
pnpm typecheck       # tsc --noEmit  — must pass before you report done
pnpm lint            # eslint        — must pass before you report done
pnpm db:generate     # generate Drizzle migration
pnpm db:migrate      # apply migrations
pnpm db:seed         # idempotent seed
pnpm db:test:rls     # RLS assertion suite
```

Run `pnpm typecheck` and `pnpm lint` before declaring any task complete. Do not report success on a task that does not build.

## Stack — fixed

Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Drizzle ORM, Supabase (Postgres + Auth + Realtime + Storage), TanStack Query v5, Zustand, TipTap, dnd-kit, zod, react-hook-form, date-fns, Recharts, lucide-react, sonner.

Forbidden: Prisma, Redux, MobX, styled-components, MUI, Chakra, axios, moment, any auth library other than Supabase Auth, any component library other than shadcn/ui.

Do not add a dependency that is not named in `docs/03-TRD.md` or the current phase prompt. If you believe one is required, stop and ask.

## Architecture rules

Server Components read data through Drizzle. Client components never query the database. All writes go through Server Actions in `src/actions/`.

Every server action, without exception:
1. `'use server'` at the top of the file
2. validate input with a zod schema from `src/lib/validators/`
3. call `assertCan(...)` from `src/lib/auth/permissions.ts`
4. mutate
5. `revalidatePath` where a server-rendered view is affected
6. return `{ ok: true, data }` or `{ ok: false, error, code }` — never throw to the client

Authorization exists in two places and both are mandatory: Postgres RLS policies and `assertCan` in the action. Hiding a button in the UI is not authorization.

Realtime: one Supabase channel per open project, torn down on unmount. Never one channel per row. Realtime events patch the TanStack Query cache; they do not trigger full refetches.

Optimistic updates follow the five-step contract in `docs/03-TRD.md` §3.1: cancel, snapshot, patch, roll back on error, invalidate on settle.

## Code conventions

- Files `kebab-case.tsx`. Components `PascalCase`. Hooks `useCamelCase`. DB columns `snake_case`, TS properties `camelCase`.
- Server Components by default. `'use client'` only where state, effects, or handlers are required, and pushed to the leaf component.
- No `any`. No `@ts-ignore`. No `!` non-null assertion except immediately after an explicit null check.
- No `console.log` outside error handlers.
- Named exports. One component per file.
- Tailwind classes only. No inline `style` except for dynamic colours that come from the database (state colours, label colours).
- **No hardcoded hex colours in any file under `src/components/` or `src/app/`.** Every colour resolves through a CSS variable. This is what makes the future re-theme a one-file change. Violating it is a build-blocking error, not a style nit.
- No font weight above 600.
- Every list query has a limit. No unbounded `SELECT`.

## Visual design directive

Replicate the Plane application UI. Dark theme only. **Do not apply cybersecurity theming** — no neon green, no glow, no terminal aesthetic, no monospace outside issue IDs, code blocks, and keyboard chips. The theme change is a later, separate phase and will be done by editing tokens only.

Density matters: 13px body text, 11px metadata, 38px list rows, 4px spacing grid. If a screen feels roomy, it is wrong.

## Security rules

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never appear in a file containing `'use client'`, never be prefixed `NEXT_PUBLIC_`, and never be used to work around a failing RLS policy. A failing policy is a policy bug or a legitimate denial — investigate, do not bypass.
- No email/password auth, no magic links, no anonymous sign-in, no public sign-up route. OAuth only, invite-gated.
- Never disable RLS on a table.
- Never add a development-only flag that bypasses the invite check or a permission check.
- `issue_activity` and `notifications` are written by database triggers only. Never insert into them from application code.

## Scope discipline

Work only within the current phase from `docs/07-BUILD-PHASES.md`. Do not build ahead. Do not refactor files outside the phase's scope. Do not rename or restructure existing directories.

If you notice a defect outside the current phase, report it in your summary. Do not fix it silently.

## Files you must not modify without being asked

- `supabase/migrations/*` that are already applied — write a new migration instead
- `src/components/ui/*` prop signatures (shadcn primitives)
- `docs/*` — these are the user's specifications
- `.env*`

## When you are uncertain

Ask one specific question. Do not produce a plausible guess and continue. In this project a wrong RLS policy or a wrong permission check is a real security hole affecting real people, and a silently invented requirement costs more to unwind than a question costs to answer.

## Definition of done for any task

- `pnpm typecheck` clean
- `pnpm lint` clean
- The phase's "DoD" bullets in `docs/07-BUILD-PHASES.md` are satisfied
- No new dependency added without approval
- No hardcoded colours introduced
- A summary listing every file created or modified, and anything you could not complete
