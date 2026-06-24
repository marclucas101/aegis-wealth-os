# Phase 9F.4 Checkpoint 4 — Application Retirement Audit

**Checkpoint:** 9F.4 Checkpoint 4 (Application Retirement)  
**Model:** Option B — retire application entry points; retain read-only schema; admin migration review during observation  
**Audit date:** 2026-06-24  
**Production baseline:** Migrations `202606200011` and `202606200012` applied; `legacy_promotions_write = false`; production `promotions` row count = **0**

## Executive summary

Checkpoint 4 retires legacy Promotions **application surfaces** without destructive schema changes. Adviser and client promotion pages redirect to Governed Communications replacements. Adviser promotion APIs return HTTP **410** with `LEGACY_PROMOTIONS_RETIRED`. The client list API returns a compatibility payload with an empty list and `retired: true`. Admin migration review remains available at `/admin/promotions-migration` for historical disposition during the 30-day observation window.

Migration **execution** (POST migrate endpoints) remains blocked until staging runtime concurrency acceptance completes (`PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE !== "true"`).

---

## Classification legend

| Classification | Meaning |
|----------------|---------|
| **Retire / redirect** | User-facing path removed or redirected; no legacy UI served |
| **Retire / API compat** | Route retained with explicit retirement response (410 or empty retired payload) |
| **Retain admin** | Active for admin migration review and audit |
| **Retain schema** | Database or storage artifact kept read-only; no deletion |
| **Retain replacement** | Governed Communications path that supersedes legacy Promotions |
| **Defer** | Source retained in repo but not reachable from production routes |
| **Docs / test** | Validation scripts, diagnostics, or documentation only |

---

## Application routes

| Entry point | Audience | CP4 behaviour | HTTP | Replacement | Classification |
|-------------|----------|---------------|------|-------------|----------------|
| `/advisor/promotions` | Adviser, admin | Server redirect after optional audit | 307 → `/advisor/insights?legacy_promotions_retired=1` | Insights Authoring | **Retire / redirect** |
| `/promotions` | Client | Server redirect after optional audit | 307 → `/insights?legacy_promotions_retired=1` | Insights & Updates | **Retire / redirect** |
| `/advisor/insights` | Adviser, admin | Active; shows `LegacyPromotionsRetiredNotice` when `legacy_promotions_retired=1` | 200 | — | **Retain replacement** |
| `/insights` | Client | Active; shows retired notice when query param present | 200 | — | **Retain replacement** |
| `/admin/promotions-migration` | Admin | Active migration review workspace | 200 | — | **Retain admin** |

**Implementation:** `app/advisor/promotions/page.tsx`, `app/promotions/page.tsx`, `app/advisor/insights/page.tsx`, `app/insights/page.tsx`, `app/admin/promotions-migration/page.tsx`, `lib/promotions/legacyPromotionsRetirementConstants.ts`.

---

## API routes

| Entry point | Methods | Audience | CP4 behaviour | Response | Classification |
|-------------|---------|----------|---------------|----------|----------------|
| `/api/advisor/promotions` | GET, POST | Adviser | All methods retired | **410** `{ error: { code: "LEGACY_PROMOTIONS_RETIRED", message: "…" } }` | **Retire / API compat** |
| `/api/advisor/promotions/[promotionId]` | GET, PATCH | Adviser | All methods retired | **410** same body | **Retire / API compat** |
| `/api/advisor/promotions/[promotionId]/upload` | POST | Adviser | Upload retired | **410** same body | **Retire / API compat** |
| `/api/promotions` | GET | Client | Compatibility list | **200** `{ ok: true, promotions: [], retired: true, replacement: "insights" }` | **Retire / API compat** |
| `/api/admin/promotions-migration` | GET | Admin | List + queue overview + retirement context | **200** | **Retain admin** |
| `/api/admin/promotions-migration` | POST | Admin | Legacy migrate entry | **403** `PHASE9F4_MIGRATION_RUNTIME_GATE_INCOMPLETE` until acceptance | **Retain admin** (gated) |
| `/api/admin/promotions-migration/[promotionId]` | GET | Admin | Detail + preview embed | **200** | **Retain admin** |
| `/api/admin/promotions-migration/[promotionId]/preview` | GET, POST | Admin | Server preview | **200** | **Retain admin** |
| `/api/admin/promotions-migration/[promotionId]/review` | PATCH | Admin | Classification + operator note | **200** | **Retain admin** |
| `/api/admin/promotions-migration/[promotionId]/migrate` | POST | Admin | Explicit migrate | **403** runtime gate until acceptance | **Retain admin** (gated) |

