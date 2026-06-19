# Phase 9D — Security and Privacy Review

**Date:** 20 June 2026  
**Branch:** `phase-9d-converted-client-portal`  
**Scope:** Converted active-client portal (Phase 9D hardening)

---

## 1. API inventory

| Route | Method | Purpose | Auth | Entitlement | DTO | Publication | Rate limit | Audit | Cache |
|-------|--------|---------|------|-------------|-----|-------------|------------|-------|-------|
| `/api/client/financial-overview` | GET | Portal shell + published overview | Session | `active_client` + `financial_overview` | Yes | Yes | N/A | Yes | `private, no-store` |
| `/api/client/my-plan` | GET | Current plan publications | Session | `active_client` + `my_plan` | Yes | Yes | N/A | Yes | `private, no-store` |
| `/api/client/roadmap` | GET | Client-safe roadmap tasks | Session | `active_client` + `roadmap` | Yes | Optional summary | N/A | No | `private, no-store` |
| `/api/client/goals-reviews` | GET | Goals + review status | Session | `active_client` + `goals_and_reviews` | Yes | Read summaries | N/A | No | `private, no-store` |
| `/api/client/goals-reviews` | POST | Save goal / submit review | Session | `active_client` + `goals_and_reviews` | Yes | N/A | Yes | Yes (`writeAuditLog` + events) | N/A |
| `/api/client/published-summaries` | GET | Published summaries incl. meeting | Session | `active_client` | Yes | Yes | N/A | Conditional | `private, no-store` |
| `/api/budget-optimiser/current` | GET | Budget load | Session | `budget` feature | Yes | N/A | N/A | No | `private, no-store` |
| `/api/budget-optimiser/save` | POST | Budget save | Session | `budget` feature | Yes | N/A | Yes | Yes | N/A |
| `/api/budget-optimiser/history` | GET | Budget history | Session | `budget` feature | Yes | N/A | N/A | No | `private, no-store` |

**Modified (hardening):** Budget routes now enforce `assertClientFeatureApiAccess("budget")` — blocks prospects and inactive clients.

**No browser-supplied `client_id`** on any Phase 9D write route.

---

## 2. security:api findings

### Resolved (Phase 9D)

| Finding | Resolution |
|---------|------------|
| `/api/client/goals-reviews` POST — INFO: no audit | Added `writeAuditLog` for goal save and review submit |
| Client API auth not recognised | Added `assertActiveClientPortalAccess` and `assertClientFeatureApiAccess` to scanner allowlist |

### Intentionally accepted REVIEW (pre-existing, Phase 9C Meeting Studio)

Seven Meeting Studio write routes flagged for missing `toPublicErrorMessage` in catch paths — documented in `docs/SECURITY_API_WARNINGS_AUDIT.md`. Not introduced by Phase 9D; adviser-only routes with assignment validation.

### Service-role usage (REVIEW)

Phase 9D compliance modules use admin **service-role** client server-only — same pattern as Phase 9B prospect submission.

---

## 3. Relationship-stage enforcement

| Stage | Portal nav | `/api/client/*` | Budget | Documents | My Adviser |
|-------|------------|-----------------|--------|-----------|------------|
| Prospect stages | Prospect nav | 403 | 403 + redirect | Limited | Yes |
| `active_client` | Active nav | Allowed | Allowed | Full | Yes |
| `inactive_client` | Filtered legacy nav | 403 | 403 + redirect | Yes | Yes |
| Missing stage | Minimal | 403 | 403 | Per policy | Per policy |

**Promotion to `active_client`:** admin-only (`ADMIN_ONLY_STAGES`). Clients, appointments, meetings, and publications cannot self-promote.

**Legacy `clients.status`:** mapped via `resolveRelationshipStage` — never browser-supplied.

---

## 4. Direct-route protection

Server-side page gates (`lib/compliance/activeClientPageGate.ts`):

| Page | Gate |
|------|------|
| `/my-plan`, `/goals-reviews`, `/insights` | `requireActiveClientPortalPage()` |
| `/budget-optimiser`, `/roadmap` | `requireClientFeaturePage(feature)` |

Prospects hitting protected routes redirect to `/prospect`. Inactive clients redirect to `/my-adviser`. No active-client UI flash before redirect.

---

## 5. Publication selection integrity

`lib/compliance/publicationSelection.ts`:

- `selectSingleCurrentPublishedOutput` — deterministic newest-by-`published_at` when duplicates exist
- `filterPublicationsForOutputTypes` — one current row per output type
- All rows must pass `isCurrentPublishedOutput` (audience, status, not withdrawn/superseded/expired)

Wrong client: prevented by session-scoped `clientId` in all loaders.

---

## 6. DTO and negative tests

`scripts/phase9d-client-safe-dto-negative-tests.ts` covers:

- `financial_overview` / readiness snapshot
- `client_plan_summary`
- `meeting_summary`

Prohibited nested keys rejected via `assertNoProhibitedKeysDeep` and allowlist construction.

---

## 7. Analytics privacy

`lib/compliance/activeClientAuditMetadata.ts` + runtime check in `recordActiveClientEvent`.

`scripts/phase9d-analytics-privacy-tests.ts` validates scanner.

Metadata allowed: event type, output type, IDs, status flags, counts — **not** financial values or payloads.

---

## 8. Caching and browser state

- Personalised `/api/client/*` and budget GET routes: `Cache-Control: private, no-store`
- Active-client React loaders use `fetch(..., { cache: "no-store" })`
- Financial overview / my plan: no `localStorage` for publications
- Budget optimiser: local draft storage only (client-controlled inputs, not adviser publications)

---

## 9. Migration and RLS

See `docs/PHASE_9D_MIGRATION_AND_ROLLBACK.md` for verification SQL.

- `client_goals`: client INSERT/UPDATE own rows only; adviser SELECT assigned
- `client_review_submissions`: client INSERT own; no client UPDATE to `reviewed`
- `roadmap_items`: presentation columns default safe (`client_visible=false`)

---

## 10. Deferred / human verification

- Device testing: keyboard, screen reader, touch targets (code review complete)
- Staging: duplicate publication row behaviour with real DB
- Concurrent review submission under load
- Browser back-after-logout manual check

---

## 11. Compliance review items remaining

- Legal/compliance sign-off on inactive-client document upload/download policy wording
- Adviser workflow for marking roadmap items `client_visible`
- Production migration approval (Phase 9F)

**Phase 9E not started.**
