-- Shared resolved inventory for Phase 9F.3 diagnostics.
-- Included verbatim in verify and discrepancy SQL files between PHASE9F3_RESOLVED_CORE markers.

expected AS (
  SELECT * FROM (VALUES
    ('202606200010','column','binder_exports','binder_lineage_id'),
    ('202606200010','column','binder_exports','generation_status'),
    ('202606200010','column','binder_exports','generation_idempotency_key'),
    ('202606200010','column','binder_exports','storage_bucket'),
    ('202606200010','column','binder_exports','file_size_bytes'),
    ('202606200010','column','binder_exports','mime_type'),
    ('202606200010','column','binder_exports','content_hash'),
    ('202606200010','column','binder_exports','generation_error_code'),
    ('202606200010','column','binder_exports','generation_completed_at'),
    ('202606200010','column','binder_exports','published_document_id'),
    ('202606200010','column','binder_exports','supersedes_binder_id'),
    ('202606200010','column','binder_exports','withdrawn_at'),
    ('202606200010','column','binder_exports','withdrawal_reason'),
    ('202606200010','column_attr','binder_exports.binder_lineage_id','data_type|uuid'),
    ('202606200010','column_attr','binder_exports.binder_lineage_id','is_nullable|NO'),
    ('202606200010','column_attr','binder_exports.generation_status','data_type|text'),
    ('202606200010','column_attr','binder_exports.generation_status','is_nullable|NO'),
    ('202606200010','column_attr','binder_exports.generation_status','default|legacy_manifest'),
    ('202606200010','column_attr','binder_exports.generation_idempotency_key','data_type|text'),
    ('202606200010','column_attr','binder_exports.generation_idempotency_key','is_nullable|YES'),
    ('202606200010','column_attr','binder_exports.storage_bucket','data_type|text'),
    ('202606200010','column_attr','binder_exports.storage_bucket','default|binder-exports'),
    ('202606200010','column_attr','binder_exports.published_document_id','data_type|uuid'),
    ('202606200010','column_attr','binder_exports.published_document_id','is_nullable|YES'),
    ('202606200010','column_attr','binder_exports.version','data_type|integer'),
    ('202606200010','constraint','binder_exports_generation_status_check','generating'),
    ('202606200010','constraint','binder_exports_version_positive','version > 0'),
    ('202606200010','constraint','binder_exports_mime_pdf','application/pdf'),
    ('202606200010','constraint','binder_exports_content_hash_shape','sha256'),
    ('202606200010','constraint','binder_exports_published_document_link','published_document_id'),
    ('202606200010','constraint','binder_exports_withdrawn_timestamp','withdrawn_at'),
    ('202606200010','constraint','binder_exports_ready_requires_artifact','ready'),
    ('202606200010','fk','binder_exports.published_document_id','documents'),
    ('202606200010','fk','binder_exports.supersedes_binder_id','binder_exports'),
    ('202606200010','index','idx_binder_exports_generation_idempotent','UNIQUE|binder_exports|generation_idempotency_key'),
    ('202606200010','index_def','idx_binder_exports_generation_idempotent','generation_idempotency_key IS NOT NULL'),
    ('202606200010','index','idx_binder_exports_lineage_version','UNIQUE|binder_exports|binder_lineage_id, version'),
    ('202606200010','index','idx_binder_exports_client_status','binder_exports|client_id, status, created_at DESC'),
    ('202606200010','index','idx_binder_exports_client_lineage','binder_exports|client_id, binder_lineage_id, version DESC'),
    ('202606200010','index','idx_binder_exports_published_document','binder_exports|published_document_id'),
    ('202606200010','index_def','idx_binder_exports_published_document','published_document_id IS NOT NULL'),
    ('202606200010','index','idx_binder_exports_client_published_current','binder_exports|client_id, created_at DESC'),
    ('202606200010','index_def','idx_binder_exports_client_published_current','status = ''published_to_client'' AND published_document_id IS NOT NULL'),
    ('202606200010','index','idx_binder_exports_lineage_current_published','UNIQUE|binder_exports|binder_lineage_id'),
    ('202606200010','index_def','idx_binder_exports_lineage_current_published','status = ''published_to_client'' AND withdrawn_at IS NULL'),
    ('202606200010','comment_col','binder_exports.binder_lineage_id','Phase 9F.3'),
    ('202606200010','comment_col','binder_exports.generation_status','Phase 9F.3'),
    ('202606200010','comment_col','binder_exports.storage_bucket','Phase 9F.3'),
    ('202606200010','comment_col','binder_exports.published_document_id','Phase 9F.3'),
    ('202606200010','comment','binder_exports','Phase 9E/9F.3'),
    ('202606200010','rls','binder_exports','enabled'),
    ('202606200010','no_policy','binder_exports','zero_client_policies'),
    ('202606200010','no_policy','binder_exports','zero_adviser_policies'),
    ('202606200010','no_policy','binder_exports','zero_insert_policies'),
    ('202606200010','bucket','binder-exports','public|false'),
    ('202606200010','bucket_attr','binder-exports','file_size_limit|26214400'),
    ('202606200010','bucket_attr','binder-exports','allowed_mime_types|application/pdf'),
    ('202606200010','no_storage_policy','binder-exports','zero_authenticated_policies'),
    ('202606200010','prereq_table','binder_exports',NULL),
    ('202606200010','prereq_table','documents',NULL),
    ('202606200010','prereq_table','platform_feature_controls',NULL),
    ('202606200010','seed','platform_feature_controls.binder_export','present'),
    ('202606200010','seed','platform_feature_controls.binder_client_publication','present'),
    ('202606200010','seed','platform_feature_controls.document_event_notifications','present'),
    ('202606200010','seed_attr','platform_feature_controls.binder_client_publication','enabled|false')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
tbl AS (
  SELECT c.relname, c.relrowsecurity, c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
cols AS (
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
col_comments AS (
  SELECT c.relname AS table_name, a.attname AS column_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
  WHERE n.nspname = 'public'
),
tbl_comment AS (
  SELECT c.relname AS table_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass AND d.objsubid = 0
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
constraint_catalog AS (
  SELECT con.conname AS constraint_name, pg_get_constraintdef(con.oid) AS constraint_def
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public'
),
fk_catalog AS (
  SELECT
    con.conname AS constraint_name,
    rel.relname AS table_name,
    a.attname AS column_name,
    conf.relname AS foreign_table_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_class conf ON conf.oid = con.confrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = ANY(con.conkey)
  WHERE n.nspname = 'public' AND con.contype = 'f'
),
feature_flags AS (
  SELECT feature_key, enabled
  FROM platform_feature_controls
  WHERE feature_key IN ('binder_export', 'binder_client_publication', 'document_event_notifications')
),
index_key_cols AS (
  SELECT
    n.nspname AS schema_name,
    tbl.relname AS table_name,
    ic.relname AS index_name,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    (ix.indpred IS NOT NULL) AS has_predicate,
    pg_get_indexdef(ix.indexrelid) AS indexdef,
    pg_get_indexdef(ix.indexrelid, 1, true) AS first_key_col,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate_raw,
    pg_get_expr(ix.indpred, ix.indrelid, true) AS predicate_pretty,
    (
      SELECT string_agg(
        a.attname ||
        CASE WHEN (ix.indoption[k.ordinality - 1] & 2) = 2 THEN ' DESC' ELSE '' END,
        ', ' ORDER BY k.ordinality
      )
      FROM unnest(ix.indkey::int[]) WITH ORDINALITY AS k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum AND k.attnum > 0
    ) AS key_columns_ordered
  FROM pg_index ix
  JOIN pg_class ic ON ic.oid = ix.indexrelid
  JOIN pg_class tbl ON tbl.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = ic.relnamespace
  WHERE n.nspname = 'public' AND ic.relkind = 'i'
),
index_predicate_prepped AS (
  SELECT ik.*,
    CASE
      WHEN ik.predicate_raw IS NULL THEN NULL::text
      ELSE lower(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              btrim(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(ik.predicate_raw, '^\\s*where\\s+', '', 'i'),
                    'public\\.binder_exports\\.', '', 'gi'
                  ),
                  'binder_exports\\.', '', 'gi'
                )
              ),
              '::(?:text|uuid|boolean|timestamp|timestamptz)\\b', '', 'gi'
            ),
            '''([^'']+)''::text', '''\\1''', 'gi'
          ),
          '\\s+', ' ', 'g'
        )
      )
    END AS predicate_stage_0
  FROM index_key_cols ik
),
index_simple_pred_prepped AS (
  SELECT ik.*,
    CASE
      WHEN ik.predicate_pretty IS NULL THEN NULL::text
      ELSE lower(
        regexp_replace(
          regexp_replace(
            btrim(
              regexp_replace(
                regexp_replace(ik.predicate_pretty, 'public\\.binder_exports\\.', '', 'gi'),
                'binder_exports\\.', '', 'gi'
              )
            ),
            '\\s+', ' ', 'g'
          )
        )
      )
    END AS simple_pred_stage_0
  FROM index_key_cols ik
),
index_simple_pred_stage_1 AS (
  SELECT
    s.*,
    CASE
      WHEN simple_pred_stage_0 IS NULL THEN NULL::text
      WHEN left(simple_pred_stage_0, 1) = '('
        AND right(simple_pred_stage_0, 1) = ')'
        AND char_length(simple_pred_stage_0) >= 2
      THEN btrim(
        substring(
          simple_pred_stage_0
          FROM 2
          FOR char_length(simple_pred_stage_0) - 2
        )
      )
      ELSE simple_pred_stage_0
    END AS index_simple_pred_stage_1
  FROM index_simple_pred_prepped s
),
index_simple_pred_stage_2 AS (
  SELECT
    s.*,
    CASE
      WHEN index_simple_pred_stage_1 IS NULL THEN NULL::text
      WHEN left(index_simple_pred_stage_1, 1) = '('
        AND right(index_simple_pred_stage_1, 1) = ')'
        AND char_length(index_simple_pred_stage_1) >= 2
      THEN btrim(
        substring(
          index_simple_pred_stage_1
          FROM 2
          FOR char_length(index_simple_pred_stage_1) - 2
        )
      )
      ELSE index_simple_pred_stage_1
    END AS index_simple_pred_stage_2
  FROM index_simple_pred_stage_1 s
),
index_simple_pred_stage_3 AS (
  SELECT
    s.*,
    CASE
      WHEN index_simple_pred_stage_2 IS NULL THEN NULL::text
      WHEN left(index_simple_pred_stage_2, 1) = '('
        AND right(index_simple_pred_stage_2, 1) = ')'
        AND char_length(index_simple_pred_stage_2) >= 2
      THEN btrim(
        substring(
          index_simple_pred_stage_2
          FROM 2
          FOR char_length(index_simple_pred_stage_2) - 2
        )
      )
      ELSE index_simple_pred_stage_2
    END AS index_simple_pred_stage_3
  FROM index_simple_pred_stage_2 s
),
index_simple_pred_stage_4 AS (
  SELECT
    s.*,
    CASE
      WHEN index_simple_pred_stage_3 IS NULL THEN NULL::text
      WHEN left(index_simple_pred_stage_3, 1) = '('
        AND right(index_simple_pred_stage_3, 1) = ')'
        AND char_length(index_simple_pred_stage_3) >= 2
      THEN btrim(
        substring(
          index_simple_pred_stage_3
          FROM 2
          FOR char_length(index_simple_pred_stage_3) - 2
        )
      )
      ELSE index_simple_pred_stage_3
    END AS index_simple_pred_stage_4
  FROM index_simple_pred_stage_3 s
),
index_predicate_stage_1 AS (
  SELECT
    s.*,
    CASE
      WHEN predicate_stage_0 IS NULL THEN NULL::text
      WHEN left(predicate_stage_0, 1) = '('
        AND right(predicate_stage_0, 1) = ')'
        AND char_length(predicate_stage_0) >= 2
      THEN btrim(
        substring(
          predicate_stage_0
          FROM 2
          FOR char_length(predicate_stage_0) - 2
        )
      )
      ELSE predicate_stage_0
    END AS index_predicate_stage_1
  FROM index_predicate_prepped s
),
index_predicate_stage_2 AS (
  SELECT
    s.*,
    CASE
      WHEN index_predicate_stage_1 IS NULL THEN NULL::text
      WHEN left(index_predicate_stage_1, 1) = '('
        AND right(index_predicate_stage_1, 1) = ')'
        AND char_length(index_predicate_stage_1) >= 2
      THEN btrim(
        substring(
          index_predicate_stage_1
          FROM 2
          FOR char_length(index_predicate_stage_1) - 2
        )
      )
      ELSE index_predicate_stage_1
    END AS index_predicate_stage_2
  FROM index_predicate_stage_1 s
),
index_predicate_stage_3 AS (
  SELECT
    s.*,
    CASE
      WHEN index_predicate_stage_2 IS NULL THEN NULL::text
      WHEN left(index_predicate_stage_2, 1) = '('
        AND right(index_predicate_stage_2, 1) = ')'
        AND char_length(index_predicate_stage_2) >= 2
      THEN btrim(
        substring(
          index_predicate_stage_2
          FROM 2
          FOR char_length(index_predicate_stage_2) - 2
        )
      )
      ELSE index_predicate_stage_2
    END AS index_predicate_stage_3
  FROM index_predicate_stage_2 s
),
index_predicate_stage_4 AS (
  SELECT
    s.*,
    CASE
      WHEN index_predicate_stage_3 IS NULL THEN NULL::text
      WHEN left(index_predicate_stage_3, 1) = '('
        AND right(index_predicate_stage_3, 1) = ')'
        AND char_length(index_predicate_stage_3) >= 2
      THEN btrim(
        substring(
          index_predicate_stage_3
          FROM 2
          FOR char_length(index_predicate_stage_3) - 2
        )
      )
      ELSE index_predicate_stage_3
    END AS index_predicate_stage_4
  FROM index_predicate_stage_3 s
),
index_conjunct_raw AS (
  SELECT
    p.index_name,
    btrim(term) AS conjunct_stage_0
  FROM index_predicate_prepped p
  CROSS JOIN LATERAL unnest(regexp_split_to_array(p.predicate_stage_0, '\\s+and\\s+')) AS term
  WHERE p.predicate_stage_0 LIKE '% and %'
    AND btrim(term) <> ''
),
index_conjunct_stage_1 AS (
  SELECT
    s.*,
    CASE
      WHEN conjunct_stage_0 IS NULL THEN NULL::text
      WHEN left(conjunct_stage_0, 1) = '('
        AND right(conjunct_stage_0, 1) = ')'
        AND char_length(conjunct_stage_0) >= 2
      THEN btrim(
        substring(
          conjunct_stage_0
          FROM 2
          FOR char_length(conjunct_stage_0) - 2
        )
      )
      ELSE conjunct_stage_0
    END AS index_conjunct_stage_1
  FROM index_conjunct_raw s
),
index_conjunct_stage_2 AS (
  SELECT
    s.*,
    CASE
      WHEN index_conjunct_stage_1 IS NULL THEN NULL::text
      WHEN left(index_conjunct_stage_1, 1) = '('
        AND right(index_conjunct_stage_1, 1) = ')'
        AND char_length(index_conjunct_stage_1) >= 2
      THEN btrim(
        substring(
          index_conjunct_stage_1
          FROM 2
          FOR char_length(index_conjunct_stage_1) - 2
        )
      )
      ELSE index_conjunct_stage_1
    END AS index_conjunct_stage_2
  FROM index_conjunct_stage_1 s
),
index_conjunct_stage_3 AS (
  SELECT
    s.*,
    CASE
      WHEN index_conjunct_stage_2 IS NULL THEN NULL::text
      WHEN left(index_conjunct_stage_2, 1) = '('
        AND right(index_conjunct_stage_2, 1) = ')'
        AND char_length(index_conjunct_stage_2) >= 2
      THEN btrim(
        substring(
          index_conjunct_stage_2
          FROM 2
          FOR char_length(index_conjunct_stage_2) - 2
        )
      )
      ELSE index_conjunct_stage_2
    END AS index_conjunct_stage_3
  FROM index_conjunct_stage_2 s
),
index_conjunct_stage_4 AS (
  SELECT
    s.*,
    CASE
      WHEN index_conjunct_stage_3 IS NULL THEN NULL::text
      WHEN left(index_conjunct_stage_3, 1) = '('
        AND right(index_conjunct_stage_3, 1) = ')'
        AND char_length(index_conjunct_stage_3) >= 2
      THEN btrim(
        substring(
          index_conjunct_stage_3
          FROM 2
          FOR char_length(index_conjunct_stage_3) - 2
        )
      )
      ELSE index_conjunct_stage_3
    END AS index_conjunct_stage_4
  FROM index_conjunct_stage_3 s
),
index_catalog AS (
  SELECT p.*,
    sp.index_simple_pred_stage_4 AS simple_predicate_normalized,
    CASE
      WHEN p.predicate_stage_0 IS NULL THEN NULL::text
      WHEN p.predicate_stage_0 NOT LIKE '% and %' THEN p.index_predicate_stage_4
      ELSE (
        SELECT string_agg(c.index_conjunct_stage_4, ' and ' ORDER BY c.index_conjunct_stage_4)
        FROM index_conjunct_stage_4 c
        WHERE c.index_name = p.index_name
      )
    END AS predicate_canonical,
    CASE
      WHEN p.predicate_stage_0 IS NULL THEN NULL::text[]
      WHEN p.predicate_stage_0 NOT LIKE '% and %' THEN ARRAY[p.index_predicate_stage_4]::text[]
      ELSE (
        SELECT array_agg(c.index_conjunct_stage_4 ORDER BY c.index_conjunct_stage_4)
        FROM index_conjunct_stage_4 c
        WHERE c.index_name = p.index_name
      )
    END AS predicate_conjuncts_sorted
  FROM index_predicate_stage_4 p
  LEFT JOIN index_simple_pred_stage_4 sp ON sp.index_name = p.index_name
),
pol AS (
  SELECT tablename, policyname, cmd, roles::text AS roles_text
  FROM pg_policies WHERE schemaname = 'public'
),
client_policies AS (
  SELECT count(*)::bigint AS policy_count FROM pol
  WHERE tablename = 'binder_exports' AND roles_text ILIKE '%authenticated%'
),
adviser_policies AS (
  SELECT count(*)::bigint AS policy_count FROM pol
  WHERE tablename = 'binder_exports'
    AND (roles_text ILIKE '%advisor%' OR roles_text ILIKE '%adviser%')
),
insert_policies AS (
  SELECT count(*)::bigint AS policy_count FROM pol
  WHERE tablename = 'binder_exports' AND cmd = 'INSERT'
),
bucket_probe AS (
  SELECT id, public, file_size_limit, allowed_mime_types
  FROM storage.buckets WHERE id = 'binder-exports'
),
storage_binder_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pg_policies sp
  WHERE sp.schemaname = 'storage' AND sp.tablename = 'objects'
    AND sp.roles::text ILIKE '%authenticated%'
    AND (COALESCE(sp.qual, '') ILIKE '%binder-exports%' OR COALESCE(sp.with_check, '') ILIKE '%binder-exports%')
),
seed_probe AS (
  SELECT
    CASE WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'binder_export' LIMIT 1) END AS binder_export_present,
    CASE WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'binder_client_publication' LIMIT 1) END AS binder_publication_present,
    CASE WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
      ELSE EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'document_event_notifications' LIMIT 1) END AS document_notifications_present,
    (SELECT enabled FROM feature_flags WHERE feature_key = 'binder_client_publication' LIMIT 1) AS binder_publication_enabled
),
refs AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations' AND c.relkind IN ('r', 'p')
  ) AS history_table_exists
),
migration_history AS (
  SELECT CASE
    WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
    ELSE EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200010')
  END AS migration_recorded
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind || ':' || e.object_name
      || CASE WHEN e.expected_detail IS NULL OR e.expected_detail = '' THEN '' ELSE '.' || e.expected_detail END AS check_id,
    e.check_kind,
    e.object_name AS expected_object,
    e.expected_detail,
    CASE
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_generation_idempotent' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'generation_idempotency_key' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_binder_exports_generation_idempotent' THEN
        CASE WHEN ik.index_name IS NULL THEN 'absent'
          WHEN ik.table_name = 'binder_exports'
            AND ik.is_unique AND ik.is_valid AND ik.is_ready
            AND ik.first_key_col = 'generation_idempotency_key'
            AND ik.has_predicate
            AND ik.simple_predicate_normalized = 'generation_idempotency_key is not null'
          THEN 'present'
          WHEN ik.predicate_raw IS NULL THEN 'conflicting'
          ELSE 'conflicting' END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_lineage_version' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'binder_lineage_id, version' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_client_status' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'client_id, status, created_at DESC' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_client_lineage' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'client_id, binder_lineage_id, version DESC' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_published_document' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'published_document_id' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_binder_exports_published_document' THEN
        CASE WHEN ik.index_name IS NULL THEN 'absent'
          WHEN ik.table_name = 'binder_exports'
            AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
            AND ik.first_key_col = 'published_document_id'
            AND ik.has_predicate
            AND ik.simple_predicate_normalized = 'published_document_id is not null'
          THEN 'present'
          ELSE 'conflicting' END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_client_published_current' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'client_id, created_at DESC' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_binder_exports_client_published_current' THEN
        CASE WHEN ik.index_name IS NULL THEN 'absent'
          WHEN ik.predicate_conjuncts_sorted = ARRAY['published_document_id is not null', 'status = ''published_to_client''']::text[] THEN 'present'
          ELSE 'conflicting' END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_binder_exports_lineage_current_published' THEN
        CASE WHEN ik.table_name = 'binder_exports' AND ik.is_unique AND ik.is_valid AND ik.is_ready
          AND ik.key_columns_ordered = 'binder_lineage_id' THEN 'present' WHEN ik.index_name IS NULL THEN 'absent' ELSE 'conflicting' END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_binder_exports_lineage_current_published' THEN
        CASE WHEN ik.index_name IS NULL THEN 'absent'
          WHEN ik.predicate_conjuncts_sorted = ARRAY['status = ''published_to_client''', 'withdrawn_at is null']::text[] THEN 'present'
          ELSE 'conflicting' END
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND to_regclass('public.binder_exports') IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'column_attr' AND to_regclass('public.binder_exports') IS NULL THEN 'absent'
      WHEN e.check_kind = 'column_attr' AND ca.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'data_type' AND ca.data_type = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'is_nullable' AND ca.is_nullable = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'default'
        AND ca.column_default IS NOT NULL AND ca.column_default ILIKE '%' || split_part(e.expected_detail, '|', 2) || '%' THEN 'present'
      WHEN e.check_kind = 'column_attr' THEN 'conflicting'
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_generation_status_check' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent'
          WHEN ccn.constraint_def ILIKE '%generating%' AND ccn.constraint_def ILIKE '%legacy_manifest%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_version_positive' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent' WHEN ccn.constraint_def ILIKE '%version > 0%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_mime_pdf' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent' WHEN ccn.constraint_def ILIKE '%application/pdf%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_content_hash_shape' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent' WHEN ccn.constraint_def ILIKE '%[a-f0-9]%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_published_document_link' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent' WHEN ccn.constraint_def ILIKE '%published_document_id%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_withdrawn_timestamp' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent' WHEN ccn.constraint_def ILIKE '%withdrawn_at%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' AND e.object_name = 'binder_exports_ready_requires_artifact' THEN
        CASE WHEN ccn.constraint_name IS NULL THEN 'absent' WHEN ccn.constraint_def ILIKE '%generation_status%' AND ccn.constraint_def ILIKE '%content_hash%' THEN 'present' ELSE 'conflicting' END
      WHEN e.check_kind = 'constraint' THEN 'conflicting'
      WHEN e.check_kind = 'fk' AND fk.constraint_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'fk' AND fk.foreign_table_name = e.expected_detail THEN 'present'
      WHEN e.check_kind = 'fk' THEN 'conflicting'
      WHEN e.check_kind = 'comment_col' AND ccm.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment_col' AND ccm.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment_col' THEN 'conflicting'
      WHEN e.check_kind = 'comment' AND tc.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment' AND tc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment' THEN 'conflicting'
      WHEN e.check_kind = 'rls' AND t.relname IS NULL THEN 'absent'
      WHEN e.check_kind = 'rls' AND t.relrowsecurity THEN 'present'
      WHEN e.check_kind = 'rls' THEN 'conflicting'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_client_policies' AND (to_regclass('public.binder_exports') IS NULL OR cp.policy_count = 0) THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies' AND (to_regclass('public.binder_exports') IS NULL OR ap.policy_count = 0) THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies' AND (to_regclass('public.binder_exports') IS NULL OR ip.policy_count = 0) THEN 'present'
      WHEN e.check_kind = 'no_policy' THEN 'conflicting'
      WHEN e.check_kind = 'bucket' AND bp.id IS NULL THEN 'absent'
      WHEN e.check_kind = 'bucket' AND split_part(e.expected_detail, '|', 1) = 'public' AND bp.public::text = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'bucket' THEN 'conflicting'
      WHEN e.check_kind = 'bucket_attr' AND bp.id IS NULL THEN 'absent'
      WHEN e.check_kind = 'bucket_attr' AND split_part(e.expected_detail, '|', 1) = 'file_size_limit' AND bp.file_size_limit::text = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'bucket_attr' AND split_part(e.expected_detail, '|', 1) = 'allowed_mime_types' AND bp.allowed_mime_types::text ILIKE '%application/pdf%' THEN 'present'
      WHEN e.check_kind = 'bucket_attr' THEN 'conflicting'
      WHEN e.check_kind = 'no_storage_policy' AND e.expected_detail = 'zero_authenticated_policies' AND sbp.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_storage_policy' THEN 'conflicting'
      WHEN e.check_kind = 'prereq_table' AND to_regclass('public.' || e.object_name) IS NULL THEN 'absent'
      WHEN e.check_kind = 'prereq_table' THEN 'present'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.binder_export' AND sp.binder_export_present IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.binder_export' AND sp.binder_export_present THEN 'present'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.binder_export' THEN 'conflicting'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.binder_client_publication' AND sp.binder_publication_present IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.binder_client_publication' AND sp.binder_publication_present THEN 'present'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.binder_client_publication' THEN 'conflicting'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.document_event_notifications' AND sp.document_notifications_present IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.document_event_notifications' AND sp.document_notifications_present THEN 'present'
      WHEN e.check_kind = 'seed' AND e.object_name = 'platform_feature_controls.document_event_notifications' THEN 'conflicting'
      WHEN e.check_kind = 'seed_attr' AND e.object_name = 'platform_feature_controls.binder_client_publication' AND sp.binder_publication_enabled IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed_attr' AND split_part(e.expected_detail, '|', 1) = 'enabled' AND sp.binder_publication_enabled::text = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'seed_attr' THEN 'conflicting'
      ELSE 'conflicting'
    END AS state,
    CASE
      WHEN e.check_kind = 'fk' THEN fk.constraint_name IS NOT NULL
      WHEN e.check_kind = 'seed_attr' THEN sp.binder_publication_enabled IS NOT NULL
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'column_attr' THEN COALESCE(ca.data_type, '?') || '|' || COALESCE(ca.is_nullable, '?') || '|' || COALESCE(ca.column_default, '')
      WHEN e.check_kind IN ('index','index_def') THEN 'schema=' || COALESCE(ik.schema_name, '?') || '|table=' || COALESCE(ik.table_name, '?') || '|unique=' || COALESCE(ik.is_unique::text, '?') || '|keys=' || COALESCE(ik.key_columns_ordered, '?') || '|first_key=' || COALESCE(ik.first_key_col, '?') || '|predicate_raw=' || COALESCE(ik.predicate_raw, '') || '|simple_predicate=' || COALESCE(ik.simple_predicate_normalized, '') || '|predicate_canonical=' || COALESCE(ik.predicate_canonical, '')
      WHEN e.check_kind = 'constraint' THEN ccn.constraint_def
      WHEN e.check_kind = 'fk' THEN fk.foreign_table_name
      WHEN e.check_kind = 'rls' THEN CASE WHEN t.relrowsecurity THEN 'enabled' ELSE 'disabled' END
      WHEN e.check_kind = 'comment_col' THEN ccm.description
      WHEN e.check_kind = 'comment' THEN tc.description
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_client_policies' THEN cp.policy_count::text
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies' THEN ap.policy_count::text
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies' THEN ip.policy_count::text
      WHEN e.check_kind = 'bucket' THEN 'public=' || COALESCE(bp.public::text, '?')
      WHEN e.check_kind = 'bucket_attr' AND split_part(e.expected_detail, '|', 1) = 'file_size_limit' THEN bp.file_size_limit::text
      WHEN e.check_kind = 'bucket_attr' THEN bp.allowed_mime_types::text
      WHEN e.check_kind = 'no_storage_policy' THEN sbp.policy_count::text
      WHEN e.check_kind = 'seed_attr' THEN COALESCE(sp.binder_publication_enabled::text, 'row_absent')
      ELSE NULL
    END AS detail,
    e.expected_detail AS expected_canonical_detail,
    CASE WHEN e.check_kind = 'index_def' AND e.object_name IN ('idx_binder_exports_generation_idempotent', 'idx_binder_exports_published_document') THEN ik.simple_predicate_normalized
      WHEN e.check_kind = 'index_def' THEN ik.predicate_canonical ELSE NULL::text END AS actual_canonical_detail,
    mh.migration_recorded
  FROM expected e
  LEFT JOIN tbl t ON e.check_kind = 'rls' AND t.relname = e.object_name
  LEFT JOIN cols c ON e.check_kind = 'column' AND c.table_name = e.object_name AND c.column_name = e.expected_detail
  LEFT JOIN cols ca ON e.check_kind = 'column_attr' AND ca.table_name = split_part(e.object_name, '.', 1) AND ca.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN col_comments ccm ON e.check_kind = 'comment_col' AND ccm.table_name = split_part(e.object_name, '.', 1) AND ccm.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
  LEFT JOIN constraint_catalog ccn ON e.check_kind = 'constraint' AND ccn.constraint_name = e.object_name
  LEFT JOIN fk_catalog fk ON e.check_kind = 'fk'
    AND fk.table_name = split_part(e.object_name, '.', 1)
    AND fk.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN index_catalog ik ON e.check_kind IN ('index','index_def') AND ik.index_name = e.object_name
  CROSS JOIN client_policies cp
  CROSS JOIN adviser_policies ap
  CROSS JOIN insert_policies ip
  CROSS JOIN bucket_probe bp
  CROSS JOIN storage_binder_policies sbp
  CROSS JOIN seed_probe sp
  CROSS JOIN migration_history mh
)