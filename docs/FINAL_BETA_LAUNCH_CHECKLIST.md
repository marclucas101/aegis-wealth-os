# Final Beta Launch Checklist — Phase 4Z

**Date:** 2026-06-10  
**Purpose:** Single execution plan for demo readiness, private-beta readiness, and launch-day validation.

**Package docs:**

- [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md)
- [Launch Day Runbook](./LAUNCH_DAY_RUNBOOK.md)
- [Beta Limitations & Risks](./BETA_LIMITATIONS_AND_RISKS.md)
- [Beta Roadmap After Launch](./BETA_ROADMAP_AFTER_LAUNCH.md)
- [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md)
- [Final Security Checklist](./FINAL_SECURITY_CHECKLIST.md)

**Upstream references:**

- [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Demo Environment](./DEMO_ENVIRONMENT.md)
- [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md)
- [Post-Deployment QA](./POST_DEPLOYMENT_QA.md)
- [Operations Runbook](./OPERATIONS_RUNBOOK.md)

---

## Gate summary

| Gate | When | Primary doc |
|------|------|-------------|
| **Demo** | Sales / stakeholder walkthrough | [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) |
| **Private beta** | Trusted pilot users on staging | This doc + [Go / No-Go](./GO_NO_GO_CRITERIA.md) |
| **Real production** | Live client data, commercial use | [Go / No-Go — Production](./GO_NO_GO_CRITERIA.md) |

> **Warning:** Do not deploy with real client data until legal counsel review, formal consent records, and production-grade monitoring are complete. See [Beta Limitations & Risks](./BETA_LIMITATIONS_AND_RISKS.md).

---

## 1. Required commands

Run in order locally or in CI before demo / private beta:

```bash
# Structural gate (docs, scripts, npm scripts — no secrets printed)
npm run final:check

# Environment and deploy gates
npm run qa:env
npm run deploy:check
npm run deploy:config -- --production

# Operations and security
npm run ops:check
npm run security:audit

# Build and type safety
npm run lint
npx tsc --noEmit
npm run build

# API smoke (dev server must be running on BASE_URL, default http://localhost:3000)
npm run dev
# separate terminal:
npm run qa:smoke

# Demo data (dev/staging only — never production with real clients)
npm run demo:seed
npx tsx scripts/demo-login-guide.ts
```

After deploy to staging/production:

```bash
BASE_URL=https://<your-deployed-url> npm run qa:smoke
```

| Command | Purpose |
|---------|---------|
| `npm run final:check` | Phase 4Z structural readiness |
| `npm run qa:env` | Required env var names present |
| `npm run qa:routes` | API route inventory scan |
| `npm run qa:smoke` | Unauthenticated API smoke tests |
| `npm run deploy:check` | Pre-deploy env + route gate |
| `npm run deploy:config` | Production URL / localhost warnings |
| `npm run ops:check` | Ops docs + health routes |
| `npm run security:audit` | Service-role + API auth scans |
| `npm run demo:seed` | Fictional demo personas |
| `npm run demo:clear -- --confirm` | Reset `@aegis-demo.local` data |

---

## 2. Environment checks

- [ ] `.env.example` documents all required variable names
- [ ] `.env.local` (local) or host env (Vercel) configured — **not committed**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set and reachable
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set (safe in browser bundle)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-only — **never** `NEXT_PUBLIC_`)
- [ ] `npm run qa:env` passes
- [ ] Supabase project matches intended tier (dev / staging / prod)
- [ ] Auth redirect URLs include `/auth/callback` for each deployed origin
- [ ] Optional `BASE_URL` set for post-deploy smoke tests

---

## 3. Build / typecheck

- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] `npm run start` serves core routes without console errors
- [ ] Service role key not present in client bundle (Vercel build / browser devtools spot check)

---

## 4. QA smoke tests

- [ ] [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md) reviewed
- [ ] Dev server running; `npm run qa:smoke` passes locally
- [ ] After deploy: `BASE_URL=<url> npm run qa:smoke` passes
- [ ] Unauthenticated protected routes return **401** or **403**, not **500**
- [ ] [Post-Deployment QA](./POST_DEPLOYMENT_QA.md) completed on target environment

---

## 5. Security audit

- [ ] `npm run security:audit` passes (review WARN items)
- [ ] `npm run security:service-role` — no critical import violations
- [ ] `npm run security:api` — auth / rate-limit flags reviewed
- [ ] [Final Security Checklist](./FINAL_SECURITY_CHECKLIST.md) complete
- [ ] [Security Audit Report](./SECURITY_AUDIT_REPORT.md) sign-off
- [ ] Migration `202606100014_fix_users_role_self_escalation.sql` applied (C-1 fix)
- [ ] Manual cases in [Security Test Plan](./SECURITY_TEST_PLAN.md) spot-checked

---

## 6. Supabase migration status

- [ ] All 14 migrations in `supabase/migrations/` applied to target database
- [ ] RLS enabled — `202606100009_rls_policies.sql`
- [ ] Storage policies — `202606100010_storage_policies.sql`
- [ ] Audit logs — `202606100011_audit_logs.sql`
- [ ] Advisor tasks — `202606100013_advisor_tasks.sql`
- [ ] **Role escalation fix** — `202606100014_fix_users_role_self_escalation.sql`
- [ ] Schema matches [database schema](./database-schema.md)
- [ ] Storage bucket `client-documents` exists with policies applied

