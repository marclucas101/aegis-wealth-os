# Production Readiness Checklist — Phase 4R / 4S

**Date:** 2026-06-10  
**Purpose:** Pre-deploy gate for Aegis Wealth OS. Complete before production traffic or major releases.

**Related docs:** [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md) · [Security Test Plan](./SECURITY_TEST_PLAN.md) · [API Route Inventory](./API_ROUTE_INVENTORY.md) · [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) · [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md)

**Deployment (Phase 4S):** [Vercel + Supabase Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md) · [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) · [Environment Variables](./ENVIRONMENT_VARIABLES.md) · [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) · [Post-Deployment QA](./POST_DEPLOYMENT_QA.md)

---

## 1. Environment Variables

- [ ] Copy `.env.example` → `.env.local` (local) or configure host env (Vercel/production)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set and reachable
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (public — safe in browser bundle)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-only — never in client bundle)
- [ ] Run `npm run qa:env` — all required vars reported OK
- [ ] Confirm service role key is **not** present in `next build` client chunks (grep build output / source maps if unsure)
- [ ] Optional: `BASE_URL` set for smoke tests against staging

---

## 2. Supabase Project Connection

- [ ] Supabase project matches intended environment (dev vs staging vs prod)
- [ ] Auth providers configured (email/password minimum)
- [ ] Redirect URLs include `/auth/callback` for each deployed origin
- [ ] `GET /api/health/supabase` returns `ok: true` when DB is healthy
- [ ] `/supabase-health` UI loads and shows connectivity (dev/staging only)
- [ ] Storage bucket `client-documents` exists and policies applied

---

## 3. Migrations Applied

- [ ] All migrations in `supabase/migrations/` applied to target database
- [ ] RLS enabled on public tables (`202606100009_rls_policies.sql`)
- [ ] Storage policies applied (`202606100010_storage_policies.sql`)
- [ ] Schema matches `docs/database-schema.md`
- [ ] No pending manual SQL outside migration history

---

## 4. Auth Flows

- [ ] Unauthenticated user redirected from protected pages to `/login?next=…`
- [ ] Signup creates auth user and provisions client profile on first API call
- [ ] Login establishes cookie session; `/api/me` returns `authenticated: true`
- [ ] Logged-in user visiting `/login` or `/signup` redirects to `/dashboard`
- [ ] `/auth/callback` handles magic link / OAuth without error loops
- [ ] Session refresh via middleware does not drop active sessions unexpectedly

---

## 5. Client Flows

- [ ] Discover save persists profile and triggers scoring chain
- [ ] Dashboard loads recomputed snapshot
- [ ] Shield, Roadmap, Stress, Blueprint, Annual Review pages load current data
- [ ] Roadmap status update persists
- [ ] Stress test run persists (mild/moderate/severe only)
- [ ] Blueprint and Annual Review save create snapshots
- [ ] Document vault: upload, list, open (signed URL), archive/delete
- [ ] All client API calls scoped to session client — no browser-supplied `client_id`

---

## 6. Advisor Flows

- [ ] Advisor role user can access `/advisor` dashboard
- [ ] Non-advisor client user receives 403 on advisor API routes
- [ ] Assigned advisor sees only assigned clients in overview / pipeline
- [ ] Admin-as-advisor can access any client workspace
- [ ] Unassigned advisor receives 403 on another advisor's client routes
- [ ] Notes: create, edit, delete
- [ ] Tasks: create, update; task suggestions → create task
- [ ] Review pipeline and review status update
- [ ] Advisor document upload, signed URL, delete on assigned client
- [ ] Client invitation flow (advisor scope)
- [ ] Command-center endpoints load consolidated data

---

## 7. Admin Flows

- [ ] Admin role user can access `/admin` dashboard
- [ ] Non-admin receives 403 on admin API routes
- [ ] User list loads; role update (client / advisor / admin) persists
- [ ] Client list loads; advisor assignment / unassignment works
- [ ] Placeholder client creation (admin scope)
- [ ] Client invitation flow (admin scope)

