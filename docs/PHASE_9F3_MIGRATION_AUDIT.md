# Phase 9F.3 Migration Audit — `202606200010`

## Version and ordering

| Field | Value |
|-------|-------|
| Version | `202606200010` |
| Filename | `202606200010_phase9f3_binder_pdf_client_vault.sql` |
| Predecessor | `202606200009_phase9f2_lifecycle_notifications.sql` |
| Unique | Yes — no other migration uses `202606200010` |
| Historical migrations modified | None |

---

## Objects changed

Migration alters existing table `binder_exports` and seeds storage bucket `binder-exports`. No new public tables. No destructive DDL.

### Columns added to `binder_exports`

| Column | Type | Nullable | Default | Constraint |
|--------|------|----------|---------|------------|
| `binder_lineage_id` | `UUID` | NO | `gen_random_uuid()` | Backfill: `id` for existing rows |
| `generation_status` | `TEXT` | NO | `'legacy_manifest'` | CHECK: `legacy_manifest`, `pending`, `generating`, `ready`, `failed` |
| `generation_idempotency_key` | `TEXT` | YES | none | partial unique index |
| `storage_bucket` | `TEXT` | YES | `'binder-exports'` | none |
| `file_size_bytes` | `BIGINT` | YES | none | CHECK `> 0` when not null |
| `mime_type` | `TEXT` | YES | none | CHECK `application/pdf` when not null |
| `content_hash` | `TEXT` | YES | none | CHECK SHA-256 hex shape when not null |
| `generation_error_code` | `TEXT` | YES | none | sanitized application code |
| `generation_completed_at` | `TIMESTAMPTZ` | YES | none | none |
| `published_document_id` | `UUID` | YES | none | FK → `documents(id)` ON DELETE SET NULL |
| `supersedes_binder_id` | `UUID` | YES | none | FK → `binder_exports(id)` ON DELETE SET NULL |
| `withdrawn_at` | `TIMESTAMPTZ` | YES | none | required when `status = withdrawn` |
| `withdrawal_reason` | `TEXT` | YES | none | none |

All columns use `ADD COLUMN IF NOT EXISTS` — safe re-run on staging.

**Legacy rows — backfill required:** Migration runs `UPDATE binder_exports SET binder_lineage_id = id WHERE binder_lineage_id IS NULL` before `NOT NULL` enforcement. Each pre-9F.3 row becomes its own lineage root at `version = 1`. Default `generation_status = 'legacy_manifest'` preserves manifest-only exports without implying a PDF exists. **No manual operator backfill is required** beyond applying the migration.

### Indexes added

| Index | Type | Columns | Predicate |
|-------|------|---------|-----------|
| `idx_binder_exports_generation_idempotent` | UNIQUE | `generation_idempotency_key` | `WHERE generation_idempotency_key IS NOT NULL` |
| `idx_binder_exports_lineage_version` | UNIQUE | `binder_lineage_id, version` | none |
| `idx_binder_exports_client_status` | non-unique | `client_id, status, created_at DESC` | none |
| `idx_binder_exports_client_lineage` | non-unique | `client_id, binder_lineage_id, version DESC` | none |
| `idx_binder_exports_published_document` | non-unique | `published_document_id` | `WHERE published_document_id IS NOT NULL` |
Migration `202606200010` also adds:

| Index | Purpose |
|-------|---------|
| `idx_binder_exports_lineage_current_published` | UNIQUE partial — one `published_to_client` row per lineage (Checkpoint 3) |

Existing Phase 9E indexes preserved:

- `idx_binder_exports_client`
- `idx_binder_exports_adviser`

### Constraints added

| Constraint | Definition |
|------------|------------|
| `binder_exports_generation_status_check` | Includes `generating` and `legacy_manifest` |
| `binder_exports_version_positive` | `version > 0` |
| `binder_exports_file_size_nonneg` | `file_size_bytes IS NULL OR file_size_bytes > 0` |
| `binder_exports_mime_pdf` | `mime_type IS NULL OR mime_type = 'application/pdf'` |
| `binder_exports_content_hash_shape` | SHA-256 hex regex when not null |
| `binder_exports_published_document_link` | `published_to_client = false OR published_document_id IS NOT NULL` |
| `binder_exports_withdrawn_timestamp` | `status <> 'withdrawn' OR withdrawn_at IS NOT NULL` |
| `binder_exports_ready_requires_artifact` | `ready` requires path, hash, size, MIME |

Existing `binder_exports_status_check` unchanged (`generated`, `published_to_client`, `withdrawn`).

### Storage bucket

| Property | Value |
|----------|-------|
| `id` | `binder-exports` |
| `public` | `false` |
| `file_size_limit` | `26214400` (25 MiB) |
| `allowed_mime_types` | `{application/pdf}` |
| `storage.objects` policies | **None** (service-role only) |

`ON CONFLICT (id) DO UPDATE` idempotently enforces private bucket attributes.

### Comments

| Object | Comment marker |
|--------|----------------|
| `binder_exports.generation_status` | Phase 9F.3 |
| `binder_exports.generation_idempotency_key` | Phase 9F.3 SHA-256 |
| `binder_exports.content_hash` | Phase 9F.3 integrity |
| `binder_exports.published_document_id` | Phase 9F.3 vault link |
| `binder_exports.supersedes_binder_id` | Phase 9F.3 lineage |
| `binder_exports` (table) | Phase 9E/9F.3 |

### RLS impact

**No policy changes.** Migration does not `CREATE POLICY`, `DROP POLICY`, or `ALTER POLICY`.

Existing posture from `202606200006`:

- `binder_exports` RLS enabled; no client/adviser policies — service-role API only.

### Feature-control dependency

Reuses existing seeds from `202606200006`:

- `binder_export` (`enabled: true`)
- `binder_client_publication` (`enabled: false`)

Migration 010 does **not** seed, enable, or alter feature control values.

### Existing-row compatibility

| Scenario | Outcome |
|----------|---------|
| Pre-010 binder rows | `generation_status = legacy_manifest`; nullable file metadata |
| NULL `generation_idempotency_key` | Allowed — partial unique index excludes NULL |
| `published_document_id` NULL | Unpublished binders unchanged |
| Placeholder `storage_path` | Remains; application replaces on next PDF generation |

### Sensitive data

Migration does not store PDF content, PII, or signed URLs in schema. `content_hash` is application-populated SHA-256 hex only.

### Destructive operations

None. No `DROP`, `TRUNCATE`, or column drops in forward migration.

---

## Diagnostic inventory

| File | Purpose |
|------|---------|
| `preflight_202606200010_phase9f3.sql` | Pre-apply readiness probes |
| `verify_202606200010_phase9f3_binder_pdf_client_vault.sql` | Post-apply schema verification + rollup |
| `verify_202606200010_phase9f3_discrepancies.sql` | Discrepancy-only view |
| `phase9f3_202606200010_resolved_core.sql` | Shared inventory CTE |

**Expected check count:** 62 required checks → rollup `EXACT_MATCH` when all present.

---

## Verdict

Migration is additive, ordering-correct, and compatible with existing binder manifest rows. Safe to apply after Phase 9F.2 (`202606200009`) on staging. **Do not push to remote during implementation.**
