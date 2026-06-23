# Phase 9F.4 Checkpoint 3 — Migration API Audit

Audit date: 2026-06-24  
Branch: `phase-9f4-promotion-migration-review`  
Schema baseline: migration `202606200006` (`promotion_migration_reviews`), write freeze `202606200011`

## Executive summary

Checkpoint 3 adds an admin-controlled migration-review workflow. The existing `promotion_migration_reviews` table and Governed Communications persistence are **sufficient**; no migration `202606200012` is required.

The prior Checkpoint 2 route (`POST /api/admin/promotions-migration`) is extended with list/detail/preview/review/migrate endpoints. Migration remains explicit, server-authoritative, and idempotent via `migrated_content_id`.

---

## Classification allowlist

Canonical enum (shared across UI, routes, persistence, audit):

| Value | Draft migration? | Maps to user disposition |
|-------|------------------|--------------------------|
| `safe_educational` | Yes | `migrate_governed_communication` |
| `market_update_review` | Yes | `migrate_governed_communication` |
| `event` | Yes | `migrate_governed_communication` |
| `product_promotional` | Yes | `migrate_governed_communication` |
| `expired` | No (review only) | `retain_historical_only` / `intentionally_obsolete` |
| `unsuitable` | No (review only) | `requires_manual_rewrite` / `duplicate` / `blocked_by_asset_dependency` |

Source: `PROMOTION_MIGRATION_CLASSIFICATIONS` in `lib/communications/types.ts`, re-exported from `lib/promotions/promotionMigrationTypes.ts`. DB CHECK constraint on `promotion_migration_reviews.classification` matches these six values.

Auto-suggestion: `classifyPromotion()` in `lib/communications/legacyPromotionsMigration.ts` (heuristic from category/status/dates). Operator classification overrides suggestion; classification alone never publishes or mutates the source promotion.

Operator notes: `sanitizeOperatorNote()` — HTML stripped, max 500 characters.

---

## Source-to-destination mapping

Pure function: `transformLegacyPromotionToGovernedDraft()` in `lib/promotions/legacyPromotionTransform.ts`.

| Source (`promotions`) | Destination (`governed_content`) | Treatment |
|-----------------------|----------------------------------|-----------|
| `title` | `title` | `stripHtmlTags`, max 120 |
| `summary` | `summary` | `stripHtmlTags`, max 400 |
| `subtitle`, `details.highlights`, `details.eligibility` | `body` | Plain text assembly, max 8000 |
| classification | `category` | `market_update_review` → `market_update`; `event` → `event`; others → `financial_education` |
| category | `content_type` | Via `categoryToContentType()` |
| `audience` | `audience_scope` | Fixed `all_active_clients` (legacy scopes rejected) |
| `cta_url` | `external_url` | Validated via `validateExternalUrl`; expired CTAs omitted |
| `ends_at` | `expires_at` | Passed when present |
| `created_by` | `adviser_user_id` | Preserved for attribution |
| — | `approval_status` | Always `draft` |
| — | `author_user_id` | Migrating admin user ID |

**Rejected / omitted:** `image_url`, `attachment_url`, `audience`, `priority`, `starts_at`, raw HTML, scripts, storage paths, signed URLs, recipient lists, adviser-internal notes, provider metadata.

