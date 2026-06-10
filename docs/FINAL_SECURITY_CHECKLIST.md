# Final Security Checklist — Phase 4Z

**Date:** 2026-06-10  
**Purpose:** Pre-demo and pre-private-beta security sign-off.

**Related:** [Security Audit Report](./SECURITY_AUDIT_REPORT.md) · [Security Test Plan](./SECURITY_TEST_PLAN.md) · [RLS Policy Review](./RLS_POLICY_REVIEW.md) · [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md)

---

## Automated gates

Run all commands — review output; no secrets are printed:

```bash
npm run security:audit
npm run security:service-role
npm run security:api
npm run qa:routes
```

| Check | Command | Pass criteria |
|-------|---------|---------------|
| Full security audit | `npm run security:audit` | Service-role + API scans exit 0 |
| Service role import scan | `npm run security:service-role` | No unsafe client-side imports |
| API guard scan | `npm run security:api` | Auth / rate-limit flags reviewed |
| Route inventory | `npm run qa:routes` | No unexpected unauthenticated data routes |

- [ ] All automated gates pass
- [ ] WARN items in [API Security Review](./API_SECURITY_REVIEW.md) reviewed and accepted or scheduled

---

## Service role import scan

- [ ] `lib/supabase/admin.ts` has `import "server-only"`
- [ ] `npm run security:service-role` reports no critical violations
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **not** prefixed with `NEXT_PUBLIC_`
- [ ] Vercel env marks service role as sensitive
- [ ] [Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md) read by engineering lead

**Accepted risk for beta:** Service role bypasses RLS — key rotation procedure documented in [Incident Response](./INCIDENT_RESPONSE.md).

---

## API guard scan

- [ ] Every data route uses `ensureUserClientProfile`, `requireAdvisorAccess`, or `requireAdminAccess`
- [ ] Public surface limited to health probes
- [ ] `rejectClientIdInBody` / `rejectUnexpectedFields` on privileged client routes
- [ ] Advisor routes use `resolveAccessibleClient()` for assignment checks
- [ ] Error responses sanitized via `toPublicErrorMessage()`
- [ ] [API Route Inventory](./API_ROUTE_INVENTORY.md) matches deployed handlers

Manual spot checks:

- [ ] Unauthenticated `GET /api/me` → 401
- [ ] Client calling advisor route → 403
- [ ] Unassigned advisor on another's client → 403

---

## RLS role escalation fix applied

**Critical finding C-1 — fixed in Phase 4X.1**

- [ ] Migration `202606100014_fix_users_role_self_escalation.sql` applied on target database
- [ ] Column-level grants prevent direct `role` update via browser client
- [ ] Policy `users_update_own_profile` with `users_protected_fields_unchanged()`
- [ ] Trigger `enforce_users_self_update_safety()` active
- [ ] Manual test per [Security Test Plan §12](./SECURITY_TEST_PLAN.md):

```sql
-- As authenticated non-admin: attempt role self-update — must fail
UPDATE public.users SET role = 'admin' WHERE id = auth.uid();
-- Expected: permission denied or trigger rejection
```

- [ ] [RLS Policy Review](./RLS_POLICY_REVIEW.md) C-1 marked fixed

---

## Health endpoint reviewed

- [ ] `GET /api/health/app` — version, environment, uptime; rate-limited
- [ ] `GET /api/health/supabase` — production mode omits raw DB errors
- [ ] Health routes documented in [Monitoring & Logging](./MONITORING_AND_LOGGING.md)
- [ ] **Accepted for beta:** `/api/health/supabase` uses service role (M-1) — IP rate limit + minimal production payload
- [ ] Consider restricting health routes in production (IP allowlist) — post-beta

---

## Rate limits documented

- [ ] Write-heavy routes return **429** after burst (manual dev spot check)
- [ ] Health endpoint rate-limited per IP
- [ ] Command-center routes use lighter read bucket
- [ ] Limitation documented: in-memory, per-process — see [Beta Limitations](./BETA_LIMITATIONS_AND_RISKS.md)
- [ ] Production scale requires Redis/Upstash — tracked in [Beta Roadmap](./BETA_ROADMAP_AFTER_LAUNCH.md)

---

## Legal disclaimers visible

Security-adjacent compliance surface:

- [ ] `/legal/terms`, `/legal/privacy`, `/legal/disclaimer`, `/legal/consent` load
- [ ] Draft-template warning banner on all legal pages
- [ ] Consent banner on first site visit
- [ ] Dashboard trust notice links to legal pages
- [ ] Report and document-upload disclaimers visible
- [ ] **Beta acceptance:** Draft copy — lawyer review required before production

---

## Audit and storage

- [ ] RLS enabled on all public tables (`202606100009`)
- [ ] Storage policies on `client-documents` bucket (`202606100010`)
- [ ] Audit logs migration applied (`202606100011`)
- [ ] Major writes emit `audit_logs` rows (spot-check after test session)
- [ ] [Storage Policy Review](./STORAGE_POLICY_REVIEW.md) reviewed
- [ ] [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md) manual cases complete

---

## Open findings (beta acceptance)

| ID | Severity | Status for beta |
|----|----------|-----------------|
| C-1 | Critical | **Fixed** — verify migration 014 |
| H-1 | High | Accepted — key hygiene + rotation |
| H-2 | High | Accepted — Redis planned |
| H-3 | High | Accepted — API enforces 403 |
| M-1 – M-5 | Medium | Accepted — see audit report |

No open **P0** findings allowed for demo or private beta go.

---

## Sign-off

| Area | Reviewer | Date | Pass |
|------|----------|------|------|
| Automated scans | | | ☐ |
| RLS fix (014) | | | ☐ |
| API / advisor scoping | | | ☐ |
| Health + rate limits | | | ☐ |
| Legal disclaimers (draft OK) | | | ☐ |
| Accepted beta risks | | | ☐ |

**Primary report:** [SECURITY_AUDIT_REPORT.md](./SECURITY_AUDIT_REPORT.md)
