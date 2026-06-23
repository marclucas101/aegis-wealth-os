-- Phase 9F.3 — binder PDF generation schema and private binder-exports storage
-- Additive only. Do not apply to production without staging validation.

-- ---------------------------------------------------------------------------
-- binder_exports — PDF generation, lineage, publication linkage, immutability
-- ---------------------------------------------------------------------------
ALTER TABLE binder_exports
  ADD COLUMN IF NOT EXISTS binder_lineage_id UUID,
  ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'legacy_manifest',
  ADD COLUMN IF NOT EXISTS generation_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'binder-exports',
  ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS generation_error_code TEXT,
  ADD COLUMN IF NOT EXISTS generation_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supersedes_binder_id UUID REFERENCES binder_exports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT;

-- Backfill lineage: each existing row is its own lineage root (no version collision).
UPDATE binder_exports
SET binder_lineage_id = id
WHERE binder_lineage_id IS NULL;

ALTER TABLE binder_exports
  ALTER COLUMN binder_lineage_id SET NOT NULL,
  ALTER COLUMN binder_lineage_id SET DEFAULT gen_random_uuid();

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_generation_status_check;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_generation_status_check CHECK (
    generation_status IN ('legacy_manifest', 'pending', 'generating', 'ready', 'failed')
  );

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_file_size_nonneg;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_file_size_nonneg CHECK (
    file_size_bytes IS NULL OR file_size_bytes > 0
  );

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_version_positive;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_version_positive CHECK (version > 0);

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_mime_pdf;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_mime_pdf CHECK (
    mime_type IS NULL OR mime_type = 'application/pdf'
  );

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_content_hash_shape;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_content_hash_shape CHECK (
    content_hash IS NULL OR content_hash ~ '^[a-f0-9]{64}$'
  );

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_published_document_link;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_published_document_link CHECK (
    published_to_client = false OR published_document_id IS NOT NULL
  );

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_withdrawn_timestamp;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_withdrawn_timestamp CHECK (
    status <> 'withdrawn' OR withdrawn_at IS NOT NULL
  );

ALTER TABLE binder_exports
  DROP CONSTRAINT IF EXISTS binder_exports_ready_requires_artifact;

ALTER TABLE binder_exports
  ADD CONSTRAINT binder_exports_ready_requires_artifact CHECK (
    generation_status <> 'ready'
    OR (
      storage_path IS NOT NULL
      AND content_hash IS NOT NULL
      AND file_size_bytes IS NOT NULL
      AND mime_type = 'application/pdf'
    )
  );

COMMENT ON COLUMN binder_exports.binder_lineage_id IS
  'Phase 9F.3 logical binder lineage — groups immutable version rows.';

COMMENT ON COLUMN binder_exports.generation_status IS
  'Phase 9F.3 PDF pipeline: legacy_manifest | pending | generating | ready | failed.';

COMMENT ON COLUMN binder_exports.generation_idempotency_key IS
  'Phase 9F.3 SHA-256 hex digest of canonical generation tuple — prevents duplicate PDF renders.';

COMMENT ON COLUMN binder_exports.storage_bucket IS
  'Phase 9F.3 private bucket for immutable PDF bytes (default binder-exports).';

COMMENT ON COLUMN binder_exports.content_hash IS
  'Phase 9F.3 SHA-256 hex digest of uploaded PDF bytes for integrity verification.';

COMMENT ON COLUMN binder_exports.published_document_id IS
  'Phase 9F.3 client vault documents row when binder is published to client.';

COMMENT ON COLUMN binder_exports.supersedes_binder_id IS
  'Phase 9F.3 prior binder_export row superseded by this generation.';

COMMENT ON TABLE binder_exports IS
  'Phase 9E/9F.3 adviser binder exports. PDF bytes in binder-exports bucket; client access via published documents row.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_binder_exports_generation_idempotent
  ON binder_exports (generation_idempotency_key)
  WHERE generation_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_binder_exports_lineage_version
  ON binder_exports (binder_lineage_id, version);

CREATE INDEX IF NOT EXISTS idx_binder_exports_client_status
  ON binder_exports (client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_binder_exports_client_lineage
  ON binder_exports (client_id, binder_lineage_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_binder_exports_published_document
  ON binder_exports (published_document_id)
  WHERE published_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_binder_exports_client_published_current
  ON binder_exports (client_id, created_at DESC)
  WHERE status = 'published_to_client' AND published_document_id IS NOT NULL;

-- One current published binder per lineage (supersession safety).
CREATE UNIQUE INDEX IF NOT EXISTS idx_binder_exports_lineage_current_published
  ON binder_exports (binder_lineage_id)
  WHERE status = 'published_to_client' AND withdrawn_at IS NULL;

-- ---------------------------------------------------------------------------
-- binder-exports storage bucket (private — service-role upload/read only)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'binder-exports',
  'binder-exports',
  false,
  26214400,  -- 25 MiB per PDF
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Rollback (manual, staging only):
-- DROP INDEX IF EXISTS idx_binder_exports_lineage_current_published;
-- DROP INDEX IF EXISTS idx_binder_exports_published_document;
-- DROP INDEX IF EXISTS idx_binder_exports_client_lineage;
-- DROP INDEX IF EXISTS idx_binder_exports_client_status;
-- DROP INDEX IF EXISTS idx_binder_exports_lineage_version;
-- DROP INDEX IF EXISTS idx_binder_exports_generation_idempotent;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_ready_requires_artifact;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_withdrawn_timestamp;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_published_document_link;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_content_hash_shape;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_mime_pdf;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_version_positive;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_file_size_nonneg;
-- ALTER TABLE binder_exports DROP CONSTRAINT IF EXISTS binder_exports_generation_status_check;
-- ALTER TABLE binder_exports
--   DROP COLUMN IF EXISTS withdrawal_reason,
--   DROP COLUMN IF EXISTS withdrawn_at,
--   DROP COLUMN IF EXISTS supersedes_binder_id,
--   DROP COLUMN IF EXISTS published_document_id,
--   DROP COLUMN IF EXISTS generation_completed_at,
--   DROP COLUMN IF EXISTS generation_error_code,
--   DROP COLUMN IF EXISTS content_hash,
--   DROP COLUMN IF EXISTS mime_type,
--   DROP COLUMN IF EXISTS file_size_bytes,
--   DROP COLUMN IF EXISTS storage_bucket,
--   DROP COLUMN IF EXISTS generation_idempotency_key,
--   DROP COLUMN IF EXISTS generation_status,
--   DROP COLUMN IF EXISTS binder_lineage_id;
-- DELETE FROM storage.buckets WHERE id = 'binder-exports';
