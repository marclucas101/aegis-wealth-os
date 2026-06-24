# Phase 9F.4 — Application Retirement Architecture (Checkpoint 4)

**Checkpoint:** 9F.4 Checkpoint 4  
**Selected model:** Option B — deprecate application paths; retain historical schema  
**Related:** `docs/PHASE_9F4_RETIREMENT_ARCHITECTURE.md` (multi-stage plan), `docs/PHASE_9F4_WRITE_FREEZE_ARCHITECTURE.md` (Checkpoint 2)

---

## Objective

Retire legacy Promotions from day-to-day product use while preserving audit history, migration review tooling, and storage assets until the observation period completes. No destructive DDL or bucket deletion in this checkpoint.

---

## Production posture (Checkpoint 4)

| Control | Value |
|---------|-------|
| Migration `202606200011` | Applied — `legacy_promotions_write` seeded **disabled** |
| Migration `202606200012` | Applied — atomic `execute_legacy_promotion_migration` RPC |
| Production `promotions` rows | **0** |
| `legacy_promotions_write` | **false** |
| Runtime concurrency acceptance | **Not completed** — migrate execution gated |
| Observation period | **30 days** from Checkpoint 4 production deployment |

---

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Legacy Promotions (retired)                  │
├─────────────────────────────────────────────────────────────────┤
│  /advisor/promotions ──redirect──► /advisor/insights?notice=1   │
│  /promotions         ──redirect──► /insights?notice=1           │
│  /api/advisor/promotions* ────────► HTTP 410 LEGACY_PROMOTIONS  │
│  /api/promotions (client GET) ────► empty list + retired: true  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Governed Communications (replacement)               │
├─────────────────────────────────────────────────────────────────┤
│  Adviser: /advisor/insights (Insights Authoring)                 │
│  Client:  /insights (Insights & Updates feed)                    │
│  Admin:   /admin/communications (approval + publish)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           Admin migration review (observation only)              │
├─────────────────────────────────────────────────────────────────┤
│  UI:  /admin/promotions-migration                                │
│  API: list / detail / preview / review — active                  │
│  API: migrate POST — blocked until runtime acceptance            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Read-only retention (Option B schema)               │
├─────────────────────────────────────────────────────────────────┤
│  promotions, promotion_migration_reviews, promotion-assets       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Retirement module

Central implementation: `lib/promotions/legacyPromotionsRetirement.ts`

| Export | Role |
|--------|------|
| `legacyPromotionsRetiredAdvisorResponse()` | HTTP 410 + `LEGACY_PROMOTIONS_RETIRED` error body |
| `legacyPromotionsRetiredClientListResponse()` | HTTP 200 compatibility payload |
| `adviserPromotionsRetiredRedirectTarget()` | `/advisor/insights?legacy_promotions_retired=1` |
| `clientPromotionsRetiredRedirectTarget()` | `/insights?legacy_promotions_retired=1` |
| `auditLegacyPromotionsRetirementAccess()` | Structured audit for redirect and API access |
| `adviserLegacyPromotionsMutationsRetired()` | Permanent `true` — mutations never restored via feature flag alone |

Constants: `lib/promotions/legacyPromotionsRetirementConstants.ts`

---

## Response contracts

### Adviser APIs (all methods on legacy promotion routes)

```json
HTTP 410 Gone
{
  "error": {
    "code": "LEGACY_PROMOTIONS_RETIRED",
    "message": "Legacy Promotions has been retired. Use Governed Communications."
  }
}
```

Responses use `privatePromotionJson` (no-store cache headers).

### Client list API

```json
HTTP 200 OK
{
  "ok": true,
  "promotions": [],
  "retired": true,
  "replacement": "insights"
}
```

Requires authenticated **client** role; unauthenticated → 401; non-client → 403.

---

## Replacement UX

When users arrive from a legacy URL redirect, replacement pages show `LegacyPromotionsRetiredNotice`:

- Query param: `legacy_promotions_retired=1` (also accepts `true`)
- Adviser copy references Governed Communications (Insights Authoring)
- Client copy references Insights & Updates

---

## Admin migration during observation

Admin workspace remains the operator surface for historical disposition:

- **Read paths:** list, detail, preview, PATCH review — always available to authorized admins
- **Write path (migrate):** blocked by `isPhase9f4MigrationExecutionRestricted()` until `PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE=true`

Admin list responses include `retirement` context from `buildPromotionMigrationAdminRetirementContext()`:

- `legacyPromotionsRetired: true`
- `sourceRowCount`, `unmigratedQueueCount`
- `migrationRuntimeAcceptanceComplete`, `migrationExecutionRestricted`, `runtimeGateMessage`

With production `promotions` count = 0, queue counts reflect historical migration-review rows only.

---

## Feature flag interaction

| Flag | CP2 behaviour | CP4 behaviour |
|------|---------------|---------------|
| `legacy_promotions_write` | Gates adviser mutations (403 when false) | **Superseded** for adviser APIs — permanent 410 retirement |
| Emergency re-enable | Could restore adviser CRUD | **Does not restore** adviser promotion APIs; rollback requires git revert of CP4 routes |

Client API behaviour is unchanged from fail-closed posture: empty list with explicit `retired: true` at CP4.

---

## Binder isolation (Phase 9F.3)

No changes to binder export, client vault, or Phase 9F.3 modules. Retirement touches only promotion routes, promotion APIs, and shared notice component.

---

## What is explicitly not done

- No `DROP TABLE`, RLS revocation, or bucket deletion
- No removal of persistence or legacy UI source files (deferred to post-observation)
- No automatic migration execution in production while runtime gate incomplete
- No Stage 6 schema retirement without separate operator approval

---

## Rollback model

Application-layer rollback only — see `docs/PHASE_9F4_RETIREMENT_ROLLBACK.md`. Schema and storage remain intact under Option B.
