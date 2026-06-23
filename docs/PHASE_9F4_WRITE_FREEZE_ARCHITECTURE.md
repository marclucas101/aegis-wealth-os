# Phase 9F.4 — Write Freeze Architecture

**Checkpoint:** 9F.4 Checkpoint 2 (implementation)

## Objective

Freeze all new legacy Promotions writes while preserving read-only historical access and the approved admin migration path.

## Feature control

| Key | Default | Client visible | Adviser visible | Purpose |
|-----|---------|----------------|-----------------|---------|
| `legacy_promotions_write` | **false** | false | true | Gates adviser POST/PATCH/upload on legacy Promotions APIs |

- Seeded by migration `202606200011`.
- Managed by existing admin feature-control API (`/api/admin/feature-controls`).
- **No** `legacy_promotions_ui` flag in this checkpoint.
- Rollback priority: re-enable `legacy_promotions_write` — not destructive schema rollback.

## Central authorization

Module: `lib/promotions/legacyPromotionsAuthorization.ts`

| Concern | Behaviour |
|---------|-----------|
| Write guard | `requireLegacyPromotionsWriteAccess()` — fail-closed on feature lookup errors via `FEATURE_DEFAULTS` |
| Ownership | Ordinary advisers: `created_by === auth user`; admin: all records |
| Client access | `evaluateClientPromotionsAccess()` — dormant fail-closed (empty list) |
| IDOR | Cross-owner reads/mutations return **404** |
| Audit (blocked writes) | `legacy_promotion_write_blocked` with sanitized metadata |

## Mutation routes

All adviser mutations import the centralized write guard:

- `POST /api/advisor/promotions`
- `PATCH /api/advisor/promotions/[promotionId]`
- `POST /api/advisor/promotions/[promotionId]/upload`

Disabled response (HTTP 403):

```json
{
  "error": {
    "code": "LEGACY_PROMOTIONS_WRITE_DISABLED",
    "message": "Legacy Promotions is read-only while content is being migrated."
  }
}
```

## Admin migration (exempt from write freeze)

`POST /api/admin/promotions-migration` remains available to admins with `admin_content_approval` enabled. Fixed classification allowlist; idempotent via `promotion_migration_reviews`.

## Read-only UI

`/advisor/promotions` displays a prominent notice, disables create/edit/publish/archive/upload, and links to `/advisor/insights` (Governed Communications).

## Observation period

Minimum **30 days** after write freeze and active-content migration before route/schema removal (Stage 4+).

## Phase 9F.3 isolation

Binder export, client vault, and lifecycle notifications do not depend on `legacy_promotions_write`.