**Permanent adviser mutation retirement:** `adviserLegacyPromotionsMutationsRetired()` returns `true` — adviser promotion APIs stay **410** even if `legacy_promotions_write` is mistakenly re-enabled.

**Implementation:** `lib/promotions/legacyPromotionsRetirement.ts`, `lib/promotions/promotionMigrationRuntimeGate.ts`, `app/api/advisor/promotions/**`, `app/api/promotions/route.ts`, `app/api/admin/promotions-migration/**`.

---

## Navigation and catalogue

| Entry point | CP4 state | Classification |
|-------------|-----------|----------------|
| Client nav — Insights & Updates (`/insights`) | Active | **Retain replacement** |
| Adviser nav — Insights Authoring (`/advisor/insights`) | Active | **Retain replacement** |
| Legacy `/promotions` client nav item | Not present in `ACTIVE_CLIENT_NAV_SECTIONS` | **Retire / redirect** (pre-CP4) |
| Legacy `/advisor/promotions` adviser nav item | Not present in `NAV_SECTIONS` | **Retire / redirect** (pre-CP4) |
| Admin link from Communications workspace | `/admin/promotions-migration` | **Retain admin** |

---

## Schema and storage

| Artifact | CP4 state | Classification |
|----------|-----------|----------------|
| `public.promotions` | Retained; production count **0** | **Retain schema** |
| `public.promotion_migration_reviews` | Retained | **Retain schema** |
| Storage bucket `promotion-assets` | Retained; **no deletion** | **Retain schema** |
| RLS policies on `promotions` | Unchanged | **Retain schema** |
| Migration `202606200011` (`legacy_promotions_write`) | Applied; default **false** | **Retain schema** |
| Migration `202606200012` (atomic idempotency RPC) | Applied | **Retain schema** |

---

## Internal modules (deferred removal)

| Module / component | Purpose | Classification |
|--------------------|---------|----------------|
| `lib/supabase/promotionsPersistence.ts` | Service-role reads for migration | **Defer** |
| `lib/promotions/legacyPromotionsAuthorization.ts` | Shared auth helpers | **Defer** |
| `components/aegis/advisor/promotions/*` | Legacy manager UI (unrouted) | **Defer** |
| `components/aegis/promotions/PromotionsClient.tsx` | Legacy client UI (unrouted) | **Defer** |
| `components/aegis/promotions/PromotionCard.tsx` | Legacy card (unrouted) | **Defer** |
| `components/aegis/promotions/LegacyPromotionsRetiredNotice.tsx` | CP4 replacement notice | **Retain replacement** |

---

## Audit actions (Checkpoint 4)

| Audit action | Trigger |
|--------------|---------|
| `legacy_promotions_replacement_redirected` | Authenticated user hits `/advisor/promotions` or `/promotions` |
| `legacy_promotions_retired_route_accessed` | Adviser GET on retired promotion APIs |
| `legacy_promotions_retired_mutation_blocked` | Adviser POST/PATCH/upload on retired promotion APIs |

Metadata includes `result_code: LEGACY_PROMOTIONS_RETIRED` and `action_type` route category. No promotion body or storage paths in metadata.

---

## Validation and diagnostics

| Artifact | Purpose | Classification |
|----------|---------|----------------|
| `npm run qa:phase9f4-audit` | Retirement architecture validation | **Docs / test** |
| `npm run qa:phase9f4-write-freeze` | Write-freeze regression | **Docs / test** |
| `npm run qa:phase9f4-migration-review` | Migration API validation | **Docs / test** |
| `npm run test:phase9f4-migration-idempotency-local` | Staging concurrency acceptance (not yet passed) | **Docs / test** |
| `supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql` | Operator preflight | **Docs / test** |

---

## Runtime gate status

| Gate | Required for | CP4 status |
|------|--------------|------------|
| `PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE=true` | POST migrate execution | **Not completed** — staging concurrency acceptance pending |
| Staging script | `test:phase9f4-migration-idempotency-local` on approved target | **Not run to acceptance** |

List, detail, preview, and review admin endpoints remain available. Only **migrate execution** POST paths enforce the runtime gate.

---

## Sign-off criteria (Checkpoint 4)

| Criterion | Status |
|-----------|--------|
| Option B application retirement deployed | **Complete** |
| Schema and `promotion-assets` retained | **Complete** |
| Admin migration review reachable | **Complete** |
| Production `promotions` count = 0 | **Complete** |
| 30-day observation clock started | **Operator — from production deployment date** |
| Runtime concurrency acceptance | **Waived for retirement; blocks migrate execution only** |
| Stage 6 optional schema drop | **Out of scope — post-observation operator decision** |
