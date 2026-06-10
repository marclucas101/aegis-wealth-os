# Security Audit Report — Phase 4X

**Date:** 2026-06-10  
**Scope:** Pre-deployment / private-beta security and RLS review  
**Status:** Review complete — documentation and automated checks in place

**Related audits:**

- [RLS Policy Review](./RLS_POLICY_REVIEW.md)
- [Storage Policy Review](./STORAGE_POLICY_REVIEW.md)
- [Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md)
- [API Security Review](./API_SECURITY_REVIEW.md)
- [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md)
- [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md) (historical Phases 3–4R)
- [API Route Inventory](./API_ROUTE_INVENTORY.md)
- [Role Access Matrix](./ROLE_ACCESS_MATRIX.md)

**Automation:** `npm run security:audit` · `npm run security:api` · `npm run security:service-role`

---

## 1. Scope

| Area | Reviewed |
|------|----------|
| API route handlers | All 53 files under `app/api/**` |
| Supabase RLS | Migrations `202606100009_rls_policies.sql`, `202606100011_audit_logs.sql`, `202606100013_advisor_tasks.sql` |
| Storage policies | `202606100010_storage_policies.sql` |
| Service role | `lib/supabase/admin.ts`, all `createAdminSupabaseClient` call sites |
| Middleware | `middleware.ts`, `lib/supabase/middleware.ts` |
| Security helpers | `lib/security/apiGuards.ts`, `rateLimit.ts`, `requestValidation.ts` |
| Ops / health | `app/api/health/*`, `lib/ops/*` |

**Out of scope (per phase charter):** Scoring formulas, UI refactors, schema changes, new features.

---

## 2. Architecture Summary

```
Browser (anon key + cookie session)
    │
    ├─► middleware.ts — session refresh; page auth gate (not role-based)
    │
    ├─► Client Components — lib/supabase/client.ts (RLS-enforced anon client)
    │
    └─► API Route Handlers
            ├─► ensureUserClientProfile()     — client portal (session client_id)
            ├─► requireAdvisorAccess()        — advisor + admin
            ├─► requireAdminAccess()          — admin only
            └─► Persistence (lib/supabase/*)  — createAdminSupabaseClient() + explicit checks
```

**Defense layers:** Handler auth → server-derived `client_id` → `resolveAccessibleClient()` for advisor routes → RLS for direct Supabase access → audit logging on writes.

---

## 3. Strengths

1. **Consistent API auth patterns** — Every data route uses `ensureUserClientProfile`, `requireAdvisorAccess`, or `requireAdminAccess`. Public surface limited to health probes.
2. **No browser-supplied `client_id` on client portal writes** — `rejectClientIdInBody` / `rejectUnexpectedFields` on privileged routes.
3. **Advisor scoping** — `resolveAccessibleClient()` enforces assignment (`advisor_user_id === auth.uid()`); admin bypass is explicit.
4. **Service role server-only** — `lib/supabase/admin.ts` has `import "server-only"`; browser client uses anon key only.
5. **RLS enabled** on all reviewed public tables; helper functions use `SECURITY DEFINER` + fixed `search_path`.
6. **Audit logging** on major writes via `writeAuditLog()` (best-effort, non-blocking).
7. **Error sanitization** — `toPublicErrorMessage()` used across API catch blocks.
8. **Rate limiting** on write-heavy and command-center routes (Phase 4Q + 4X fixes).
9. **Production health hardening** — `/api/health/supabase` omits diagnostics in production mode.
10. **Document vault validation** — Size, MIME, category, ownership checks before signed URLs.

---

## 4. Findings Summary

### Critical

| ID | Finding | Mitigation |
|----|---------|------------|
| C-1 | **`users_update_own` RLS allowed column-level escalation** — Authenticated users could `UPDATE users SET role = 'admin'` via browser Supabase client. | **Fixed in Phase 4X.1** — migration `202606100014_fix_users_role_self_escalation.sql`: column-level `GRANT`, `users_update_own_profile` RLS with `users_protected_fields_unchanged()`, and `enforce_users_self_update_safety()` trigger. Service-role admin routes unchanged. |
| — | No automated critical service-role import violations detected | `npm run security:service-role` |

### High

