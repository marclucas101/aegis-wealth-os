# Environment Variables — Phase 4S

**Date:** 2026-06-10  
**Purpose:** Reference for required and optional environment variables across local development, Vercel, and Supabase.

**Related:** [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) · [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) · [Vercel + Supabase Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md)

---

## Required variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser + server) | Supabase project API URL, e.g. `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser + server) | Supabase anon (publishable) key — safe in client bundle; RLS enforces access |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase service role key — bypasses RLS. **Never** use a `NEXT_PUBLIC_` prefix |

The app reads these in `lib/supabase/env.ts`, `lib/supabase/client.ts`, and `lib/supabase/admin.ts`.

### Critical security rule

**`SUPABASE_SERVICE_ROLE_KEY` must only exist as a server-side environment variable on Vercel (Production, Preview, Development scopes as needed). It must never be prefixed with `NEXT_PUBLIC_` and must never appear in client-side JavaScript bundles.**

Run `npm run deploy:config` to verify naming and URL shape without printing secret values.

---

## Optional variables

| Variable | Scope | Used for |
|----------|-------|----------|
| `BASE_URL` | Server / scripts | Target URL for `npm run qa:smoke` (defaults to `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | Public (optional) | Canonical app URL for links or future client-side redirects; not required today if the app derives origin from requests |
| `NODE_ENV` | Runtime | Set automatically by Next.js / Vercel (`development` locally, `production` on Vercel production) |
| `VERCEL_ENV` | Runtime (Vercel) | `production`, `preview`, or `development` — used by health endpoint to reduce diagnostic leakage |

### Google Calendar booking (Phase 6D — server only unless noted)

| Variable | Scope | Used for |
|----------|-------|----------|
| `GOOGLE_CLIENT_ID` | **Server only** | Google OAuth web client ID for adviser calendar connection |
| `GOOGLE_CLIENT_SECRET` | **Server only** | Google OAuth client secret — **never** expose to the browser |
| `GOOGLE_CALENDAR_REDIRECT_URI` | **Server only** | OAuth callback URL registered in Google Cloud Console. Local: `http://localhost:3000/api/google-calendar/callback`. Production: `https://aegis-wealth-os.vercel.app/api/google-calendar/callback` (or your deployed domain) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | **Server only** | 32-byte key (64-char hex or base64) for AES-256-GCM encryption of stored OAuth tokens |
| `GOOGLE_OAUTH_STATE_SECRET` | **Server only** (optional) | HMAC secret for OAuth `state` parameter validation; falls back to `GOOGLE_TOKEN_ENCRYPTION_KEY` if unset |

**Security:** Refresh and access tokens are encrypted at rest in `adviser_calendar_connections` and are never returned to browser components or client APIs.

---

## Where to set variables

### Local development — `.env.local`

1. Copy `.env.example` to `.env.local` (gitignored).
2. Fill in values from your Supabase project dashboard (**Settings → API**).
3. Verify: `npm run qa:env`

```bash
cp .env.example .env.local
# Edit .env.local — never commit real keys
npm run qa:env
```

### Vercel project — Environment Variables

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add each required variable for the appropriate scopes:
   - **Production** — live domain
   - **Preview** — pull-request deployments
   - **Development** — `vercel dev` (optional)
3. Set `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive** (encrypted at rest).
4. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

Recommended Vercel mapping:

| Variable | Production | Preview | Development |
|----------|------------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod Supabase project | Staging or prod (your choice) | Dev project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod anon key | Matching project anon key | Dev anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod service role | Matching service role | Dev service role |
| `BASE_URL` | `https://your-domain.com` | Preview URL when running smoke tests | `http://localhost:3000` |
| `RESEND_API_KEY` | Resend API key (production email) | Optional | Omit (dev logs emails) |
| `EMAIL_FROM` | Verified sender, e.g. `AEGIS <appointments@yourdomain.com>` | Optional | Omit (dev logs emails) |
| `CRON_SECRET` | Strong random secret for Vercel Cron | Optional | Local dev only |

### Supabase project settings

Supabase does **not** store your Next.js env vars. Configure these in the Supabase dashboard instead:

- **Project URL** and **API keys** — copy into Vercel / `.env.local`
- **Auth → URL Configuration** — Site URL and redirect allow-list (see [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md))
- **Auth → Email** — SMTP or Supabase mail for invitations
- **Storage** — `client-documents` bucket and policies (via migrations)

---

## Verification commands

| Command | Purpose |
|---------|---------|
| `npm run qa:env` | Required variable **names** present (no values printed) |
| `npm run deploy:check` | Pre-deploy gate: env, scripts, route inventory |
| `npm run deploy:config` | Production-style config review (URL shape, localhost warnings) |
| `npm run deploy:config -- --production` | Stricter localhost warnings for prod promotion |

---

## Warnings

1. **Do not deploy with real client data** until legal, compliance, and security review is complete.
2. **Never commit** `.env.local`, `.env.production`, or any file containing live keys.
3. **Service role key** grants full database access — restrict to server runtime only.
4. Use a **separate Supabase project** per environment (dev / staging / prod) when possible.
