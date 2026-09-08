# 09 — Deployment

## 1. Environments

| Env | Vercel | Supabase | Purpose |
|---|---|---|---|
| Local | `pnpm dev` | Cloud dev project | Day-to-day building |
| Preview | Auto per branch/PR | Same dev project | Sanity check before merge |
| Production | `main` branch | Separate prod project (recommended) | Real club use |

A separate prod Supabase project is recommended but optional at 30 users. If you use one project for both, **never run destructive migrations from a preview branch.**

## 2. Environment variables

| Variable | Local | Preview | Prod | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ | **Server-only. Never `NEXT_PUBLIC_`.** |
| `DATABASE_URL` | ✓ | ✓ | ✓ | Runtime: **transaction pooler, port 6543** |
| `MIGRATION_DATABASE_URL` | ✓ | — | — | Session pooler, port 5432, local only |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Vercel preview URL | Prod domain | |
| `RESEND_API_KEY` | ✓ | ✓ | ✓ | |
| `EMAIL_FROM` | ✓ | ✓ | ✓ | e.g. `CyberSec Atria <noreply@yourdomain>` |
| `CRON_SECRET` | ✓ | ✓ | ✓ | Random 32-byte hex |
| `SEED_ADMIN_EMAIL` | ✓ | — | — | Bootstrap only |

Set all Vercel vars in Project → Settings → Environment Variables, scoped correctly. Anything marked server-only must **not** carry the `NEXT_PUBLIC_` prefix — that prefix inlines the value into the client bundle.

## 3. Supabase dashboard configuration (manual, do not skip)

**Authentication → Providers**
- [ ] Google: enabled, client ID + secret set
- [ ] GitHub: enabled, client ID + secret set
- [ ] Email: **disabled**
- [ ] Phone, anonymous, all others: disabled

**Authentication → URL Configuration**
- [ ] Site URL = production domain
- [ ] Redirect allowlist: `http://localhost:3000/**`, the Vercel preview pattern, production domain `/**`

**Authentication → MFA**
- [ ] TOTP enabled
- [ ] Max enrolled factors: 3

**Database**
- [ ] Confirm RLS is enabled on every table in `public` (Table Editor shows a shield icon)
- [ ] Realtime enabled for `issues`, `comments`, `notifications` only (Database → Replication). Do not enable it workspace-wide.
- [ ] PITR enabled if on Pro. On free tier, schedule a weekly `pg_dump` yourself.

**Storage**
- [ ] Bucket `avatars` — public read, authenticated write, 2MB limit, image mime types only
- [ ] Bucket `attachments` — **private**, RLS policy allowing read/write only to members of the owning project, 10MB limit

## 4. Migration workflow

```bash
# 1. change Drizzle schema
pnpm db:generate           # produces drizzle/NNNN_*.sql

# 2. review the generated SQL by hand. always.
# 3. apply to dev
pnpm db:migrate

# 4. hand-authored SQL (triggers, RLS) — run in order via Supabase SQL editor
#    or: supabase db push

# 5. verify
pnpm db:test:rls
```

Rules:
- Never `drizzle-kit push` against production. Generate a migration and apply it.
- Never edit an applied migration. Write a new one.
- Migrations always run before the deploy that depends on them.

## 5. Vercel setup

- Framework preset: Next.js. Build `pnpm build`. Install `pnpm install`. Node 20.x.
- Region: **Mumbai (bom1)** to sit next to the Supabase ap-south-1 project. Latency between the function and the DB is the single biggest lever you have here.
- Enable Vercel Analytics and Speed Insights.

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/cycle-snapshots", "schedule": "0 18 * * *" }
  ]
}
```
(`0 18 * * *` UTC = 23:30 IST daily.)

Cron routes must verify `request.headers.get('authorization') === 'Bearer ' + process.env.CRON_SECRET` and return 401 otherwise. Vercel Hobby allows a limited number of cron jobs — one is fine.

## 6. Domain

1. Add the domain in Vercel → Project → Domains.
2. Point the registrar's nameservers or add the A/CNAME records Vercel gives you.
3. Wait for the certificate to issue.
4. Update `NEXT_PUBLIC_APP_URL`, the Supabase Site URL and redirect allowlist, and the Google/GitHub OAuth redirect URIs.
5. Redeploy — env var changes do not take effect until a new deployment.

## 7. Pre-launch checklist

- [ ] `/dev/*` routes deleted
- [ ] `grep -r SUPABASE_SERVICE_ROLE .next/static` returns nothing
- [ ] Email provider disabled in Supabase
- [ ] RLS test suite green against production schema
- [ ] Uninvited Google account is rejected on the real domain
- [ ] Admin account is forced through MFA enrolment
- [ ] Invite email arrives, does not land in spam (add SPF/DKIM via Resend domain verification)
- [ ] Attachment upload and download works with the private bucket policy
- [ ] Realtime works across two devices on the production URL
- [ ] Lighthouse ≥ 85 performance, ≥ 95 accessibility
- [ ] Error boundaries render, not white screens

## 8. Cost at this scale

| Service | Tier | Cost | Headroom |
|---|---|---|---|
| Vercel | Hobby | ₹0 | Fine for a private club app. Note Hobby is technically for non-commercial use — you qualify. |
| Supabase | Free | ₹0 | 500MB DB, 1GB storage, 200 concurrent realtime. Pro (~$25/mo) if you exceed storage or want PITR. |
| Resend | Free | ₹0 | 3,000 emails/month |
| Domain | — | ~₹800–1,500/yr | Optional |

**First thing to break at scale:** Supabase free-tier storage if members attach screenshots liberally. Cap attachments at 10MB and check usage monthly.

## 9. Backups

Free tier has no PITR. Do this weekly, manually or via a GitHub Action:
```bash
pg_dump "$MIGRATION_DATABASE_URL" -Fc -f backup-$(date +%F).dump
```
Store the dumps outside the Supabase project. A club app that loses a semester of issue history is worse than no app.

## 10. Onboarding the club

1. Sign in yourself first via the seeded admin invite. Enrol MFA.
2. Create the three teams and assign leads.
3. Create one project per team so nobody lands on an empty workspace.
4. Admin → Invites → paste all 20 emails, role `member`, assign team.
5. Post the sign-in link in the club channel with one line: "Use the Google account matching the email you were invited on."
6. Expect two or three people to use the wrong Google account. Revoke and re-invite; it takes ten seconds.
