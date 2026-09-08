# 01 — Pre-Build Checklist

Do all of this **before** you paste a single prompt into Claude Code. Every item here is a decision an agent would otherwise invent for you, badly, and inconsistently across sessions.

---

## A. Accounts and access

- [ ] GitHub repo created, private, `main` branch protected off (solo build — don't slow yourself down)
- [ ] Supabase account + new project created (region: **Mumbai / ap-south-1**, closest to Bengaluru)
- [ ] Vercel account, linked to the GitHub repo
- [ ] Google Cloud Console project → OAuth 2.0 Client ID created (Web application)
- [ ] GitHub OAuth App created (Settings → Developer settings → OAuth Apps)
- [ ] Domain decided. Options: free `*.vercel.app`, or a real domain (`cybersec-atria.tech` etc.). Buy it now if you want it — DNS propagation is not something to discover on demo day.
- [ ] Resend account (transactional email for invites). Free tier = 3,000 emails/month, plenty.

## B. Credentials to have in hand

Collect these into a local `.env.local` scratch file before starting. The agent will ask for them and you should never let it guess.

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page. **Server-only. Never prefix with `NEXT_PUBLIC_`.** |
| `DATABASE_URL` | Supabase → Connect → Session pooler URI (for Drizzle migrations) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App |
| `RESEND_API_KEY` | Resend dashboard |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, prod URL on Vercel |

Redirect URLs to register in **both** Google and GitHub OAuth apps:
```
http://localhost:3000/auth/callback
https://<your-supabase-ref>.supabase.co/auth/v1/callback
https://<your-prod-domain>/auth/callback
```

## C. Brand assets to prepare

You have the logo. Produce these variants **now** and drop them in `/public/brand/`:

- [ ] `logo-mark.svg` — the circular badge alone, transparent background
- [ ] `logo-mark-32.png`, `logo-mark-64.png`, `logo-mark-128.png` — raster fallbacks
- [ ] `logo-full.svg` — badge + "CYBERSEC / ATRIA I.T" lockup, for the login screen
- [ ] `favicon.ico` (32×32) + `apple-touch-icon.png` (180×180)
- [ ] `og-image.png` (1200×630) — logo centered on `#0d0d0d`, for link previews

Your logo is white-on-dark with a thin blue ring (`#7BA7E8`-ish). Sample the exact ring hex from the file — it is a natural accent candidate later when you do the cybersec reskin. Note it down now, don't use it yet.

## D. Typography — decided, don't re-litigate

Plane's app UI uses **Inter**. That is the correct choice and it is on Google Fonts.

- [ ] Confirm: `Inter` via `next/font/google`, weights 400/500/600, `display: swap`
- [ ] Confirm: `JetBrains Mono` (Google Fonts) for issue IDs, code blocks, and keyboard shortcut chips only
- [ ] Do **not** add a third family. A $10k SaaS app uses two families maximum.

**Type scale (locked — this is the whole reason Plane looks expensive):**

| Token | Size / Line-height | Weight | Used for |
|---|---|---|---|
| `text-2xs` | 10px / 14px | 500 | Badge counts, tiny meta |
| `text-xs` | 11px / 16px | 400–500 | Issue metadata, breadcrumbs, sidebar items |
| `text-sm` | 13px / 20px | 400–500 | **Default body. Most of the app is this size.** |
| `text-base` | 14px / 20px | 500 | Issue titles in list rows |
| `text-lg` | 16px / 24px | 500 | Section headings, modal titles |
| `text-xl` | 20px / 28px | 600 | Issue detail title |
| `text-2xl` | 24px / 32px | 600 | Page titles (rare) |

The single most common mistake is building this at 16px base like a marketing site. Plane's UI is dense — 13px body, 11px metadata. Set this in `tailwind.config` before writing any component.

## E. Colour tokens — how to get exact values

Do not let an agent invent hexes. Do this manually, once, in 15 minutes:

- [ ] Open `app.plane.so` in Chrome, switch to dark theme, open DevTools
- [ ] Inspect `:root` / `html` element → Computed → filter `--color`
- [ ] Copy every `--color-background-*`, `--color-text-*`, `--color-border-*`, `--color-primary-*` value into `docs/tokens-raw.txt` in your repo
- [ ] Hand that file to the agent in Phase 2 as ground truth

Starting values if you skip the above (verify before trusting — these are approximations, not extracted):

```
--bg-100: #191b1b   /* app canvas, deepest */
--bg-90:  #1f2121   /* sidebar, panels */
--bg-80:  #242626   /* cards, hover surfaces */
--bg-70:  #2e3030   /* active/selected surface */
--border-subtle: #2e3030
--border-strong: #3f4141
--text-100: #e6e6e6  /* primary */
--text-200: #b9bbbb  /* secondary */
--text-300: #878888  /* tertiary / placeholder */
--text-400: #5c5e5e  /* disabled */
--accent:   #3f76ff  /* primary action blue */
```

Priority colours (Plane convention, keep them):
`urgent` red `#ef4444` · `high` orange `#f97316` · `medium` yellow `#eab308` · `low` blue `#3b82f6` · `none` gray `#6b7280`

State-group colours:
`backlog` `#6b7280` · `unstarted` `#9ca3af` · `started` `#f59e0b` · `completed` `#16a34a` · `cancelled` `#ef4444`

## F. Layout constants — measure these, write them down

Open Plane, hit `Cmd+Shift+C`, and record the actual pixel values into `docs/layout-raw.txt`:

- [ ] Sidebar width (expanded) — approx **250px**; collapsed — approx **60px**
- [ ] Top header bar height — approx **48px**
- [ ] Issue list row height — approx **36–40px**
- [ ] Kanban card width — approx **260–280px**; column gap
- [ ] Standard border radius — approx **4px** for inputs/buttons, **6–8px** for cards/modals
- [ ] Base spacing unit — **4px** grid throughout
- [ ] Right-hand issue detail panel width — approx **340–360px**

## G. Content decisions

- [ ] Team list confirmed: **Tech, Design, R&D** — any others? (Events? Content? Ops?)
- [ ] Role list confirmed: `admin`, `president`, `co_president`, `lead`, `member`
- [ ] Default issue workflow states per project: `Backlog → Todo → In Progress → In Review → Done → Cancelled`
- [ ] Default label set: `bug`, `feature`, `documentation`, `research`, `ctf`, `blocked`, `good-first-issue`
- [ ] Project identifier convention: 2–5 uppercase letters, e.g. `WEB`, `CTF`, `RECON` → issue IDs render as `WEB-142`
- [ ] Seed member list: names + emails of the ~20 people you'll invite on day one

## H. Local tooling

- [ ] Node 20 LTS or 22 LTS (not odd-numbered versions)
- [ ] `pnpm` installed (`npm i -g pnpm`) — the docs assume pnpm
- [ ] Docker Desktop **optional** — only needed if you want `supabase start` for local DB. Cloud-only is fine and simpler for a solo build.
- [ ] Supabase CLI (`npm i -g supabase`)
- [ ] VS Code extensions: Tailwind CSS IntelliSense, ESLint, Prettier, Error Lens

## I. Ground rules to set with yourself

- [ ] One phase per agent session. Clear context between phases. Long sessions are where hallucinated drift comes from.
- [ ] Commit after every phase, tagged `phase-01`, `phase-02`, …
- [ ] Never let the agent run migrations against production. Migrations run locally, then get pushed.
- [ ] After each phase, manually verify the "Definition of Done" list before moving on.

---

## Time estimate before you start coding

| Task | Time |
|---|---|
| Accounts + OAuth apps + env collection | 60–90 min |
| Logo asset export | 30 min |
| Token + layout extraction from Plane | 30 min |
| Reading 02–07 of this pack | 60 min |
| **Total pre-work** | **~3–4 hours** |

Do not skip the token extraction. It is the difference between "looks like a $10k SaaS" and "looks like a bootcamp project."
