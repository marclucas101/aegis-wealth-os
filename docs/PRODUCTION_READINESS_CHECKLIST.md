# Production Readiness Checklist — Phase 4R / 4S

**Date:** 2026-06-10  
**Purpose:** Pre-deploy gate for Aegis Wealth OS. Complete before production traffic or major releases.

**Related docs:** [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md) · [Security Test Plan](./SECURITY_TEST_PLAN.md) · [API Route Inventory](./API_ROUTE_INVENTORY.md) · [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) · [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md)

**Security audit (Phase 4X):** [Security Audit Report](./SECURITY_AUDIT_REPORT.md) · [RLS Policy Review](./RLS_POLICY_REVIEW.md) · [Storage Policy Review](./STORAGE_POLICY_REVIEW.md) · [Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md) · [API Security Review](./API_SECURITY_REVIEW.md) · [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md)

**Deployment (Phase 4S):** [Vercel + Supabase Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md) · [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) · [Environment Variables](./ENVIRONMENT_VARIABLES.md) · [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) · [Post-Deployment QA](./POST_DEPLOYMENT_QA.md)

**Operations (Phase 4W):** [Operations Runbook](./OPERATIONS_RUNBOOK.md) · [Monitoring & Logging](./MONITORING_AND_LOGGING.md) · [Backup & Recovery](./BACKUP_AND_RECOVERY.md) · [Incident Response](./INCIDENT_RESPONSE.md) · [Audit Log Review](./AUDIT_LOG_REVIEW.md)

**Demo environment (Phase 4Y):** [Demo Environment](./DEMO_ENVIRONMENT.md) · [Demo Script](./DEMO_SCRIPT.md) · [Seeding and Reset](./SEEDING_AND_RESET.md)

**Final launch (Phase 4Z):** [Final Beta Launch Checklist](./FINAL_BETA_LAUNCH_CHECKLIST.md) · [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md) · [Launch Day Runbook](./LAUNCH_DAY_RUNBOOK.md) · [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) · [Final Security Checklist](./FINAL_SECURITY_CHECKLIST.md) · [Beta Limitations & Risks](./BETA_LIMITATIONS_AND_RISKS.md) · `npm run final:check`

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
- [ ] `GET /api/health/app` returns `ok: true` (runtime probe)
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
- [ ] Run `npm run security:audit` — no critical service-role findings; review WARN items
- [ ] Complete [Security Audit Report](./SECURITY_AUDIT_REPORT.md) sign-off checklist
- [ ] Confirm [RLS Policy Review](./RLS_POLICY_REVIEW.md) C-1 fix applied — migration `202606100014_fix_users_role_self_escalation.sql`
- [ ] Run manual tests in [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md)
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
- [ ] [Backup & Recovery](./BACKUP_AND_RECOVERY.md) reviewed — RPO/RTO documented, restore drill scheduled
- [ ] [Monitoring & Logging](./MONITORING_AND_LOGGING.md) — structured logging and health endpoints understood
- [ ] [Incident Response](./INCIDENT_RESPONSE.md) — on-call owner and severity table agreed
- [ ] [Audit Log Review](./AUDIT_LOG_REVIEW.md) — weekly review cadence assigned
- [ ] `npm run ops:check` passes
- [ ] Monitoring for 5xx rates and audit log failures (Vercel + Supabase logs)
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
| `npm run ops:check` | Ops docs, health routes, env names (no credentials) |
| `npm run security:audit` | Phase 4X: service-role scan + API auth patterns + doc check |
| `npm run security:api` | API route auth / rate-limit / audit flags |
| `npm run security:service-role` | Unsafe service-role import detection |
| `npm run final:check` | Phase 4Z structural launch readiness (docs + scripts) |

---

## 15. Operations & Monitoring (Phase 4W)

Before private beta / demo with operational confidence:

