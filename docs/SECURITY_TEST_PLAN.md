# Security Test Plan — Phase 4R

**Date:** 2026-06-10  
**Purpose:** Manual security verification beyond automated smoke tests.

**Related:** [Security Audit Report](./SECURITY_AUDIT_REPORT.md) · [Advisor & Admin Access Review](./ADVISOR_ADMIN_ACCESS_REVIEW.md) · [Supabase Security Review](./SUPABASE_SECURITY_REVIEW.md) · [Role Access Matrix](./ROLE_ACCESS_MATRIX.md) · [API Route Inventory](./API_ROUTE_INVENTORY.md)

**Automation:** `npm run security:audit` · `npm run security:api` · `npm run security:service-role`

---

## Test Environment

- Staging with production-like env (`NODE_ENV=production` optional for health tests)
- Four test accounts: client, assigned advisor, unassigned advisor, admin
- HTTP client (curl, Bruno, Postman) or browser DevTools
- **Never** log or commit tokens, cookies, or key values

---

## 1. Authentication — 401 Tests

Verify unauthenticated requests are rejected before business logic.

| ID | Request | Expected |
|----|---------|----------|
| S-401-1 | `GET /api/dashboard/current` (no cookie) | 401 |
| S-401-2 | `POST /api/discover/save` `{}` | 401 |
| S-401-3 | `GET /api/advisor/overview` | 401 |
| S-401-4 | `GET /api/admin/users` | 401 |
| S-401-5 | `PATCH /api/admin/users/{id}/role` | 401 |
| S-401-6 | `GET /api/advisor/clients/{clientId}` | 401 |
| S-401-7 | Invalid/expired session cookie on protected route | 401 |

**Pass criteria:** Response status 401; body does not leak stack traces or SQL; no 500.

**Exception:** `GET /api/me` returns 200 with `{ authenticated: false }` — by design.

---

## 2. Authorization — 403 Tests

Verify authenticated but unauthorized roles cannot access privileged resources.

| ID | Actor | Request | Expected |
|----|-------|---------|----------|
| S-403-1 | Client | `GET /api/advisor/overview` | 403 |
| S-403-2 | Client | `GET /api/admin/users` | 403 |
| S-403-3 | Advisor | `GET /api/admin/clients` | 403 |
| S-403-4 | Advisor | `PATCH /api/admin/users/{id}/role` | 403 |
| S-403-5 | Unassigned advisor | `GET /api/advisor/clients/{otherClientId}` | 403 |
| S-403-6 | Unassigned advisor | `POST .../notes` on other client | 403 |
| S-403-7 | Assigned advisor | `GET /api/admin/users` | 403 |

**Pass criteria:** 403 with `{ ok: false, reason: "forbidden" }` or equivalent safe message.

---

## 3. Not Found — 404 Tests

Verify invalid IDs do not expose existence of other tenants' data or throw 500.

| ID | Actor | Request | Expected |
|----|-------|---------|----------|
| S-404-1 | Assigned advisor | `GET /api/advisor/clients/not-a-uuid` | 404 |
| S-404-2 | Admin | `GET /api/advisor/clients/{random-valid-uuid}` | 404 |
| S-404-3 | Advisor | `PATCH /api/advisor/tasks/{nonexistent-task-id}` | 404 |
| S-404-4 | Client | `POST /api/documents/delete` with unknown documentId | 404 |

**Pass criteria:** 404 or safe not-found message; no internal error strings in production mode.

---

## 4. Conflict — 409 Tests

| ID | Actor | Request | Expected |
|----|-------|---------|----------|
| S-409-1 | Assigned advisor | `PATCH /api/advisor/clients/{id}/review-status` with stale version / invalid transition | 409 when applicable |
| S-409-2 | Admin | Create placeholder with duplicate email | 409 or `duplicate_email` reason |

Review route-specific conflict handling in advisor review-status and onboarding flows.

---

## 5. Rate Limiting — 429 Tests

| ID | Request | Expected |
|----|---------|----------|
| S-429-1 | >30 `POST /api/discover/save` within 60s (same user) | 429, `Retry-After` header |
| S-429-2 | >20 `GET /api/health/supabase` within 60s (same IP) | 429 |
| S-429-3 | >120 command-center GET within 60s | 429 |
| S-429-4 | 429 body | `{ ok: false, error: "Too many requests..." }` — no stack trace |

