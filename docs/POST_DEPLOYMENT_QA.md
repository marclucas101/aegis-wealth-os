# Post-Deployment QA — Phase 4S

**Date:** 2026-06-10  
**Purpose:** Verify a Vercel deployment against Supabase immediately after first deploy or promotion.

**Related:** [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md) · [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) · [Role Access Matrix](./ROLE_ACCESS_MATRIX.md)

---

## Prerequisites

- Deployment URL (production or preview)
- Test accounts in Supabase (`client`, `advisor`, `admin` roles)
- Env vars configured on Vercel
- Migrations applied to the connected Supabase project

Set smoke test target:

```bash
BASE_URL=https://<your-deployed-url> npm run qa:smoke
```

---

## Automated checks (no login)

| # | Check | Command / URL | Expected |
|---|-------|---------------|----------|
| P1 | API smoke suite | `BASE_URL=... npm run qa:smoke` | All cases pass |
| P2 | Health probe | `GET /api/health/supabase` | `ok: true` or 503 (misconfig); never 500 |
| P3 | Unauthenticated `/api/me` | `GET /api/me` | `authenticated: false` |

---

## Manual UI checks

Use the deployed URL for all steps. Record pass/fail per environment.

### Core pages and auth

| # | Check | Expected |
|---|-------|----------|
| M1 | Home page loads | No blank screen or unhandled error |
| M2 | Login page loads | `/login` renders |
| M3 | Signup page loads | `/signup` renders |
| M4 | Login with test client | Redirects to `/dashboard` |
| M5 | Auth callback | Magic link / invite completes via `/auth/callback` without error loop |
| M6 | Protected route gate | Logged-out visit to `/dashboard` → `/login?next=...` |

### Client portal

| # | Check | Expected |
|---|-------|----------|
| M7 | Client dashboard loads | `/dashboard` shows data or empty state |
| M8 | Discover save works | Profile persists; scoring chain runs |
| M9 | Document upload works | Upload to vault; list and signed URL open |
| M10 | Document vault page | `/document-vault` loads for client |

### Advisor OS

| # | Check | Expected |
|---|-------|----------|
| M11 | Advisor dashboard loads | `/advisor` for advisor role |
| M12 | Advisor client workspace | Assigned client workspace loads |
| M13 | Non-advisor blocked | Client user cannot access advisor APIs (403) |

### Admin console

| # | Check | Expected |
|---|-------|----------|
| M14 | Admin dashboard loads | `/admin` for admin role |
| M15 | Non-admin blocked | Client/advisor users get 403 on admin APIs |

---

## Role-based spot checks

Prepare accounts per [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md#prerequisites):

| Role | Login | Must access | Must not access |
|------|-------|-------------|-----------------|
| `client` | ✓ | `/dashboard`, `/discover`, `/document-vault` | `/advisor`, `/admin` APIs |
| `advisor` | ✓ | `/advisor`, assigned client workspace | Unassigned client routes |
| `admin` | ✓ | `/admin`, all advisor routes | — |

---

## Production smoke test command

After manual checks, re-run automated API smoke against production:

```bash
BASE_URL=https://<production-url> npm run qa:smoke
```

All unauthenticated checks should pass without 500 responses.

---

## Failure triage

| Symptom | Likely cause |
|---------|--------------|
| Health `ok: false` | Wrong Supabase URL/keys or migrations not applied |
| Auth callback error | Redirect URL not in Supabase allow-list |
| 401 on all API routes after login | Cookie domain / HTTPS mismatch; check Vercel URL vs Site URL |
| 403 on advisor routes | `public.users.role` or `clients.advisor_user_id` not set |
| Upload fails | `client-documents` bucket or storage policies missing |
| 429 bursts | Rate limiting active (expected); see in-memory limitation |

---

## Known limitations (document, do not treat as bugs)

1. **In-memory rate limiting** is per serverless instance — not global across Vercel scale-out. Plan Redis/KV before high-traffic production.
2. **Health endpoint** may expose extra diagnostics in non-production `VERCEL_ENV` — production mode returns minimal payload.
3. **Do not use production for real client data** until legal/compliance/security review is complete.

---

## Sign-off

| Area | Tester | Date | Pass |
|------|--------|------|------|
| Automated smoke | | | ☐ |
| Auth flows | | | ☐ |
| Client portal | | | ☐ |
| Advisor OS | | | ☐ |
| Admin console | | | ☐ |