---

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/promotions-migration` | Paginated list with filters |
| POST | `/api/admin/promotions-migration` | Backward-compatible explicit migrate |
| GET | `/api/admin/promotions-migration/[promotionId]` | Detail + embedded preview |
| GET/POST | `/api/admin/promotions-migration/[promotionId]/preview` | Server-generated preview |
| PATCH | `/api/admin/promotions-migration/[promotionId]/review` | Classification + note (no migrate) |
| POST | `/api/admin/promotions-migration/[promotionId]/migrate` | Explicit migration execution |

Admin UI: `/admin/promotions-migration`

---

## Idempotency mechanism

1. `promotion_migration_reviews.promotion_id` is UNIQUE (migration `202606200007`).
2. Before creating a draft, `executePromotionMigration()` loads existing review row.
3. If `migrated_content_id` is set → return same ID, audit `legacy_promotion_migration_reused`.
4. Review-only classifications (`expired`, `unsuitable`) upsert review without `migrated_content_id`; repeat calls are safe.

**Gap:** If governed content is created but review upsert fails, a retry could create a duplicate draft. Mitigation: manual runbook — link orphaned draft in admin communications; do not alter source. Future hardening: DB transaction or two-phase upsert.

---

## Transaction boundaries

- No single database transaction wraps content creation + review linkage.
- Steps: load source → check idempotency → transform → `dbCreateGovernedContent()` → `promotion_migration_reviews` upsert → audit.
- Source `promotions` row is never updated in this flow.

---

## Governed-content status after creation

`approval_status: "draft"` — unpublished, not client-visible. No schedule row, no notification, no publication event.

Post-migration path: normal `/admin/communications` approval workflow.

---

## Audience mapping

All migrated drafts use `audience_scope: "all_active_clients"`. Legacy `all_users`, raw recipient lists, and client-specific audiences are omitted with a transformation warning.

---

## Asset treatment

See `docs/PHASE_9F4_ASSET_MIGRATION_POLICY.md`. Checkpoint 3 blocks migration when any legacy asset path is present (`migrationBlockedByAssetPolicy`). No asset copy occurs in this checkpoint.

---

## Source linkage

`promotion_migration_reviews.migrated_content_id` → `governed_content.id`. Source promotion row unchanged. Historical audit on source remains available.

---

## Retry behavior

| Scenario | Behavior |
|----------|----------|
| Duplicate migrate POST | Returns existing `contentId`, `reused: true` |
| Migrate after review-only classification | Creates draft only when draft classification selected |
| Asset-blocked promotion | 409 `LEGACY_PROMOTION_ASSET_BLOCKED` |
| Invalid/forged promotion ID | 404 (no existence leak beyond policy) |
| Non-admin / no `admin_content_approval` | 401/403 |

---

## Partial-failure risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Draft created, review upsert fails | Medium | Runbook: locate draft in communications admin; manually note promotion ID |
| In-memory list pagination at scale | Low | Acceptable for CP3; SQL pagination deferred |
| Concurrent double-migrate | Low | UNIQUE on `promotion_id`; second request may race before `migrated_content_id` set |

---

## Authorization boundaries

- `requirePromotionMigrationAdminAccess()`: `requireAdminAccess()` + `admin_content_approval` feature flag.
- Adviser routes (`/api/advisor/promotions/*`) unchanged; write guard + ownership enforced.
- Client route (`/api/promotions`) unchanged; entitlement-scoped read.
- Responses use `privatePromotionJson` (`Cache-Control: private, no-store`).
- Safe DTOs exclude: bucket paths, signed URLs, raw audience, client data, service-role details, source/destination bodies in audit metadata.
- Browser cannot supply destination IDs or arbitrary tables.

---

## Audit actions

| Action | When |
|--------|------|
| `legacy_promotion_migration_reviewed` | PATCH review / classification saved |
| `legacy_promotion_migration_started` | POST migrate (route layer) |
| `legacy_promotion_migration_completed` | Successful migrate or review-only completion |
| `legacy_promotion_migration_failed` | Asset block or unhandled error |
| `legacy_promotion_migration_reused` | Idempotent retry with existing destination |

Forbidden in metadata: source body, destination body, storage paths, signed URLs, raw audience lists, client data, raw exception messages.

---

## Schema sufficiency

`promotion_migration_reviews` columns used: `promotion_id`, `classification`, `migrated_content_id`, `reviewed_by_user_id`, `reviewed_at`, `notes`.

**Verdict: migration `202606200012` NOT required for Checkpoint 3.**
