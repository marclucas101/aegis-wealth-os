-- Read-only preflight before 202606200010_phase9f3_binder_pdf_client_vault.sql
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail.

WITH refs AS (
  SELECT
    to_regclass('public.binder_exports') IS NOT NULL AS binder_exports_exists,
    to_regclass('public.documents') IS NOT NULL AS documents_exists,
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations'
        AND c.relname = 'schema_migrations'
        AND c.relkind IN ('r', 'p')
    ) AS history_table_exists
),
column_probe AS (
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'binder_exports' AND column_name = 'generation_status'
    ) AS generation_status_exists,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'binder_exports' AND column_name = 'binder_lineage_id'
    ) AS binder_lineage_id_exists,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'binder_exports' AND column_name = 'generation_idempotency_key'
    ) AS generation_idempotency_key_exists,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'binder_exports' AND column_name = 'published_document_id'
    ) AS published_document_id_exists
),
index_probe AS (
  SELECT
    to_regclass('public.idx_binder_exports_generation_idempotent') IS NOT NULL AS generation_idempotent_index_exists,
    to_regclass('public.idx_binder_exports_lineage_version') IS NOT NULL AS lineage_version_index_exists,
    to_regclass('public.idx_binder_exports_client_status') IS NOT NULL AS client_status_index_exists,
    to_regclass('public.idx_binder_exports_published_document') IS NOT NULL AS published_document_index_exists,
    to_regclass('public.idx_binder_exports_lineage_current_published') IS NOT NULL AS lineage_current_published_index_exists
),
bucket_probe AS (
  SELECT
    EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'binder-exports') AS binder_exports_bucket_exists,
    (SELECT public::text FROM storage.buckets WHERE id = 'binder-exports' LIMIT 1) AS binder_exports_bucket_public
),
feature_seed AS (
  SELECT
    CASE WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'binder_export') END AS binder_export_seed_present,
    CASE WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'binder_client_publication') END AS binder_publication_seed_present,
    CASE WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'document_event_notifications') END AS document_notifications_seed_present
),
rls_probe AS (
  SELECT
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::boolean
      ELSE (
        SELECT c.relrowsecurity FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'binder_exports'
      ) END AS rls_enabled
),
data_quality AS (
  SELECT
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM (
          SELECT key_value
          FROM (
            SELECT NULLIF(to_jsonb(be) ->> 'generation_idempotency_key', '') AS key_value
            FROM public.binder_exports be
          ) values_safe
          WHERE key_value IS NOT NULL
          GROUP BY key_value
          HAVING count(*) > 1
        ) d
      ) END AS duplicate_idempotency_keys,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE be.status NOT IN ('generated', 'published_to_client', 'withdrawn')
      ) END AS invalid_binder_status_rows,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM (
          SELECT lineage_id, version_num
          FROM (
            SELECT
              NULLIF(to_jsonb(be) ->> 'binder_lineage_id', '') AS lineage_id,
              be.version AS version_num
            FROM public.binder_exports be
          ) values_safe
          WHERE lineage_id IS NOT NULL
          GROUP BY lineage_id, version_num
          HAVING count(*) > 1
        ) d
      ) END AS duplicate_lineage_version_rows,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      WHEN NOT (SELECT documents_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE NULLIF(to_jsonb(be) ->> 'published_document_id', '') IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id::text = (to_jsonb(be) ->> 'published_document_id')
          )
      ) END AS invalid_published_document_refs,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE be.storage_path IS NOT NULL
          AND be.storage_path !~ '^clients/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/binders/'
          AND be.storage_path !~ '^binders/[0-9a-f]{8}-'
      ) END AS non_canonical_storage_paths,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE to_jsonb(be) ->> 'generation_status' = 'ready'
          AND (
            to_jsonb(be) ->> 'content_hash' IS NULL
            OR to_jsonb(be) ->> 'file_size_bytes' IS NULL
            OR to_jsonb(be) ->> 'mime_type' IS DISTINCT FROM 'application/pdf'
          )
      ) END AS ready_rows_missing_artifact,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM (
          SELECT lineage_id
          FROM (
            SELECT NULLIF(to_jsonb(be) ->> 'binder_lineage_id', '') AS lineage_id
            FROM public.binder_exports be
            WHERE to_jsonb(be) ->> 'status' = 'published_to_client'
              AND (to_jsonb(be) ->> 'withdrawn_at') IS NULL
          ) values_safe
          WHERE lineage_id IS NOT NULL
          GROUP BY lineage_id
          HAVING count(*) > 1
        ) d
      ) END AS duplicate_current_published_per_lineage,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE NULLIF(to_jsonb(be) ->> 'content_hash', '') IS NOT NULL
          AND NULLIF(to_jsonb(be) ->> 'content_hash', '') !~ '^[a-f0-9]{64}$'
      ) END AS malformed_content_hashes,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE NULLIF(to_jsonb(be) ->> 'mime_type', '') IS NOT NULL
          AND NULLIF(to_jsonb(be) ->> 'mime_type', '') <> 'application/pdf'
      ) END AS invalid_mime_types,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE NULLIF(to_jsonb(be) ->> 'file_size_bytes', '') IS NOT NULL
          AND (to_jsonb(be) ->> 'file_size_bytes')::bigint <= 0
      ) END AS non_positive_file_sizes,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*) FROM public.binder_exports be
        WHERE to_jsonb(be) ->> 'status' = 'withdrawn'
          AND (to_jsonb(be) ->> 'withdrawn_at') IS NULL
      ) END AS withdrawn_rows_missing_timestamp
),
probes (probe_id, classification, detail) AS (
  SELECT 'prerequisites.binder_exports'::text AS probe_id,
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN 'BLOCKER' ELSE 'READY' END,
    'binder_exports must exist from Phase 9E before applying PDF columns'
  UNION ALL
  SELECT 'prerequisites.documents',
    CASE WHEN NOT (SELECT documents_exists FROM refs) THEN 'BLOCKER' ELSE 'READY' END,
    'documents table required for published_document_id FK'
  UNION ALL
  SELECT 'prerequisites.migration_202606200009',
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200009') THEN 'WARNING'
      ELSE 'READY' END,
    'Phase 9F.2 lifecycle notifications should be applied before 9F.3 binder PDF'
  UNION ALL
  SELECT 'prerequisites.binder_feature_controls',
    CASE WHEN (SELECT binder_export_seed_present FROM feature_seed) IS NULL THEN 'UNKNOWN'
      WHEN (SELECT binder_export_seed_present FROM feature_seed)
        AND (SELECT binder_publication_seed_present FROM feature_seed)
        AND (SELECT document_notifications_seed_present FROM feature_seed) THEN 'READY'
      ELSE 'WARNING' END,
    'binder_export, binder_client_publication and document_event_notifications seeds expected from Phase 9E/9F.2'
  UNION ALL
  SELECT 'schema.generation_columns_absent',
    CASE WHEN NOT (SELECT binder_exports_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT generation_status_exists FROM column_probe) OR (SELECT binder_lineage_id_exists FROM column_probe)
        OR (SELECT generation_idempotency_key_exists FROM column_probe) OR (SELECT published_document_id_exists FROM column_probe) THEN 'WARNING'
      ELSE 'READY' END,
    'Expected migration-owned columns absent before first apply'
  UNION ALL
  SELECT 'schema.generation_indexes_absent',
    CASE WHEN (SELECT generation_idempotent_index_exists FROM index_probe)
        OR (SELECT lineage_version_index_exists FROM index_probe)
        OR (SELECT client_status_index_exists FROM index_probe)
        OR (SELECT published_document_index_exists FROM index_probe)
        OR (SELECT lineage_current_published_index_exists FROM index_probe) THEN 'WARNING'
      ELSE 'READY' END,
    'Expected generation indexes absent before first apply'
  UNION ALL
  SELECT 'schema.lineage_current_index_without_column',
    CASE WHEN (SELECT lineage_current_published_index_exists FROM index_probe)
        AND NOT (SELECT binder_lineage_id_exists FROM column_probe) THEN 'BLOCKER'
      ELSE 'READY' END,
    'Lineage current-published index without binder_lineage_id indicates partial apply'
  UNION ALL
  SELECT 'schema.index_name_conflict',
    CASE WHEN (SELECT generation_idempotent_index_exists FROM index_probe)
        AND NOT (SELECT generation_idempotency_key_exists FROM column_probe) THEN 'BLOCKER'
      ELSE 'READY' END,
    'Index exists without generation_idempotency_key column indicates incompatible partial apply'
  UNION ALL
  SELECT 'schema.lineage_index_without_column',
    CASE WHEN (SELECT lineage_version_index_exists FROM index_probe)
        AND NOT (SELECT binder_lineage_id_exists FROM column_probe) THEN 'BLOCKER'
      ELSE 'READY' END,
    'Lineage version index without binder_lineage_id column indicates partial apply'
  UNION ALL
  SELECT 'data.duplicate_generation_idempotency',
    CASE WHEN (SELECT duplicate_idempotency_keys FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT duplicate_idempotency_keys FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'Duplicate non-null generation_idempotency_key values would violate unique index'
  UNION ALL
  SELECT 'data.duplicate_lineage_version',
    CASE WHEN (SELECT duplicate_lineage_version_rows FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT duplicate_lineage_version_rows FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'Duplicate (binder_lineage_id, version) pairs would violate unique index'
  UNION ALL
  SELECT 'data.invalid_binder_status',
    CASE WHEN (SELECT invalid_binder_status_rows FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT invalid_binder_status_rows FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'Existing binder_exports.status must be generated, published_to_client, or withdrawn'
  UNION ALL
  SELECT 'data.invalid_published_document_refs',
    CASE WHEN (SELECT invalid_published_document_refs FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT invalid_published_document_refs FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'published_document_id must reference existing documents rows when set'
  UNION ALL
  SELECT 'data.non_canonical_storage_paths',
    CASE WHEN (SELECT non_canonical_storage_paths FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT non_canonical_storage_paths FROM data_quality) = 0 THEN 'READY'
      ELSE 'WARNING' END,
    'Legacy placeholder paths (binders/{clientId}/...) are expected pre-migration; canonical 9F.3 paths use clients/{clientId}/binders/'
  UNION ALL
  SELECT 'data.ready_rows_missing_artifact',
    CASE WHEN (SELECT ready_rows_missing_artifact FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT ready_rows_missing_artifact FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'Rows with generation_status=ready must have PDF artifact metadata before migration constraints apply'
  UNION ALL
  SELECT 'data.duplicate_current_published_per_lineage',
    CASE WHEN (SELECT duplicate_current_published_per_lineage FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT duplicate_current_published_per_lineage FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'More than one current published_to_client row per lineage would violate unique index'
  UNION ALL
  SELECT 'data.malformed_content_hashes',
    CASE WHEN (SELECT malformed_content_hashes FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT malformed_content_hashes FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'content_hash must be lowercase SHA-256 hex when set'
  UNION ALL
  SELECT 'data.invalid_mime_types',
    CASE WHEN (SELECT invalid_mime_types FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT invalid_mime_types FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'mime_type must be application/pdf when set'
  UNION ALL
  SELECT 'data.non_positive_file_sizes',
    CASE WHEN (SELECT non_positive_file_sizes FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT non_positive_file_sizes FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'file_size_bytes must be positive when set'
  UNION ALL
  SELECT 'data.withdrawn_rows_missing_timestamp',
    CASE WHEN (SELECT withdrawn_rows_missing_timestamp FROM data_quality) IS NULL THEN 'READY'
      WHEN (SELECT withdrawn_rows_missing_timestamp FROM data_quality) = 0 THEN 'READY'
      ELSE 'BLOCKER' END,
    'status=withdrawn requires withdrawn_at before migration constraint applies'
  UNION ALL
  SELECT 'storage.binder_exports_bucket_absent',
    CASE WHEN (SELECT binder_exports_bucket_exists FROM bucket_probe) THEN 'WARNING' ELSE 'READY' END,
    'binder-exports bucket should not exist before first apply (or will be upserted)'
  UNION ALL
  SELECT 'storage.binder_exports_bucket_not_public',
    CASE WHEN NOT (SELECT binder_exports_bucket_exists FROM bucket_probe) THEN 'READY'
      WHEN (SELECT binder_exports_bucket_public FROM bucket_probe) = 'false' THEN 'READY'
      ELSE 'BLOCKER' END,
    'If binder-exports bucket pre-exists it must remain private'
  UNION ALL
  SELECT 'rls.binder_exports_enabled',
    CASE WHEN (SELECT rls_enabled FROM rls_probe) IS NULL THEN 'UNKNOWN'
      WHEN (SELECT rls_enabled FROM rls_probe) THEN 'READY'
      ELSE 'BLOCKER' END,
    'binder_exports RLS must remain enabled'
  UNION ALL
  SELECT 'history.duplicate_migration_entry',
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200010') THEN 'BLOCKER'
      ELSE 'READY' END,
    'Migration version must not already be recorded'
  UNION ALL
  SELECT 'history.pending_migration',
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200010') THEN 'BLOCKER'
      ELSE 'READY' END,
    'Expected pending state before apply'
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