| ID | Finding | Mitigation |
|----|---------|------------|
| H-1 | **Service role bypasses all RLS** — Compromised `SUPABASE_SERVICE_ROLE_KEY` = full DB access. | Secret rotation, Vercel sensitive env, least-privilege ops. Documented in [Service Role Usage Review](./SERVICE_ROLE_USAGE_REVIEW.md). |
| H-2 | **In-memory rate limits not multi-instance safe** | Upgrade to Redis/edge before horizontal scale. |
| H-3 | **Middleware does not enforce advisor/admin roles on pages** | API returns 403; pages may flash UI. Acceptable for MVP; add server page guards if needed. |

### Medium

| ID | Finding | Mitigation |
|----|---------|------------|
| M-1 | **Public `/api/health/supabase` uses service role** | IP rate limit + production payload reduction; consider auth/IP allowlist. |
| M-2 | **Storage RLS: no `is_admin()` on SELECT** — Admins rely on service-role API for storage; direct browser storage API blocked for admin. | Acceptable given API-only admin doc access. |
| M-3 | **`clients` UPDATE policy does not restrict columns** — Owner could mutate `advisor_user_id` via direct Supabase client. | Tighten RLS or restrict updates to service role only. |
| M-4 | **Signed-url routes lack rate limits** | Low abuse risk (auth + ownership); consider `writeHeavy` or light bucket. |
| M-5 | **`/api/me` exposes `clientId` to authenticated user** | Intentional for UI; low risk (own record only). |

### Low

| ID | Finding | Notes |
|----|---------|-------|
| L-1 | Audit log insert failures are silent | Monitor `[auditLog]` in production logs |
| L-2 | `advisor_tasks` / `audit_logs` have no authenticated INSERT policies | By design — API uses service role |
| L-3 | Legal pages (`/legal/*`) are public | Expected |
| L-4 | `wealth_blueprints` UPDATE is admin-only at RLS; advisors write via service role | Consistent with API design |

---

## 5. Phase 4X / 4X.1 Fixes Applied

| File | Change |
|------|--------|
| `app/api/advisor/clients/create-placeholder/route.ts` | Added `writeHeavy` rate limit (4X) |
| `app/api/admin/clients/create-placeholder/route.ts` | Added `writeHeavy` rate limit (4X) |
| `app/api/advisor/clients/[clientId]/review-status/route.ts` | Added `writeHeavy` rate limit + `rejectUnexpectedFields` (4X) |
| `supabase/migrations/202606100014_fix_users_role_self_escalation.sql` | C-1 RLS + column grants + trigger (4X.1) |

---

## 6. Accepted MVP Risks

| Risk | Rationale |
|------|-----------|
| Service-role writes for scoring and persistence | Performance and complexity; RLS is second line for direct client access |
| In-memory rate limiting | Single-instance / preview deployments |
| Public health endpoint | Ops need connectivity probe; production mode minimizes leakage |
| Page-level role not in middleware | API is authoritative; UI shows access denied components |
| No WAF / bot protection yet | Planned pre-launch traffic |
| Draft legal templates | Documented in legal layer; lawyer review required |

---

## 7. Recommended Next Actions

### Before private beta

1. ~~**Fix C-1**~~ — Applied in `202606100014_fix_users_role_self_escalation.sql`; verify with [Security Test Plan §12](./SECURITY_TEST_PLAN.md).
2. Run manual tests in [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md).
3. Run `npm run security:audit` and `npm run qa:smoke` on staging.
4. Confirm `SUPABASE_SERVICE_ROLE_KEY` not in client bundle (`next build` + grep `.next`).
5. Enable Supabase Auth email confirmation / MFA policy decision.

### Before production traffic

1. Replace in-memory rate limits with shared store (Redis/Upstash).
2. Restrict or authenticate health endpoints in production.
3. Add WAF / CDN rate rules.
4. Schedule service role key rotation.
5. Restore drill for Postgres + `client-documents` bucket.

---

## 8. Sign-off Checklist

| Item | Status |
|------|--------|
| All API routes reviewed | ✅ |
| RLS policies documented | ✅ |
| Storage policies documented | ✅ |
| Service role usage documented | ✅ |
| Automated scans added | ✅ |
| Critical migration fixes | ✅ C-1 fixed (4X.1) · ☐ M-3 clients column UPDATE |
| Manual advisor/admin tests | ☐ Operator |

---

**Phase 4X complete.** Primary deliverables are audit documentation and `security:*` npm scripts. No schema or policy migrations were applied in this phase.
