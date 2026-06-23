# Phase 9F.3 Final Migration Audit — `202606200010`

**Status:** Release-gate verified (local). **Not applied** to any remote database.

## Chain position

| Property | Value |
|----------|-------|
| Version | `202606200010` (unique — one file) |
| Predecessor | `202606200009` (Phase 9F.2 lifecycle notifications) |
| Historical migrations | Unchanged |
| Nature | Additive DDL + private bucket upsert |

## `binder_exports` columns added

| Column | Type | Null | Default | Purpose |
|--------|------|------|---------|---------|
| `binder_lineage_id` | UUID | NOT NULL (after backfill) | `gen_random_uuid()` | Version lineage grouping |
| `generation_status` | TEXT | NOT NULL | `legacy_manifest` | PDF pipeline state |
| `generation_idempotency_key` | TEXT | NULL | — | Render dedupe |
| `storage_bucket` | TEXT | NULL | `binder-exports` | Private bucket name |
| `file_size_bytes` | BIGINT | NULL | — | PDF size |
| `mime_type` | TEXT | NULL | — | Expected `application/pdf` |
| `content_hash` | TEXT | NULL | — | SHA-256 hex of bytes |
| `generation_error_code` | TEXT | NULL | — | Sanitized failure code |
| `generation_completed_at` | TIMESTAMPTZ | NULL | — | Ready/failed timestamp |
| `published_document_id` | UUID | NULL | — | FK → `documents(id)` ON DELETE SET NULL |
| `supersedes_binder_id` | UUID | NULL | — | FK → `binder_exports(id)` ON DELETE SET NULL |
| `withdrawn_at` | TIMESTAMPTZ | NULL | — | Client withdrawal time |
| `withdrawal_reason` | TEXT | NULL | — | Allowlisted reason |

## CHECK constraints

| Name | Rule |
|------|------|
| `binder_exports_generation_status_check` | `legacy_manifest \| pending \| generating \| ready \| failed` |
| `binder_exports_file_size_nonneg` | `file_size_bytes IS NULL OR > 0` |
| `binder_exports_version_positive` | `version > 0` |
| `binder_exports_mime_pdf` | `mime_type IS NULL OR = application/pdf` |
| `binder_exports_content_hash_shape` | SHA-256 hex when set |
| `binder_exports_published_document_link` | `published_to_client = false OR published_document_id IS NOT NULL` |
| `binder_exports_withdrawn_timestamp` | `status <> withdrawn OR withdrawn_at IS NOT NULL` |
| `binder_exports_ready_requires_artifact` | `ready` requires path, hash, size, PDF MIME |

## Indexes

| Index | Type | Columns / predicate |
|-------|------|---------------------|
| `idx_binder_exports_generation_idempotent` | UNIQUE partial | `generation_idempotency_key` WHERE NOT NULL |
| `idx_binder_exports_lineage_version` | UNIQUE | `(binder_lineage_id, version)` |
| `idx_binder_exports_client_status` | btree | `(client_id, status, created_at DESC)` |
| `idx_binder_exports_client_lineage` | btree | `(client_id, binder_lineage_id, version DESC)` |
| `idx_binder_exports_published_document` | partial | `published_document_id` WHERE NOT NULL |
| `idx_binder_exports_client_published_current` | partial | `(client_id, created_at DESC)` WHERE published |
| `idx_binder_exports_lineage_current_published` | UNIQUE partial | `(binder_lineage_id)` WHERE `published_to_client AND withdrawn_at IS NULL` |

## Storage bucket `binder-exports`

| Property | Value |
|----------|-------|
| `public` | `false` |
| `file_size_limit` | 26,214,400 (25 MiB) |
| `allowed_mime_types` | `['application/pdf']` |
| Creation | `INSERT … ON CONFLICT DO UPDATE` (idempotent) |
| Authenticated policies | **None added** |

## RLS and policies

- `binder_exports` RLS: unchanged (enabled; no new client/adviser policies in this migration)
- No broad authenticated storage policy on `binder-exports`

## Feature controls (dependencies, not modified)

| Key | Expected state |
|-----|----------------|
| `binder_export` | Seeded (Phase 9E) |
| `binder_client_publication` | Seeded, **disabled by default** |
| `document_event_notifications` | Seeded (Phase 9F.2) |

Migration does **not** insert or alter feature-control rows.

## Backfill

- `binder_lineage_id = id` for existing rows before NOT NULL enforcement
- `generation_status` defaults to `legacy_manifest` for existing rows
- Existing manifest rows remain valid

## Rollback order

Documented in `PHASE_9F3_MIGRATION_AND_ROLLBACK.md` — indexes first, then constraints, then columns, then bucket delete (staging only).

## Diagnostic inventory

- **65** resolved checks in `phase9f3_202606200010_resolved_core.sql`
- Preflight: `preflight_202606200010_phase9f3.sql` (probe_id / classification / detail)
- Verify: `verify_202606200010_phase9f3_binder_pdf_client_vault.sql`
- Discrepancies: `verify_202606200010_phase9f3_discrepancies.sql` (parity with verify)

## Release-gate verdict

Migration is **additive**, **idempotent** for bucket upsert, preserves legacy rows, enforces one-current-published-per-lineage, and introduces **no** client-facing storage policies. Safe to apply once preflight reports zero BLOCKER/UNKNOWN on a clean pending state.