---

## 7. Demo data seed

- [ ] Target database is **dev or staging** — not production with real clients
- [ ] `npm run demo:seed` completes without error
- [ ] `npx tsx scripts/demo-login-guide.ts` prints expected accounts
- [ ] Demo seed is **not** wired to deploy hooks or `npm run build`
- [ ] `npm run demo:clear -- --confirm` tested if reset needed
- [ ] [Demo Environment](./DEMO_ENVIRONMENT.md) and [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) reviewed

---

## 8. Advisor / admin / client login checks

### Client

- [ ] Signup / login establishes session; `/api/me` returns `authenticated: true`
- [ ] Unauthenticated users redirected to `/login?next=…`
- [ ] `alex.tan@aegis-demo.local` — dashboard, Discover, roadmap, reports load
- [ ] `sam.wei@aegis-demo.local` — onboarding / incomplete state visible

### Advisor

- [ ] `advisor@aegis-demo.local` accesses `/advisor` dashboard
- [ ] Assigned clients visible; unassigned client returns **403**
- [ ] Client workspace: notes, tasks, review pipeline, file quality
- [ ] Non-advisor client user receives **403** on advisor API routes

### Admin

- [ ] `admin@aegis-demo.local` accesses `/admin` dashboard
- [ ] User list and role update work
- [ ] Client assignment / invitation flows work
- [ ] Non-admin receives **403** on admin API routes

---

## 9. Document upload checks

- [ ] Client vault: upload, list, open (signed URL), archive/delete
- [ ] Advisor documents: upload, signed URL, delete on assigned client
- [ ] Upload rejects files over 10 MB
- [ ] Upload rejects disallowed extensions / MIME mismatch
- [ ] Signed URLs expire (~120s)
- [ ] Demo vault entries are **metadata placeholders** — no real files required for demo

---

## 10. Report print / export checks

- [ ] `/wealth-blueprint` → Export / Print → `/wealth-blueprint/print`
- [ ] `/annual-review` → Export / Print → `/annual-review/print`
- [ ] Browser Print / Save PDF produces clean output
- [ ] Advisor print routes enforce advisor auth
- [ ] `ReportDisclaimer` block visible in print preview
- [ ] No server-side PDF generation expected in beta

---

## 11. Legal notice checks

- [ ] `/legal/terms`, `/legal/privacy`, `/legal/disclaimer`, `/legal/consent` load with draft-template warning
- [ ] Consent banner appears on first visit; dismiss persists
- [ ] Footer and dashboard trust notice link to legal pages
- [ ] Document vault shows upload consent language
- [ ] Wealth Blueprint and Annual Review show on-screen disclaimers
- [ ] [Legal & Compliance Notes](./LEGAL_COMPLIANCE_NOTES.md) reviewed
- [ ] **Lawyer review not required for demo** — required before commercial / real-client production

---

## 12. Monitoring / health checks

- [ ] `GET /api/health/app` returns `ok: true`
- [ ] `GET /api/health/supabase` returns `ok: true` when DB healthy
- [ ] Production health payload is minimal (no internal diagnostics)
- [ ] `npm run ops:check` passes
- [ ] [Monitoring & Logging](./MONITORING_AND_LOGGING.md) — log review process understood
- [ ] [Incident Response](./INCIDENT_RESPONSE.md) — on-call owner assigned
- [ ] [Backup & Recovery](./BACKUP_AND_RECOVERY.md) — RPO/RTO documented
- [ ] External monitoring SaaS **deferred** — accepted for beta

---

## 13. Deployment checks

- [ ] [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) phases A–E complete
- [ ] [Vercel + Supabase Deployment](./DEPLOYMENT_VERCEL_SUPABASE.md) followed
- [ ] [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md) complete
- [ ] Vercel env vars set for Production and Preview scopes
- [ ] `SUPABASE_SERVICE_ROLE_KEY` marked sensitive on Vercel
- [ ] Rollback procedure documented — [Launch Day Runbook](./LAUNCH_DAY_RUNBOOK.md)
- [ ] In-memory rate limiting limitation acknowledged

---

## Demo vs private beta vs production

| Item | Demo | Private beta | Real production |
|------|------|--------------|-----------------|
| `final:check` + automated gates | Required | Required | Required |
| `demo:seed` | Required | Optional | **Never** |
| Real client PII | No | Limited pilot only | After legal + consent |
| Lawyer-approved legal text | No | Recommended | **Required** |
| External monitoring | No | Recommended | **Required** |
| Redis rate limiting | No | Accept risk | **Required** at scale |
| Formal consent DB | No | Accept risk | **Required** |

See [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md) for blocker severity and sign-off.

---

## Sign-off

| Area | Owner | Date | Demo ☐ | Beta ☐ |
|------|-------|------|--------|--------|
| Automated gates | | | ☐ | ☐ |
| Security & RLS | | | ☐ | ☐ |
| Demo walkthrough | | | ☐ | ☐ |
| Deploy / ops | | | ☐ | ☐ |
| Legal (draft OK for demo) | | | ☐ | ☐ |
| Accepted beta risks | | | ☐ | ☐ |
