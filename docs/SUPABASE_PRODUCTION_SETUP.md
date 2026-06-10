# Supabase Production Setup — Phase 4S

**Date:** 2026-06-10  
**Purpose:** Configure a Supabase project for production-style deployment with Aegis Wealth OS.

**Related:** [Environment Variables](./ENVIRONMENT_VARIABLES.md) · [Vercel Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md) · [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md)

---

## 1. Create or select a project

- Use a **dedicated production project** (recommended) separate from local dev.
- Note the **Project URL** and region — latency matters for auth and storage.

---

## 2. API keys (Settings → API)

Copy these into Vercel (or `.env.local` for local testing against staging):

| Key | Env var | Notes |
|-----|---------|-------|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe for browser; RLS applies |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never `NEXT_PUBLIC_` |

Rotate keys if they were ever exposed. Do not paste keys into docs, tickets, or chat.

---

## 3. Auth redirect URLs (Authentication → URL Configuration)

Add every origin where the app runs. The callback handler is `app/auth/callback/route.ts`.

### Site URL

Set to your primary production URL, e.g. `https://your-app.vercel.app` or custom domain.

### Redirect URLs (allow list)

| Environment | Example redirect URL |
|-------------|---------------------|
| Local dev | `http://localhost:3000/auth/callback` |
| Vercel preview | `https://*-<team-slug>.vercel.app/auth/callback` or per-preview URL |
| Production | `https://your-production-domain.com/auth/callback` |

Also allow signup landing pages used by invitation flows:

| Environment | Example |
|-------------|---------|
| Local | `http://localhost:3000/signup` |
| Preview | `https://<preview-host>/signup` |
| Production | `https://your-production-domain.com/signup` |

Supabase invitation emails use `redirectTo` pointing at `/signup` on the request origin (`lib/supabase/clientOnboarding.ts`).

---

## 4. Email and invitations

- **Authentication → Providers → Email** — enable email/password (minimum).
- Configure **SMTP** or use Supabase built-in mail for production deliverability.
- Test advisor/admin **client invitation** flow after deploy — invites call `auth.admin.inviteUserByEmail`.
- Confirm invitation emails link to the correct deployed origin (not `localhost`).

---

## 5. Storage

- Bucket name: **`client-documents`** (required by app and migrations).
- Policies: applied via migration `supabase/migrations/202606100010_storage_policies.sql`.
- Verify in dashboard: **Storage → client-documents → Policies**.

Upload limits and MIME checks are enforced in API routes (10 MB max).

---

## 6. Database migrations

Apply all migrations in order to the target database:

```bash
# Link CLI to project (one-time per machine)
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push
```

Migration files (apply in timestamp order):

- `202606100001_extensions_and_enums.sql` through `202606100013_advisor_tasks.sql`

Confirm:

- [ ] All migrations applied without error
- [ ] Schema matches `docs/database-schema.md`
- [ ] No manual schema drift outside migration history

---

## 7. Row Level Security (RLS)

- RLS policies: `supabase/migrations/202606100009_rls_policies.sql`
- Storage policies: `supabase/migrations/202606100010_storage_policies.sql`
- Service role bypasses RLS — used only in trusted server modules (`lib/supabase/admin.ts` with `import "server-only"`).

Verify in Supabase dashboard: **Database → Tables** — RLS enabled on public tables.

---

## 8. Roles and test users

Production bootstrap (before real users):

1. Create auth users via signup or Supabase dashboard.
2. Set `public.users.role` to `client`, `advisor`, or `admin`.
3. Link clients via `clients.user_id` and `clients.advisor_user_id` for advisor assignment tests.

See [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) for expected access patterns.

---

## 9. Database backups

Before production traffic:

- Enable **Point-in-Time Recovery (PITR)** on paid plans, or schedule logical backups.
- Document restore procedure and RTO/RPO targets.
- Include **`client-documents` storage** in backup/restore planning (export bucket periodically or use provider backup tools).
- Run a **restore drill** in staging at least once.

---

## 10. Health check

After env vars and migrations are in place:

```bash
curl -s https://<your-deployed-host>/api/health/supabase
```

Expected: `{ "ok": true, ... }` when DB is healthy. In production mode, the response omits internal diagnostic fields (see `app/api/health/supabase/route.ts`).

---

## Warnings

- **Do not load real client PII/financial data** until legal, compliance, and security sign-off.
- **Service role key** must never be exposed to the browser or committed to git.
- Review [Security Test Plan](./SECURITY_TEST_PLAN.md) before go-live.
