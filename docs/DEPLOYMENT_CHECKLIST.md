# Deployment Checklist — Phase 4S

**Date:** 2026-06-10  
**Purpose:** Ordered checklist for first Vercel + Supabase production-style deployment.

**Guides:** [Vercel + Supabase Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md) · [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) · [Environment Variables](./ENVIRONMENT_VARIABLES.md) · [Post-Deployment QA](./POST_DEPLOYMENT_QA.md)

---

> **Warning:** Do not deploy with real client data until legal, compliance, and security review is complete.

---

## Phase A — Local and repo readiness

- [ ] `.env.example` documents all required variable names
- [ ] `.env.local` configured locally (not committed)
- [ ] `npm run qa:env` passes
- [ ] `npm run deploy:check` passes
- [ ] `npm run deploy:config -- --production` passes (or warnings reviewed)
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] `npm run qa:routes` reviewed — no unexpected auth/rate-limit gaps
- [ ] [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md) sections 1–12 reviewed

---

## Phase B — Supabase production project

- [ ] Production (or staging) Supabase project created
- [ ] Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Service role key → `SUPABASE_SERVICE_ROLE_KEY` (server only)
- [ ] All migrations applied (`npx supabase db push` or dashboard)
- [ ] RLS enabled — `202606100009_rls_policies.sql`
- [ ] Storage bucket `client-documents` + policies — `202606100010_storage_policies.sql`
- [ ] Auth redirect URLs configured (local, preview, production) — see [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md)
- [ ] Email / invitation settings tested in staging
- [ ] Backup strategy documented (Postgres + storage)

---

## Phase C — Vercel project setup

- [ ] Repository pushed to GitHub
- [ ] Project imported into Vercel
- [ ] Framework preset: **Next.js**
- [ ] Environment variables set for Production scope
- [ ] Environment variables set for Preview scope (staging keys recommended)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` marked sensitive — **no** `NEXT_PUBLIC_` prefix
- [ ] Optional `BASE_URL` set for production smoke tests

---

## Phase D — Deploy and validate build

- [ ] Trigger deployment (push or manual)
- [ ] Build logs: install + `next build` succeed
- [ ] No missing env var errors in build output
- [ ] Production URL accessible
- [ ] `GET /api/health/supabase` returns healthy response
- [ ] Complete [Post-Deployment QA](./POST_DEPLOYMENT_QA.md)
- [ ] `BASE_URL=https://<prod-url> npm run qa:smoke` passes

---

## Phase E — Security and operations sign-off

- [ ] [Security Test Plan](./SECURITY_TEST_PLAN.md) spot checks on staging/production
- [ ] Service role key not present in client bundle (Vercel build / browser devtools)
- [ ] Rate limiting limitation acknowledged — [in-memory, not multi-instance](./DEPLOYMENT_VERCEL_SUPABASE.md#rate-limiting-limitation)
- [ ] Monitoring plan for 5xx and auth failures
- [ ] Rollback procedure tested or documented
- [ ] Legal / compliance / security review complete **before real client data**

---

## Automation quick reference

| Command | When |
|---------|------|
| `npm run deploy:check` | Before every deploy |
| `npm run deploy:config` | After setting Vercel env vars |
| `npm run deploy:config -- --production` | Before production promotion |
| `npm run qa:smoke` | After deploy (set `BASE_URL`) |

---

## Sign-off

| Step | Owner | Date | Pass |
|------|-------|------|------|
| A — Local readiness | | | ☐ |
| B — Supabase | | | ☐ |
| C — Vercel config | | | ☐ |
| D — Deploy + QA | | | ☐ |
| E — Security sign-off | | | ☐ |
