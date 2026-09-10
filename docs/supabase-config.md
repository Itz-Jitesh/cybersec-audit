# Supabase dashboard configuration

Steps that cannot be expressed as a migration and must be done by hand in the
Supabase dashboard. Phase 5 is not finished until all of them are done, because
the application assumes every one of them.

## 1. Providers

**Authentication → Providers**

- **Google** — enable. Client ID and secret from the Google Cloud Console OAuth
  2.0 credentials.
- **GitHub** — enable. Client ID and secret from the GitHub OAuth App.
- **Email** — **disable**. The product has no password, magic-link or OTP path,
  and leaving the provider enabled leaves a second way in that nothing in this
  codebase guards.
- **Anonymous sign-in** — confirm it is off.

## 2. Redirect allowlist

**Authentication → URL Configuration**

Site URL:

```
https://<your-production-domain>
```

Redirect URLs — every origin the callback can legitimately return to:

```
http://localhost:3000/auth/callback
https://<your-production-domain>/auth/callback
https://<your-vercel-preview-domain>/auth/callback
```

The same callback path also has to be registered on the provider side, in both
the Google OAuth client and the GitHub OAuth App:

```
http://localhost:3000/auth/callback
https://<your-supabase-ref>.supabase.co/auth/v1/callback
https://<your-production-domain>/auth/callback
```

## 3. Multi-factor authentication

**Authentication → Multi-Factor Authentication**

- Enable **TOTP**.
- Leave phone/SMS factors off.

Enrolment is enforced in `src/middleware.ts` for `admin`, `president` and
`co_president`, not in the dashboard. A member may enrol voluntarily.

Passkeys are not available as an MFA factor. Supabase auth.mfa.enroll accepts factor types totp and phone only. Supabase provides a separate beta passkey sign-in capability under the supabase.auth.passkey namespace, enabled in Dashboard under Authentication, Configuration, Passkeys. A passkey sign-in produces assurance level aal1 and therefore cannot satisfy the aal2 requirement enforced in middleware for privileged roles. If passkey sign-in is added later it is an additional primary sign-in method, not a replacement for TOTP.

## 4. Storage

**Storage → Buckets**

Create a private bucket named `attachments`. Issue attachments are written under
`{project_id}/{issue_id}/{uuid}-{filename}`. Used from phase 8 onward.

## 5. What is deliberately not configured here

- **Invite gating** lives in the `handle_new_user` trigger, not in a dashboard
  setting. An uninvited address is rejected during the `auth.users` insert, so
  no account survives the attempt. See `supabase/migrations/0006_handle_new_user.sql`.
- **Row level security** is enabled by migration on every table in `public`, and
  asserted by `supabase/tests/rls.sql`. Never disable it from the dashboard to
  make a query work.

## 6. Verifying the configuration

```
node --env-file=.env.local src/db/run-auth-tests.ts   # invite gate
node --env-file=.env.local src/db/run-rls-tests.ts    # access boundaries
```

Then, by hand:

1. Sign in with a Google account that has no invite. Expect the rejection notice
   on `/sign-in`, and no new row in `profiles` or `auth.users`.
2. Sign in with an invited address. Expect `/home`, one `profiles` row, one
   `workspace_members` row, and the invite marked accepted.
3. Sign in as an administrator with no enrolled factor. Expect every protected
   route to redirect to `/mfa` until enrolment completes.
