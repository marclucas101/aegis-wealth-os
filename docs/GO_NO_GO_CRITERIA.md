# Go / No-Go Criteria — Phase 4Z

**Date:** 2026-06-10  
**Purpose:** Decision gates for demo, private beta, and real production launch.

**Related:** [Final Beta Launch Checklist](./FINAL_BETA_LAUNCH_CHECKLIST.md) · [Beta Limitations & Risks](./BETA_LIMITATIONS_AND_RISKS.md) · [Launch Day Runbook](./LAUNCH_DAY_RUNBOOK.md)

---

## Severity levels for blockers

| Level | Definition | Action |
|-------|------------|--------|
| **P0 — Critical** | Data breach risk, auth bypass, RLS bypass, secret exposure, data loss without recovery | **No-go** — fix before any external audience |
| **P1 — High** | Role escalation, cross-tenant data access, broken auth for a role, deploy/build failure | **No-go** for beta; demo only if isolated workaround documented |
| **P2 — Medium** | Degraded UX, missing audit on non-critical path, rate-limit gaps on low-risk routes | **Go with documented risk** for demo/beta; fix before production |
| **P3 — Low** | Copy polish, non-blocking UI flash, doc gaps | **Go** — track in post-beta roadmap |

---

## Demo go / no-go

**Audience:** Internal stakeholders, prospects, partners — fictional data only.

### Go criteria (all required)

| # | Criterion |
|---|-----------|
| 1 | `npm run final:check` passes |
| 2 | `npm run qa:env`, `deploy:check`, `ops:check`, `security:audit` pass |
| 3 | `npm run build` and `npx tsc --noEmit` pass |
| 4 | `npm run qa:smoke` passes (local or staging) |
| 5 | All Supabase migrations applied, including `202606100014_fix_users_role_self_escalation.sql` |
| 6 | `npm run demo:seed` completed on demo database |
| 7 | [Final Demo Checklist](./FINAL_DEMO_CHECKLIST.md) walkthrough rehearsed |
| 8 | Legal pages load with draft-template warnings (lawyer review **not** required for demo) |
| 9 | No P0 or P1 open security findings |

### No-go triggers

- Any P0 or P1 security finding open
- Build or typecheck failure
- Demo seed fails or uses real client PII
- Auth broken for any demo role (client / advisor / admin)
- Service role key visible in browser bundle

### Accepted risks for demo

- Draft legal templates (not lawyer-approved)
- Browser-print PDF only
- Demo document metadata only (no real Storage files)
- In-memory rate limits
- No external monitoring SaaS
- No formal consent database

---

## Private beta go / no-go

**Audience:** Trusted pilot users — limited real or synthetic data under controlled terms.

### Go criteria (all required)

| # | Criterion |
|---|-----------|
| 1 | All **demo go** criteria met |
| 2 | Staging or dedicated beta environment deployed per [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) |
| 3 | `BASE_URL=<staging> npm run qa:smoke` passes post-deploy |
| 4 | [Post-Deployment QA](./POST_DEPLOYMENT_QA.md) complete |
| 5 | [Final Security Checklist](./FINAL_SECURITY_CHECKLIST.md) signed off |
| 6 | C-1 RLS fix verified — [Security Test Plan §12](./SECURITY_TEST_PLAN.md) |
| 7 | Backup and incident runbooks reviewed; on-call owner named |
| 8 | Pilot users informed of [Beta Limitations](./BETA_LIMITATIONS_AND_RISKS.md) |
| 9 | `demo:seed` **not** run on beta DB if it contains pilot user data |
| 10 | No P0 findings; P1 findings have owner and target fix date |

### No-go triggers

- P0 finding open
- Unpatched role escalation or cross-client data access
- No rollback plan or backup strategy
- Production env used for beta without isolation
- Real client data without pilot consent language shown in product

### Accepted risks for private beta

All demo-accepted risks, plus explicit acknowledgment of:

- Service-role key compromise = full DB access ([Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md))
- Per-process rate limits under multi-instance deploy
- Middleware does not enforce page-level advisor/admin roles (API enforces 403)
- `clients` column-level RLS gap (M-3 in security audit) — API-scoped mitigation
- No OCR / document classification
- No multi-advisor team model

---

## Real production go / no-go

**Audience:** Commercial operation with real client data and regulatory exposure.

### Go criteria (all required)

| # | Criterion |
|---|-----------|
| 1 | All **private beta go** criteria met on production environment |
| 2 | **Qualified legal counsel** review of terms, privacy, disclaimer, consent copy |
| 3 | Formal consent records persisted (not localStorage-only) |
| 4 | External monitoring and alerting (Sentry, Axiom, or equivalent) |
| 5 | Redis / Upstash (or edge) rate limiting for multi-instance |
| 6 | Server-side PDF generation or secure PDF storage strategy |
| 7 | RLS regression test suite in CI |
| 8 | Stronger automated test coverage (integration + role matrix) |
| 9 | Service role usage audit and key rotation procedure exercised |
| 10 | Restore drill completed per [Backup & Recovery](./BACKUP_AND_RECOVERY.md) |
| 11 | No open P0 or P1 findings |
| 12 | MAS / regulatory applicability assessed with counsel |

### No-go triggers

- Any P0 or P1 open without compensating control
- Lawyer has not reviewed legal pages
- No consent audit trail for document uploads
- Direct real-client use recommended by product team without above gates
- In-memory-only rate limits on horizontally scaled production

---

## Decision record template

| Field | Value |
|-------|-------|
| Gate | Demo / Private beta / Production |
| Date | |
| Decision | **Go** / **No-go** / **Go with risks** |
| Approver | |
| Open P0/P1 items | |
| Accepted risks (link) | [BETA_LIMITATIONS_AND_RISKS.md](./BETA_LIMITATIONS_AND_RISKS.md) |
| Next review date | |

---

## Quick reference

```
Demo:         final:check + security:audit + demo:seed + demo walkthrough
Private beta: + staging deploy + post-deploy QA + pilot risk disclosure
Production:   + lawyer review + consent DB + monitoring + Redis limits + PDF strategy
```
