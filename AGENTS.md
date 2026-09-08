# AGENTS.md

Instructions for any coding agent operating in this repository (opencode, Cline, Cursor, Codex, or similar). Claude Code reads `CLAUDE.md`, which contains the same rules.

Read this file completely before your first tool call in a session.

## Project

CyberSec Atria IT project tracker. A private, invite-only project management application for a college cybersecurity club, functionally equivalent to Plane. Next.js 15 App Router deployed on Vercel, Supabase Postgres, approximately 30 users total.

## Specification files — authoritative

All requirements live in `docs/`. If this file and a doc conflict, the doc is correct. If a doc and existing code conflict, stop and ask the user.

| File | Authoritative for |
|---|---|
| `docs/02-PRD.md` | Scope, roles, feature list, exclusions |
| `docs/03-TRD.md` | Stack, architecture, conventions |
| `docs/04-DATA-MODEL.md` | Schema, triggers, RLS matrix |
| `docs/05-DESIGN-SYSTEM.md` | Tokens, typography, component inventory |
| `docs/06-UX-LAYOUT-SPEC.md` | Layout of every screen |
| `docs/07-BUILD-PHASES.md` | Current phase and its definition of done |
| `docs/tokens-raw.txt` | Real extracted colour values; overrides the design doc |

Never invent a requirement. If something needed is not specified anywhere, ask one question and wait.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm typecheck` | `tsc --noEmit` — must pass before reporting done |
| `pnpm lint` | ESLint — must pass before reporting done |
| `pnpm db:generate` | Generate Drizzle migration |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Idempotent seed |
| `pnpm db:test:rls` | RLS assertion suite |

## Fixed stack

Next.js 15, TypeScript strict, Tailwind v4, shadcn/ui, Drizzle ORM, Supabase (Postgres, Auth, Realtime, Storage), TanStack Query v5, Zustand, TipTap, dnd-kit, zod, react-hook-form, date-fns, Recharts, lucide-react, sonner.

Never introduce: Prisma, Redux, MobX, styled-components, Material UI, Chakra, axios, moment.js, any non-Supabase auth library, any component library besides shadcn/ui.

Adding any dependency not listed in `docs/03-TRD.md` or in the active phase prompt requires explicit user approval first.

## Architecture rules

1. Server Components read via Drizzle. Client components never access the database directly.
2. All mutations are Server Actions in `src/actions/`.
3. Every server action follows this exact order: `'use server'` → zod validation → `assertCan()` → mutation → `revalidatePath` → return `{ ok: true, data }` or `{ ok: false, error, code }`. Actions never throw to the client.
4. Authorization is enforced twice: Postgres RLS policies and `assertCan()` in the action. UI-level hiding is not authorization and never counts.
5. Realtime uses one Supabase channel per open project, removed on unmount. Never one channel per row. Events patch the TanStack Query cache rather than triggering refetches.
6. Optimistic updates follow the five-step contract in `docs/03-TRD.md` §3.1.
7. All filtering, sorting, and aggregation happen in SQL. Never fetch a result set and process it in JavaScript.

## Code conventions

- Filenames `kebab-case`. Components `PascalCase`. Hooks `useCamelCase`. DB columns `snake_case`, TS properties `camelCase`.
- Server Components by default; `'use client'` only when state, effects, or event handlers are needed, and only on the leaf component that needs it.
- Prohibited: `any`, `@ts-ignore`, non-null assertion `!` except immediately after an explicit null check, `console.log` outside error handlers, default exports for components.
- Tailwind only. Inline `style` is permitted solely for dynamic colour values sourced from the database.
- **Zero hardcoded hex colours in `src/components/` or `src/app/`.** All colours resolve through CSS variables. This is a hard failure, not a preference — it is what allows the entire app to be re-themed by editing one file later.
- Font weights above 600 are prohibited.
- Every query has an explicit limit.

## Visual directive

Replicate the Plane application UI exactly. Dark theme only. **Do not apply any cybersecurity theming** in the current phases: no neon accents, no glow effects, no terminal or hacker aesthetic, no monospace type outside issue identifiers, code blocks, and keyboard shortcut chips.

The interface is dense: 13px body, 11px metadata, 38px rows, 4px spacing grid, 4–8px radii. Generous whitespace is a defect here.

## Security rules

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never appear in a `'use client'` file, never carry a `NEXT_PUBLIC_` prefix, and never be used to bypass a failing RLS policy. A denial is either a policy bug to fix or correct behaviour to respect.
- Authentication is OAuth only (Google, GitHub) and invite-gated. Never implement password auth, magic links, anonymous sign-in, or a public sign-up route.
- Never disable RLS on any table.
- Never add an environment flag or development shortcut that bypasses invite validation or a permission check.
- `issue_activity` and `notifications` are populated exclusively by database triggers. Never insert into them from application code.

## Scope discipline

Work strictly within the active phase in `docs/07-BUILD-PHASES.md`. Do not implement future phases early. Do not refactor, rename, or restructure files outside the phase scope. Report defects you notice elsewhere in your summary instead of fixing them silently.

## Do not modify without explicit instruction

- Already-applied files in `supabase/migrations/` — add a new migration instead
- Prop signatures of components in `src/components/ui/`
- Anything in `docs/`
- Any `.env` file

## Uncertainty protocol

Ask one specific question and wait. Do not proceed on a plausible guess. In this codebase an incorrect permission check is a real security hole affecting real people, and an invented requirement costs more to unwind than a question costs to ask.

## Definition of done

Before reporting a task complete, confirm all of:

- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
- [ ] The phase's definition-of-done items in `docs/07-BUILD-PHASES.md` are satisfied
- [ ] No unapproved dependency was added
- [ ] No hardcoded colour value was introduced
- [ ] Summary provided listing every file created or modified, plus anything left incomplete or uncertain
