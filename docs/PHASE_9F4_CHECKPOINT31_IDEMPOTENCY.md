# Phase 9F.4 Checkpoint 3.1 — Migration Idempotency Audit

## Risk addressed

Prior Checkpoint 3 flow created `governed_content` then upserted `promotion_migration_reviews` in separate application calls. A failure after draft creation could orphan a destination with no linkage; retries could create duplicate drafts.

## Existing capabilities audited

| Asset | Finding |
|-------|---------|
| `governed_content` | No source-reference or idempotency column; `id` is UUID PK |
| `promotion_migration_reviews` | `UNIQUE(promotion_id)`; `migrated_content_id` FK to governed_content |
| `dbCreateGovernedContent` | Random `gen_random_uuid()` id; no transaction wrapper |
| Application `.rpc()` usage | None before 3.1 |
| Unique indexes | Review row per promotion only — insufficient for orphan recovery alone |

No existing indexed field could store `legacy_promotion:<promotionId>` without a new migration.

## Selected design

**Option A + B:** Additive migration `202606200012` with:

1. `legacy_promotion_migration_destination_id(promotion_id)` — deterministic UUID v5
2. `execute_legacy_promotion_migration(...)` — `SECURITY DEFINER` single transaction:
   - `pg_advisory_xact_lock` per promotion (concurrency)
   - `SELECT ... FOR UPDATE` on review row
   - `INSERT governed_content` with deterministic id `ON CONFLICT (id) DO NOTHING`
   - Upsert `promotion_migration_reviews.migrated_content_id`
   - Verify linkage before success

TypeScript mirrors UUID v5 in `lib/promotions/promotionMigrationIdempotency.ts` for tests and observability.

## Stable outcomes

| Outcome | Meaning |
|---------|---------|
| `created` | New draft + linkage in one transaction |
| `already_migrated` | Review already linked; same destination returned |
| `reused` | Concurrent-safe reuse of deterministic destination |
| `recovered_orphan` | Draft existed without linkage; linkage repaired |
| `review_only` | `expired` / `unsuitable` — no draft |
| `conflict` | Linkage points to unexpected destination |
| `failed` | RPC/validation/linkage failure — not reported as success |

## Concurrency guarantee

`pg_advisory_xact_lock(hashtext('legacy_promotion_migration:' || promotion_id))` plus `FOR UPDATE` on the review row ensures one transaction at a time per promotion. Combined with deterministic `governed_content.id`, concurrent callers converge on the same destination.

## Orphan recovery

If a draft exists at the deterministic id but `migrated_content_id` is null, the RPC links the review without inserting a second row (`recovered_orphan`).

## Audit actions

- `legacy_promotion_migration_orphan_recovered`
- `legacy_promotion_migration_reused`
- `legacy_promotion_migration_completed`
- `legacy_promotion_migration_failed`

## Migration required

**Yes — `202606200012_phase9f4_promotion_migration_idempotency.sql`** (additive RPC only; no data mutation).

Apply to remote before production promotion migration.
