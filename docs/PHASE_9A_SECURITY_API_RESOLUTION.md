# Phase 9A API Security Warnings — Resolution

**Date:** 20 June 2026  
**Command:** `npm run security:api`  
**Branch:** `phase-9-compliance-redesign`

---

## Six WARN items resolved

| Route | Write op | Auth guard | Rate limit | Audit | Resolution |
|-------|----------|------------|------------|-------|------------|
| `/api/admin/clients/:clientId/relationship-stage` | PATCH | `requireAdminAccess()` | `rateLimitOrThrow` (`writeHeavy`) | `updateRelationshipStage()` → `writeAuditLog` | Admin-only route; adviser path moved to `/api/advisor/clients/:clientId/relationship-stage` |
| `/api/admin/feature-controls` | PATCH | `requireAdminAccess()` | `rateLimitOrThrow` (`writeHeavy`) | `writeAuditLog` at route + `setFeatureControl` | Admin emergency kill switches |
| `/api/advisor/clients/:clientId/publications` | POST | `requireAdvisorAccess()` + `resolveAccessibleClient()` + `canPublishClientOutput()` | `rateLimitOrThrow` (`writeHeavy`, per user) | `prepareClientSafeOutput()` → `writeAuditLog` | Prepare draft only |
| `/api/advisor/clients/:clientId/publications/:outputId/review` | POST | Same | `rateLimitOrThrow` | `reviewPublishedOutput()` → `writeAuditLog` | Draft → adviser_reviewed |
| `/api/advisor/clients/:clientId/publications/:outputId/publish` | POST | Same + assignment re-check at publish | `rateLimitOrThrow` | `publishOutput()` → `writeAuditLog` | Requires `adviser_reviewed`; supersedes prior |
| `/api/advisor/clients/:clientId/publications/:outputId/withdraw` | POST | Same | `rateLimitOrThrow` | `withdrawOutput()` → `writeAuditLog` | Terminal withdrawal |

---

## Scanner updates

`scripts/check-api-auth-patterns.ts` now recognises service-layer audit via `SERVICE_AUDIT_PATTERNS`:

- `prepareClientSafeOutput`
- `publishOutput`
- `reviewPublishedOutput`
- `withdrawOutput`
- `updateRelationshipStage`
- `setFeatureControl`

Routes calling these functions are marked **Audit: yes** without duplicating audit rows at the route layer.

---

## Accepted INFO items

None remaining after Phase 9A hardening. All six prior INFO items on publication and relationship-stage routes are resolved via service-layer audit recognition.

---

## Relationship-stage route separation

| Actor | Route | Policy |
|-------|-------|--------|
| Admin | `PATCH /api/admin/clients/[clientId]/relationship-stage` | Any valid stage |
| Adviser | `PATCH /api/advisor/clients/[clientId]/relationship-stage` | Assigned client only; workflow stages up to `recommendation_prepared`; blocked from `active_client` / `inactive_client` |
| Client | — | No route; `canClientSelfPromote()` always false |

Advisers are **not** authorised through `/api/admin/` routes.
