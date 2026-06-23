# Phase 9F.4 — Legacy Read-Only Policy

## When `legacy_promotions_write = false` (default)

### Advisers

- May list and view **own** promotions (historical reference).
- May not create, edit, publish, unpublish, archive, or upload assets.
- UI shows read-only notice with link to Governed Communications (`/advisor/insights`).

### Admins

- May list **all** promotions for migration review.
- May use `GET/POST /api/admin/promotions-migration` (separate admin authorization).
- May not use legacy adviser mutation routes without enabling `legacy_promotions_write`.

### Clients

- `GET /api/promotions` requires authenticated **client** role.
- Requires `promotions` client entitlement **and** `product_related_content` platform flag (both client-visible).
- **Current production posture:** `promotions` entitlement is hardcoded `false` for active clients → API returns `{ ok: true, promotions: [] }` (fail-closed, no firm-wide leak).
- When explicitly enabled in a future operator decision, only **published, active, non-expired** rows are returned in a bounded, client-safe schema (no `createdBy`, paths, or internal fields).

### Data retention

- No promotion rows, buckets, or migration-review records are deleted in this checkpoint.
- `promotion-assets` bucket retained for observation period.

## When `legacy_promotions_write = true` (emergency rollback only)

- Legacy adviser mutations function with ownership enforcement.
- Does not restore firm-wide client exposure — client policy unchanged.

## Language (UI)

> Legacy Promotions is now read-only. New client communications should be created through Governed Communications.