- [ ] `lib/ops/logger.ts` — team knows JSON logs go to Vercel stdout; secrets redacted
- [ ] `lib/ops/errorReporting.ts` — `captureServerError` pattern for future API adoption
- [ ] `GET /api/health/app` — returns version, environment, uptime; rate-limited
- [ ] `GET /api/health/supabase` — production mode omits raw DB errors
- [ ] [Operations Runbook](./OPERATIONS_RUNBOOK.md) — upload/auth/500/429 playbooks reviewed
- [ ] [Backup & Recovery](./BACKUP_AND_RECOVERY.md) — Supabase backups + storage strategy documented
- [ ] [Incident Response](./INCIDENT_RESPONSE.md) — first 15 minutes and security checklist read
- [ ] [Audit Log Review](./AUDIT_LOG_REVIEW.md) — sample SQL queries run in staging
- [ ] External error tracking (Sentry/Axiom/Logtail) **deferred** — placeholders only in Phase 4W
- [ ] `npm run ops:check` passes in CI or pre-deploy script

---

## 12. Client Portal UX (Phase 4T)

Before beta/demo, verify client-facing polish (no scoring or API changes):

- [ ] `/dashboard` — welcome header, journey progress, next best action, module cards, trust notice
- [ ] `/discover` — guided copy, progress indicator, save-state feedback, “what happens next” summary
- [ ] `/shield-diagnostic` — plain-language diagnostic explainer, pillar cards, Roadmap CTA
- [ ] `/roadmap` — client-friendly milestone labels, status labels, empty state
- [ ] `/stress-testing` — plain scenario descriptions, severity selector copy, impact explanation
- [ ] `/wealth-blueprint` — report sections, planning-support disclaimer
- [ ] `/annual-review` — “what changed / what to review next” highlights
- [ ] `/document-vault` — upload guidance, category help, security notice, empty state
- [ ] Mobile spot-check on dashboard, Discover wizard, and document upload
- [ ] Confirm advisor/admin routes unchanged

---

## 13. Legal & Compliance (Phase 4V)

Before beta/demo with sensitive data, verify the MVP legal layer:

- [ ] `/legal/terms`, `/legal/privacy`, `/legal/disclaimer`, `/legal/consent` load and show draft-template warning
- [ ] Consent banner appears on first visit; dismiss persists via localStorage
- [ ] Home page footer links to all legal pages
- [ ] Dashboard trust notice includes disclaimer / privacy / consent links
- [ ] Document vault upload shows document-upload consent language
- [ ] Wealth Blueprint and Annual Review show on-screen disclaimer blocks
- [ ] Print exports include `ReportDisclaimer` block
- [ ] Review [Legal & Compliance Notes](./LEGAL_COMPLIANCE_NOTES.md)
- [ ] **Qualified lawyer review complete** before commercial use or real client data

---

## 14. Report Export / Print (Phase 4U)

Before client-ready report packaging sign-off:

- [ ] `/wealth-blueprint` — **Export / Print Report** opens `/wealth-blueprint/print`
- [ ] `/annual-review` — **Export / Print Review** opens `/annual-review/print`
- [ ] Print pages show cover, scores, pillars, stress, roadmap, disclaimer
- [ ] Browser **Print / Save PDF** produces clean white-background output
- [ ] Print toolbar and navigation hidden in print preview
- [ ] Advisor report modal — **Export / Print** opens advisor print route in new tab
- [ ] `/advisor/clients/[clientId]/reports/wealth-blueprints/[id]/print` — advisor auth enforced
- [ ] `/advisor/clients/[clientId]/reports/annual-reviews/[id]/print` — advisor auth enforced
- [ ] Empty states when no profile / snapshot data
- [ ] No server-side PDF generation or Supabase PDF storage in this phase

---

## 13. Demo environment (optional — dev/staging only)

- [ ] `npm run demo:seed` completes without error on target demo database
- [ ] Demo logins documented in [Demo Environment](./DEMO_ENVIRONMENT.md)
- [ ] `npm run demo:clear -- --confirm` removes only `@aegis-demo.local` data
- [ ] Demo seed is **not** wired to deploy hooks or production startup
- [ ] No real client PII used in demo personas

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
