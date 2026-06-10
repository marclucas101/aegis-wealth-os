# Beta Limitations & Accepted Risks — Phase 4Z

**Date:** 2026-06-10  
**Status:** Accepted for demo and private beta — **not** for unrestricted real-client production.

**Related:** [Go / No-Go Criteria](./GO_NO_GO_CRITERIA.md) · [Beta Roadmap After Launch](./BETA_ROADMAP_AFTER_LAUNCH.md) · [Security Audit Report](./SECURITY_AUDIT_REPORT.md)

---

## Summary

Aegis Wealth OS is demo- and private-beta-ready with documented gaps. The product is **not production-grade** for commercial operation with real client data until items in [Beta Roadmap After Launch](./BETA_ROADMAP_AFTER_LAUNCH.md) are addressed.

---

## Accepted limitations

### 1. In-memory rate limits

- Rate limiting uses per-process in-memory buckets (`lib/security/rateLimit.ts`)
- **Risk:** Under horizontal scale (multiple Vercel instances), limits are not global — abuse can exceed intended thresholds
- **Mitigation today:** IP-based buckets on write-heavy routes; health endpoint rate-limited
- **Production requirement:** Redis / Upstash or edge rate limiting

### 2. Legal templates not lawyer-approved

- Terms, privacy, disclaimer, and consent pages are **draft templates** with visible warnings
- **Risk:** Copy may not meet regulatory or jurisdictional requirements (e.g. PDPA, MAS guidance)
- **Mitigation today:** Prominent draft banners; planning-support disclaimers on reports
- **Production requirement:** Qualified legal counsel review and approval

### 3. Browser-print PDF only

- Reports export via browser Print / Save PDF — no server-side PDF engine
- **Risk:** Layout varies by browser; no archived PDF artifact in database
- **Mitigation today:** Print-optimized CSS; `ReportDisclaimer` in print output
- **Production requirement:** Server-side PDF generation or secure storage pipeline

### 4. No formal consent database

- Site consent banner uses `localStorage` (`aegis-legal-notice-dismissed-v1`)
- Document upload shows on-screen consent language but does not persist consent records
- **Risk:** No auditable consent trail for regulators or disputes
- **Mitigation today:** In-product consent copy; advisor access summary
- **Production requirement:** Consent records table with version, timestamp, user/client linkage

### 5. No external monitoring SaaS

- Logging goes to Vercel stdout; `lib/ops/errorReporting.ts` is a placeholder pattern
- **Risk:** Delayed detection of 5xx spikes, auth anomalies, or audit failures
- **Mitigation today:** Health endpoints; manual Vercel + Supabase log review
- **Production requirement:** Sentry, Axiom, Logtail, or equivalent with alerting

### 6. No real PDF storage

- Wealth Blueprint and Annual Review are database snapshots, not stored PDF files
- **Risk:** Cannot deliver immutable document artifacts to clients or regulators
- **Mitigation today:** Print export; snapshot JSON in Supabase
- **Production requirement:** PDF generation + storage with retention policy

### 7. Demo document metadata only

- `npm run demo:seed` creates document **metadata** rows — no files uploaded to Storage
- **Risk:** Demo vault open/signed-URL flows need manual upload to fully exercise Storage
- **Mitigation today:** Document upload paths tested separately; demo narrative explains placeholders
- **Production requirement:** Real upload QA on staging with test files

### 8. No multi-advisor teams

- Single `advisor_user_id` per client; no firm / team / delegate model
- **Risk:** Cannot support multi-advisor practices or coverage during leave
- **Mitigation today:** Admin can reassign clients
- **Production requirement:** Team model, permissions, and RLS updates

### 9. No full automated test suite

- QA relies on `qa:smoke`, security scans, and manual [QA Smoke Test Plan](./QA_SMOKE_TEST_PLAN.md)
- **Risk:** Regressions in role matrix or RLS may slip through
- **Mitigation today:** `security:audit`, `qa:routes`, manual security test plan
- **Production requirement:** Integration tests, RLS regression tests in CI

### 10. Service-role risk

- `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS — used intentionally in server modules
- **Risk:** Key compromise = full database access
- **Mitigation today:** `import "server-only"` on admin client; Vercel sensitive env; import scan
- **Production requirement:** Key rotation drill, least-privilege review, anomaly detection on audit logs

### 11. Direct real-client use not recommended yet

- Product can technically onboard real users, but legal, consent, monitoring, and scale gaps remain
- **Risk:** Regulatory exposure, inadequate consent evidence, operational blind spots
- **Mitigation today:** Pilot-only private beta with disclosed limitations
- **Production requirement:** All [production go criteria](./GO_NO_GO_CRITERIA.md#real-production-go--no-go) met

---

## Additional documented risks (medium / low)

| ID | Risk | Beta acceptance |
|----|------|-----------------|
| H-3 | Middleware does not enforce advisor/admin roles on pages | API returns 403; acceptable for MVP |
| M-3 | `clients` UPDATE policy may allow column mutation via direct Supabase client | API-scoped; tighten RLS post-beta |
| M-4 | Signed-url routes lack dedicated rate limits | Low abuse risk given auth + ownership |
| M-5 | `/api/me` exposes own `clientId` | Intentional for UI |

See [Security Audit Report](./SECURITY_AUDIT_REPORT.md) for full findings table.

---

## What is production-grade today

- Supabase Auth with cookie sessions
- RLS on public tables with C-1 role-escalation fix (`202606100014`)
- API auth guards (`ensureUserClientProfile`, `requireAdvisorAccess`, `requireAdminAccess`)
- Advisor client scoping via `resolveAccessibleClient()`
- Audit logging on major writes (best-effort)
- Error sanitization on API routes
- Health endpoints with production payload reduction
- Ops runbooks, backup docs, incident response templates
- QA smoke suite and security automation

---

## Risk acceptance sign-off (beta)

| Limitation | Accepted for demo | Accepted for private beta | Owner | Review date |
|------------|-------------------|---------------------------|-------|-------------|
| In-memory rate limits | ☐ | ☐ | | |
| Draft legal text | ☐ | ☐ | | |
| Browser-print PDF | ☐ | ☐ | | |
| No consent DB | ☐ | ☐ | | |
| No external monitoring | ☐ | ☐ | | |
| Service-role risk | ☐ | ☐ | | |
| No real-client production | ☐ | ☐ | | |
