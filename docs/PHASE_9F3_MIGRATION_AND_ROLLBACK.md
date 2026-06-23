# Phase 9F.3 Migration and Rollback

## Migration

**Version:** `202606200010_phase9f3_binder_pdf_client_vault.sql`

### Adds to `binder_exports`

| Column | Type | Purpose |
|--------|------|---------|
| `binder_lineage_id` | UUID NOT NULL | Logical binder lineage (backfill `id` for legacy rows) |
| `generation_status` | TEXT NOT NULL DEFAULT `legacy_manifest` | PDF pipeline state |
| `generation_idempotency_key` | TEXT NULL | Deterministic dedupe for render/upload |
| `storage_bucket` | TEXT DEFAULT `binder-exports` | Private bucket for PDF bytes |
| `file_size_bytes` | BIGINT NULL | Uploaded PDF size |
| `mime_type` | TEXT NULL | Expected `application/pdf` |
| `content_hash` | TEXT NULL | SHA-256 hex of PDF bytes |
| `generation_error_code` | TEXT NULL | Safe error code on failure |
| `generation_completed_at` | TIMESTAMPTZ NULL | Ready/failed timestamp |
| `published_document_id` | UUID NULL FK → documents | Client vault linkage |
| `supersedes_binder_id` | UUID NULL FK → binder_exports | Version lineage |
| `withdrawn_at` | TIMESTAMPTZ NULL | Publication withdrawal |
| `withdrawal_reason` | TEXT NULL | Adviser withdrawal reason |

### Constraints

- `binder_exports_generation_status_check` — `legacy_manifest | pending | generating | ready | failed`
- `binder_exports_version_positive` — `version > 0`
- `binder_exports_file_size_nonneg` — positive file size when set
- `binder_exports_mime_pdf` — PDF MIME only when set
- `binder_exports_content_hash_shape` — SHA-256 hex when set
- `binder_exports_published_document_link` — published rows require `published_document_id`
- `binder_exports_withdrawn_timestamp` — withdrawn rows require `withdrawn_at`
- `binder_exports_ready_requires_artifact` — `ready` requires path, hash, size, MIME

### Indexes

- `idx_binder_exports_generation_idempotent` — UNIQUE on `generation_idempotency_key` WHERE NOT NULL
- `idx_binder_exports_lineage_version` — UNIQUE on `(binder_lineage_id, version)`
- `idx_binder_exports_client_status` — `(client_id, status, created_at DESC)`
- `idx_binder_exports_client_lineage` — `(client_id, binder_lineage_id, version DESC)`
- `idx_binder_exports_published_document` — `(published_document_id)` WHERE NOT NULL
- `idx_binder_exports_client_published_current` — `(client_id, created_at DESC)` WHERE published
- `idx_binder_exports_lineage_current_published` — UNIQUE partial on `(binder_lineage_id)` WHERE `status = 'published_to_client' AND withdrawn_at IS NULL` (Checkpoint 3 — one current published version per lineage)

### Storage

- Bucket `binder-exports` — private, PDF-only, 25 MiB limit
- **No** authenticated storage policies

---

## Safety

- Additive only; existing binder manifest rows remain valid after automatic backfill
- No CHECK changes to existing `status` column enum
- No destructive DDL
- RLS policies unchanged
- Feature controls unchanged (`binder_client_publication` stays disabled)

---

## Rollback (staging only)

Execute in this order:

```sql
DROP INDEX IF EXISTS idx_binder_exports_lineage_current_published;
DROP INDEX IF EXISTS idx_binder_exports_client_published_current;
DROP INDEX IF EXISTS idx_binder_exports_published_document;
DROP INDEX IF EXISTS idx_binder_exports_client_lineage;
DROP INDEX IF EXISTS idx_binder_exports_client_status;
DROP INDEX IF EXISTS idx_binder_exports_lineage_version;
DROP INDEX IF EXISTS idx_binder_exports_generation_idempotent;

ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_ready_requires_artifact;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_withdrawn_timestamp;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_published_document_link;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_content_hash_shape;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_mime_pdf;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_version_positive;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_file_size_nonneg;
ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_generation_status_check;

ALTER TABLE binder_exports
  DROP COLUMN IF EXISTS withdrawal_reason,
  DROP COLUMN IF EXISTS withdrawn_at,
  DROP COLUMN IF EXISTS supersedes_binder_id,
  DROP COLUMN IF EXISTS published_document_id,
  DROP COLUMN IF EXISTS generation_completed_at,
  DROP COLUMN IF EXISTS generation_error_code,
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS mime_type,
  DROP COLUMN IF EXISTS file_size_bytes,
  DROP COLUMN IF EXISTS storage_bucket,
  DROP COLUMN IF EXISTS generation_idempotency_key,
  DROP COLUMN IF EXISTS generation_status,
  DROP COLUMN IF EXISTS binder_lineage_id;

DELETE FROM storage.buckets WHERE id = 'binder-exports';

DELETE FROM supabase_migrations.schema_migrations WHERE version = '202606200010';
```

**Note:** Rollback does not delete storage objects (out of scope). Orphan PDFs may remain in `binder-exports` until manual cleanup.

---

## Apply procedure (staging)

1. Confirm branch `phase-9f3-binder-client-vault`
2. Run `preflight_202606200010_phase9f3.sql` — expect READY probes (no BLOCKER/UNKNOWN)
3. Apply migration on staging only
4. Run `verify_202606200010_phase9f3_binder_pdf_client_vault.sql` — expect `EXACT_MATCH`
5. Run `verify_202606200010_phase9f3_discrepancies.sql` — expect zero rows

---

## Checkpoint 1 (pre-apply)

Dry-run should list `202606200010` as pending. **Do not execute real push during checkpoint 1.**
