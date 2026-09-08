# CyberSec Atria IT — Project Tracker Build Pack

Ground-up rebuild of [Plane](https://plane.so) as a private, invite-only project tracker for the CyberSec Atria IT club, deployed on Vercel + Supabase.

## Read in this order

| # | Doc | What it's for | When you use it |
|---|-----|---------------|-----------------|
| 01 | [[01-PRE-BUILD-CHECKLIST]] | Everything to decide/collect **before** opening an AI agent | Now, before anything else |
| 02 | [[02-PRD]] | What the product is, who uses it, what's in MVP | Reference during scoping disputes |
| 03 | [[03-TRD]] | Stack, architecture, auth flow, realtime, constraints | Reference during every phase |
| 04 | [[04-DATA-MODEL]] | Full Postgres schema + RLS rules | Phase 1, then constantly |
| 05 | [[05-DESIGN-SYSTEM]] | Tokens, type scale, spacing, component inventory | Phase 2 |
| 06 | [[06-UX-LAYOUT-SPEC]] | Screen-by-screen layout replication of Plane | Phase 2 onward |
| 07 | [[07-BUILD-PHASES]] | The actual ordered build plan with checkboxes | Your day-to-day tracker |
| 08 | [[08-PROMPT-PACK]] | Literal prompts to paste into Claude Code / opencode / Cline | Every phase |
| 09 | [[09-DEPLOYMENT]] | Vercel, envs, migrations, domain, monitoring | Phase 0 and Phase 12 |
| — | [[CLAUDE]] | Repo-root agent rules for Claude Code | Copy to repo root as `CLAUDE.md` |
| — | [[AGENTS]] | Repo-root agent rules for opencode / Cline / others | Copy to repo root as `AGENTS.md` |

## Hard facts about this build

- **Plane's real stack is Django + Postgres + Redis + MinIO + Celery workers.** None of that runs on Vercel. This is not a fork. It is a re-implementation of the same product in a Vercel-native stack.
- The Plane repo (`github.com/makeplane/plane`) is used as a **behavioural and data-model reference only**. You may read it to understand how cycles, modules, and issue activity work. You do not copy its code.
- Plane is AGPL-3.0. Since you are writing original code and only mirroring UX conventions (which are not copyrightable), you are clear. Do **not** copy their logo, wordmark, marketing copy, or illustration assets.

## Scope summary (locked)

- Single workspace: `CyberSec Atria IT`
- Teams inside it: Tech, Design, R&D (+ extensible)
- Invite-only, admin-issued. No public signup.
- OAuth (Google + GitHub) + TOTP 2FA. Passkeys in Phase 11.
- ~20–30 concurrent users at peak.
- Realtime collaboration in v1.
- Dark mode only in v1.
- Desktop-first; mobile-responsive pass in Phase 12.
- Visual design: replicate Plane exactly. **No cybersecurity theming yet** — the design system is token-based so you can reskin later by editing one file.