**Note:** In-memory limits apply per server process; multi-instance bypass is a known limitation.

---

## 6. Sensitive Field Rejection

Blocked fields (default): `user_id`, `userId`, `advisor_id`, `advisorId`, `client_id`, `clientId`, `role`, `service_role`, `serviceRole`.

| ID | Route | Body | Expected |
|----|-------|------|----------|
| S-FIELD-1 | `POST /api/discover/save` | include `client_id` | 400, must not be supplied |
| S-FIELD-2 | `POST /api/documents/upload` (multipart) | field `clientId` | 400 |
| S-FIELD-3 | `POST /api/roadmap/status` | include `role: "admin"` | 400 |
| S-FIELD-4 | `PATCH /api/admin/users/{id}/role` | include extra `user_id` | 400 |
| S-FIELD-5 | `POST /api/advisor/tasks` | include `serviceRole` | 400 |
| S-FIELD-6 | `PATCH /api/admin/users/{id}/role` | `{ role: "admin" }` only | 200/400 per validation — `role` allowed here |

Implementation: `rejectUnexpectedFields()` in `lib/security/requestValidation.ts`.

---

## 7. Service-Role Import Safety

Manual code review checklist (no runtime test required each release unless code changes):

| ID | Check | Expected |
|----|-------|----------|
| S-SR-1 | `createAdminSupabaseClient` not imported in `components/**` | None |
| S-SR-2 | Not imported in client-side pages without `"use server"` | None |
| S-SR-3 | `lib/supabase/admin.ts` has `import "server-only"` | Present |
| S-SR-4 | `getSupabaseServiceRoleKey()` only used server-side | Present |
| S-SR-5 | `next build` client bundle grep for `service_role` | No matches |

Automated helper: search repo for `createAdminSupabaseClient` imports outside `app/api`, `lib/supabase`, and route handlers.

---

## 8. Health Endpoint Leakage

| ID | Condition | Request | Expected |
|----|-----------|---------|----------|
| S-HEALTH-1 | `NODE_ENV=production` | `GET /api/health/supabase` | Minimal JSON: `ok`, `timestamp` only on success |
| S-HEALTH-2 | Production failure | DB unreachable | No raw Postgres/Supabase error strings |
| S-HEALTH-3 | Any env | Response body | No JWTs, keys, or connection strings |
| S-HEALTH-4 | Dev mode | Unhealthy DB | Sanitized `error` field — tokens redacted |

Run `npm run qa:smoke` for basic JWT-leak check on health JSON.

---

## 9. Error Sanitization

| ID | Trigger | Expected |
|----|---------|----------|
| S-ERR-1 | Force DB error on protected route (staging) | Generic fallback message via `toPublicErrorMessage()` |
| S-ERR-2 | Validation errors (file too large) | User-facing message preserved |
| S-ERR-3 | Production 500 responses | No `stack`, `hint`, or `details` from Postgres |

---

## 10. Document & Report Integrity

| ID | Check | Expected |
|----|-------|----------|
| S-DOC-1 | Client cannot open another client's document via guessed UUID | 404 |
| S-DOC-2 | Signed URL expires after ~120s | Second fetch fails |
| S-DOC-3 | Blueprint/annual review save ignores browser report payload | Server loads from DB snapshots only |
| S-DOC-4 | Advisor report view on unassigned client | 403 |

---

## 11. Audit Trail Verification

After performing one action from each category, confirm `audit_logs` row:

| Action type | Example route |
|-------------|---------------|
| Client write | discover save, document upload |
| Advisor write | note create, task update |
| Admin write | role update, advisor assignment |
| Access audit | advisor document signed-url, report view |

Failures to insert must not fail the HTTP request — check server logs for `[auditLog]`.

---

## Execution Log Template

| ID | Date | Tester | Pass/Fail | Notes |
|----|------|--------|-----------|-------|
| S-401-1 | | | | |
| … | | | | |

---

## Exit Criteria

- [ ] All 401/403/404 cases pass on staging
- [ ] 429 verified on at least one write and health route
- [ ] Sensitive field rejection verified on client and admin routes
- [ ] Health endpoint passes leakage checks in production mode
- [ ] Service-role import review completed
- [ ] Findings documented; P0/P1 issues resolved before production
