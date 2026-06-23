# Phase 9F.4 — Asset Migration Policy (Checkpoint 3)

## Purpose

Define how legacy promotion assets (`image_url`, `attachment_url`) affect controlled migration into Governed Communications. Checkpoint 3 does **not** copy legacy bucket assets.

## Asset status classifications

| Status | Condition | Migration allowed? |
|--------|-----------|-------------------|
| `no_asset` | No `image_url` and no `attachment_url` | Yes (subject to classification) |
| `manual_review_required` | Image present (with or without attachment in some cases) | **No** — blocked |
| `unsupported` | Attachment present | **No** — blocked |
| `copy_required` | Reserved — would apply when secure copy helper exists | **No** in CP3 |
| `existing_governed_reference` | Reserved — governed asset already linked | **No** in CP3 |

Implementation: `classifyPromotionAssetStatus()` and `migrationBlockedByAssetPolicy()` in `lib/promotions/promotionAssetPolicy.ts`.

## Blocking rule

When `migrationBlockedByAssetPolicy(assetStatus)` is true:

- Migration returns HTTP 409 with code `LEGACY_PROMOTION_ASSET_BLOCKED`.
- Admin should classify as `unsuitable` and record operator note, or handle assets manually outside this workflow.
- UI displays server `blockReason` in preview panel; migrate button disabled.

## Mapping to classification disposition

| User disposition | Recommended classification |
|------------------|---------------------------|
| `blocked_by_asset_dependency` | `unsuitable` + operator note referencing asset status |
| Manual rewrite after asset handling | `unsuitable` until assets resolved, then re-review |

## Preconditions for future automatic copy

Asset copy must **not** be enabled until a helper guarantees:

1. Private source access (service role, no public URL)
2. MIME allowlist
3. Size limit
4. Sanitized filename
5. Private destination bucket
6. Content hash / deterministic idempotent destination key
7. No source deletion
8. No public signed URL in governed payload

Until then, any promotion with legacy asset paths remains blocked for automatic draft creation.

## Source preservation

Asset policy evaluation reads source paths only for classification. It does not delete, move, or mutate `image_url` / `attachment_url` on the source promotion.

## Admin UI messaging

- List view: `hasAssets` + `assetStatus` indicator (not raw paths).
- Detail preview: `assetStatus`, `migrationBlocked`, `blockReason`.
- Migrate action disabled when `migrationBlocked` is true.
