# API Security Review — Phase 4X

**Date:** 2026-06-10  
**Routes:** 53 handler files under `app/api/**`  
**Inventory:** [API Route Inventory](./API_ROUTE_INVENTORY.md)  
**Automation:** `npm run security:api` · `npm run qa:routes`

---

## Route classes

| Class | Guard | Count (handlers) | Notes |
|-------|-------|------------------|-------|
| Public health | None (rate limited) | 2 | `health/app`, `health/supabase` |
| Session / profile | Optional auth | 1 | `/api/me` |
| Client portal | `ensureUserClientProfile()` | 22 | Session-derived `client_id` |
| Advisor | `requireAdvisorAccess()` + assignment | 27 | `clientId` from URL |
| Admin | `requireAdminAccess()` | 6 | Full tenant admin |

---

## Auth patterns

| Pattern | Module | HTTP codes |
|---------|--------|------------|
| `ensureUserClientProfile()` | `lib/supabase/userProfile.ts` | 401 if no session |
| `requireAdvisorAccess()` | `lib/supabase/advisorAuth.ts` | 401 unauthenticated, 403 non-advisor |
| `requireAdminAccess()` | `lib/supabase/adminManagement.ts` | 401 / 403 |
| `resolveAccessibleClient()` | advisor `lib/supabase/*` | 403 unassigned, 404 missing |

**Middleware:** API routes are **not** middleware-gated. Each handler enforces auth — intentional.

---

## Rate limit patterns

| Bucket | Window | Max | Applied to |
|--------|--------|-----|------------|
| `writeHeavy` | 60s | 30 | Client/advisor/admin mutations |
| `commandCenter` | 60s | 120 | Advisor command-center GET |
| `health` | 60s | 20 | Health probes (per IP) |

**Phase 4X additions:** `writeHeavy` on advisor/admin create-placeholder and review-status PATCH.

**Still without rate limit (review):**

| Route | Method | Risk |
|-------|--------|------|
| `/api/documents/signed-url` | POST | Low — auth + ownership |
| `/api/advisor/.../signed-url` | POST | Low — assignment + audit |

---

## Sensitive field rejection

`rejectUnexpectedFields` / `rejectClientIdInBody` / `rejectForbiddenIdentityFields` block:

`user_id`, `advisor_id`, `client_id`, `role`, `service_role`, etc.

**Exceptions (documented):**

- Admin create-placeholder allows `advisor_user_id` in body (admin-only route)
- Admin role PATCH allows `role` in body
- Task routes may allow optional `client_id` (server validates scope)

---

## Audit logging coverage

| Domain | Actions |
|--------|---------|
| Client portal | `discover_profile_saved`, `roadmap_status_updated`, `stress_test_run`, `wealth_blueprint_saved`, `annual_review_saved`, `document_uploaded`, `document_deleted` |
| Advisor | Notes CRUD, tasks, documents, review status, invitations, placeholders, report views, signed-url access |
| Admin | Role update, advisor assignment, invitations, placeholders |

**Not audited:** GET reads (except advisor document/report access events), `/api/me`, signed-url client route.

---

## Error sanitization

`toPublicErrorMessage()` used in catch blocks across data routes. Preserves validation messages; maps DB/internal errors to generic fallbacks.

**Exception:** `/api/me` returns generic 500 with `{ authenticated: false }` — acceptable.

---

## Route-by-route matrix (summary)

### Public

| Route | Auth | RL | Notes |
|-------|------|----|-------|
| `GET /api/health/app` | No | health | Runtime metadata only |
| `GET /api/health/supabase` | No | health | Service role probe; prod-minimal JSON |

### Session

| Route | Auth | RL | Notes |
|-------|------|----|-------|
| `GET /api/me` | Optional | No | Returns own `clientId` when authed |

### Client portal (all require session except me)

| Route | W | RL | Audit | Ownership |
|-------|---|----|-------|-----------|
| `discover/save` | ✓ | ✓ | ✓ | session |
| `roadmap/status` | ✓ | ✓ | ✓ | session + item_key |
| `stress-testing/run` | ✓ | ✓ | ✓ | session + severity enum |
| `wealth-blueprint/save` | ✓ | ✓ | ✓ | server snapshot |
| `annual-review/save` | ✓ | ✓ | ✓ | server snapshot |
| `documents/upload` | ✓ | ✓ | ✓ | session |
| `documents/delete` | ✓ | ✓ | ✓ | `fetchOwnedDocument` |
| `documents/signed-url` | ✓ | — | — | `fetchOwnedDocument` |
| All `*/current`, `*/history`, `documents/list` | — | — | — | session |

### Advisor (require advisor/admin + assignment for `[clientId]`)

| Route | W | RL | Audit | Assignment |
|-------|---|----|-------|------------|
| `command-center` (+ heavy) | — | commandCenter | — | book scope |
| `overview`, `notifications`, `pipeline`, `file-quality`, `tasks`, `suggestions` | — | partial | — | book / self |
| `clients/[clientId]/*` | mixed | partial† | partial | `resolveAccessibleClient` |
| `tasks` POST, `tasks/[id]` PATCH | ✓ | ✓ | ✓ | assignee rules in persistence |
| `notes` CRUD | ✓ | ✓ | ✓ | assigned |
| `documents/upload`, `delete` | ✓ | ✓ | ✓ | assigned |
| `documents/.../signed-url` | ✓ | — | ✓ | assigned |
| `review-status` PATCH | ✓ | ✓‡ | ✓ | assigned |
| `create-placeholder` | ✓ | ✓‡ | ✓ | self-assign advisor |
| `client-invitations` | ✓ | ✓ | ✓ | advisor scope |

†See inventory for per-route RL  
‡Phase 4X hardened

### Admin

| Route | W | RL | Audit |
|-------|---|----|-------|
| `users` GET | — | — | — |
| `users/[id]/role` PATCH | ✓ | ✓ | ✓ |
| `clients` GET | — | — | — |
| `clients/[id]/advisor` PATCH | ✓ | ✓ | ✓ |
| `clients/create-placeholder` | ✓ | ✓‡ | ✓ |
| `client-invitations` | ✓ | ✓ | ✓ |

---

## Routes needing manual verification

| # | Test | Expected |
|---|------|----------|
| 1 | Client calls `POST /api/advisor/overview` | 403 |
| 2 | Unassigned advisor `GET /api/advisor/clients/{otherId}` | 403 |
| 3 | Client `POST /api/discover/save` with `client_id` in body | 400 |
| 4 | Admin `PATCH /api/admin/users/{id}/role` with self-demote | 400/403 |
| 5 | Unauthenticated `POST /api/documents/upload` | 401 |
| 6 | Burst 31 writes in 60s | 429 |
| 7 | `GET /api/health/supabase` in production | No `error` field on failure |

---

## Security helper reference

| Helper | File |
|--------|------|
| `rateLimitOrThrow` | `lib/security/apiGuards.ts` |
| `rejectUnexpectedFields` | `lib/security/requestValidation.ts` |
| `toPublicErrorMessage` | `lib/security/apiGuards.ts` |
| `writeAuditLog` | `lib/supabase/auditLog.ts` |

---

**Conclusion:** API surface is consistently guarded. Phase 4X closed rate-limit gaps on three write routes. Remaining review items are signed-url throttling and direct Supabase RLS escalation (see [RLS Policy Review](./RLS_POLICY_REVIEW.md)).