---

## 8. Document Storage

- [ ] Upload rejects files over 10 MB
- [ ] Upload rejects disallowed extensions / MIME mismatch
- [ ] Signed URLs expire (~120s) and cannot be reused indefinitely
- [ ] Delete/archive verifies ownership (client) or assignment (advisor)
- [ ] Storage objects match `documents` table metadata

---

## 9. API Security

- [ ] Unauthenticated protected routes return **401** or **403**, not **500**
- [ ] Run `npm run qa:smoke` with dev server — all checks pass
- [ ] Sensitive body fields rejected (`client_id`, `role`, `user_id`, etc.)
- [ ] Error responses sanitized — no raw DB errors in production
- [ ] Service role used only in server modules (`import "server-only"` where applicable)
- [ ] Review [Security Test Plan](./SECURITY_TEST_PLAN.md) manual cases

---

## 10. Rate Limiting

- [ ] Write-heavy routes return **429** after burst (manual spot check in dev)
- [ ] Health endpoint rate-limited per IP
- [ ] Command-center routes use lighter read bucket
- [ ] Document known limitation: in-memory limits are **per process** — upgrade to Redis/edge before multi-instance production

---

## 11. Audit Logs

- [ ] Major writes emit rows in `audit_logs` (discover save, documents, reports, advisor/admin mutations)
- [ ] Audit entries include `user_id`, `client_id` (when applicable), `action`, IP, user agent
- [ ] Audit insert failure does not break main request (check server logs for `[auditLog]` errors)
- [ ] Spot-check recent actions in Supabase dashboard after test session

---

## 12. Build & Typecheck

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes (no type errors)
- [ ] `npm run build` succeeds
- [ ] Production build starts with `npm run start` and serves core routes
- [ ] No console errors on landing, login, dashboard (smoke browse)

---

## 13. Deployment Readiness

> **Warning:** Do not deploy with real client data until legal, compliance, and security review is complete.

- [ ] Follow [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) phases A–E
- [ ] `npm run deploy:check` passes locally or in CI
- [ ] `npm run deploy:config -- --production` passes (or warnings reviewed)
- [ ] [Environment Variables](./ENVIRONMENT_VARIABLES.md) set on Vercel — service role **not** `NEXT_PUBLIC_`
- [ ] [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) complete (auth redirects, migrations, RLS, storage, backups)
- [ ] Production env vars configured on host (not committed to git)
- [ ] `NODE_ENV=production` health endpoint returns minimal payload (no internal diagnostics)
- [ ] Consider restricting `/api/health/supabase` and `/supabase-health` in production
- [ ] CDN / WAF / bot protection planned for public endpoints
- [ ] Backup drill for Postgres + `client-documents` bucket documented
- [ ] Monitoring for 5xx rates and audit log failures
- [ ] Rollback plan documented (see [Vercel + Supabase Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md#rollback))
- [ ] In-memory rate limiting limitation acknowledged — not multi-instance production-grade
- [ ] Run full [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md) on staging before promote
- [ ] Complete [Post-Deployment QA](./POST_DEPLOYMENT_QA.md) after first deploy

---

## Quick Automation

| Command | Purpose |
|---------|---------|
| `npm run qa:env` | Verify required env vars (no secrets printed) |
| `npm run qa:routes` | Scan API routes; flag missing rate limits |
| `npm run qa:smoke` | Unauthenticated API smoke tests (server must be running) |
| `npm run deploy:check` | Pre-deploy gate: env names, scripts, route inventory |
| `npm run deploy:config` | Production config review (URL shape, localhost warnings) |

---

## Sign-off

| Area | Owner | Date | Pass |
|------|-------|------|------|
| Environment & Supabase | | | ☐ |
| Client portal | | | ☐ |
| Advisor OS | | | ☐ |
| Admin console | | | ☐ |
| Security & API | | | ☐ |
| Build & deploy | | | ☐ |
