/**
 * Regenerate Phase 9F.3 diagnostic SQL from the migration contract.
 * Run: npx tsx scripts/gen-phase9f3-diagnostics.ts
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";

type ExpectedRow = [string, string, string | null];

const PAREN_STRIP_ROUNDS = 4;

/** One bounded outer-paren strip referencing a column by name (no expression inlining). */
function sqlStripParenCase(inputCol: string): string {
  return `CASE
      WHEN ${inputCol} IS NULL THEN NULL::text
      WHEN left(${inputCol}, 1) = '('
        AND right(${inputCol}, 1) = ')'
        AND char_length(${inputCol}) >= 2
      THEN btrim(
        substring(
          ${inputCol}
          FROM 2
          FOR char_length(${inputCol}) - 2
        )
      )
      ELSE ${inputCol}
    END`;
}

function buildStripStageChain(
  baseCte: string,
  initialCol: string,
  stagePrefix: string,
  rounds: number,
): { sql: string; finalCte: string; finalCol: string } {
  const parts: string[] = [];
  let prevCte = baseCte;
  let prevCol = initialCol;

  for (let i = 1; i <= rounds; i++) {
    const cteName = `${stagePrefix}_stage_${i}`;
    const outCol = `${stagePrefix}_stage_${i}`;
    parts.push(`${cteName} AS (
  SELECT
    s.*,
    ${sqlStripParenCase(prevCol)} AS ${outCol}
  FROM ${prevCte} s
)`);
    prevCte = cteName;
    prevCol = outCol;
  }

  return { sql: parts.join(",\n"), finalCte: prevCte, finalCol: prevCol };
}

const predicateStripStages = buildStripStageChain(
  "index_predicate_prepped",
  "predicate_stage_0",
  "index_predicate",
  PAREN_STRIP_ROUNDS,
);
const conjunctStripStages = buildStripStageChain(
  "index_conjunct_raw",
  "conjunct_stage_0",
  "index_conjunct",
  PAREN_STRIP_ROUNDS,
);
const simplePredStripStages = buildStripStageChain(
  "index_simple_pred_prepped",
  "simple_pred_stage_0",
  "index_simple_pred",
  PAREN_STRIP_ROUNDS,
);

const EXPECTED_ROWS: ExpectedRow[] = [
  ["column", "binder_exports", "binder_lineage_id"],
  ["column", "binder_exports", "generation_status"],
  ["column", "binder_exports", "generation_idempotency_key"],
  ["column", "binder_exports", "storage_bucket"],
  ["column", "binder_exports", "file_size_bytes"],
  ["column", "binder_exports", "mime_type"],
  ["column", "binder_exports", "content_hash"],
  ["column", "binder_exports", "generation_error_code"],
  ["column", "binder_exports", "generation_completed_at"],
  ["column", "binder_exports", "published_document_id"],
  ["column", "binder_exports", "supersedes_binder_id"],
  ["column", "binder_exports", "withdrawn_at"],
  ["column", "binder_exports", "withdrawal_reason"],
  ["column_attr", "binder_exports.binder_lineage_id", "data_type|uuid"],
  ["column_attr", "binder_exports.binder_lineage_id", "is_nullable|NO"],
  ["column_attr", "binder_exports.generation_status", "data_type|text"],
  ["column_attr", "binder_exports.generation_status", "is_nullable|NO"],
  ["column_attr", "binder_exports.generation_status", "default|legacy_manifest"],
  ["column_attr", "binder_exports.generation_idempotency_key", "data_type|text"],
  ["column_attr", "binder_exports.generation_idempotency_key", "is_nullable|YES"],
  ["column_attr", "binder_exports.storage_bucket", "data_type|text"],
  ["column_attr", "binder_exports.storage_bucket", "default|binder-exports"],
  ["column_attr", "binder_exports.published_document_id", "data_type|uuid"],
  ["column_attr", "binder_exports.published_document_id", "is_nullable|YES"],
  ["column_attr", "binder_exports.version", "data_type|integer"],
  ["constraint", "binder_exports_generation_status_check", "generating"],
  ["constraint", "binder_exports_version_positive", "version > 0"],
  ["constraint", "binder_exports_mime_pdf", "application/pdf"],
  ["constraint", "binder_exports_content_hash_shape", "sha256"],
  ["constraint", "binder_exports_published_document_link", "published_document_id"],
  ["constraint", "binder_exports_withdrawn_timestamp", "withdrawn_at"],
  ["constraint", "binder_exports_ready_requires_artifact", "ready"],
  ["fk", "binder_exports.published_document_id", "documents"],
  ["fk", "binder_exports.supersedes_binder_id", "binder_exports"],
  ["index", "idx_binder_exports_generation_idempotent", "UNIQUE|binder_exports|generation_idempotency_key"],
  ["index_def", "idx_binder_exports_generation_idempotent", "generation_idempotency_key IS NOT NULL"],
  ["index", "idx_binder_exports_lineage_version", "UNIQUE|binder_exports|binder_lineage_id, version"],
  ["index", "idx_binder_exports_client_status", "binder_exports|client_id, status, created_at DESC"],
  ["index", "idx_binder_exports_client_lineage", "binder_exports|client_id, binder_lineage_id, version DESC"],
  ["index", "idx_binder_exports_published_document", "binder_exports|published_document_id"],
  ["index_def", "idx_binder_exports_published_document", "published_document_id IS NOT NULL"],
  ["index", "idx_binder_exports_client_published_current", "binder_exports|client_id, created_at DESC"],
  ["index_def", "idx_binder_exports_client_published_current", "status = 'published_to_client' AND published_document_id IS NOT NULL"],
  ["index", "idx_binder_exports_lineage_current_published", "UNIQUE|binder_exports|binder_lineage_id"],
  ["index_def", "idx_binder_exports_lineage_current_published", "status = 'published_to_client' AND withdrawn_at IS NULL"],
  ["comment_col", "binder_exports.binder_lineage_id", "Phase 9F.3"],
  ["comment_col", "binder_exports.generation_status", "Phase 9F.3"],
  ["comment_col", "binder_exports.storage_bucket", "Phase 9F.3"],
  ["comment_col", "binder_exports.published_document_id", "Phase 9F.3"],
  ["comment", "binder_exports", "Phase 9E/9F.3"],
  ["rls", "binder_exports", "enabled"],
  ["no_policy", "binder_exports", "zero_client_policies"],
  ["no_policy", "binder_exports", "zero_adviser_policies"],
  ["no_policy", "binder_exports", "zero_insert_policies"],
  ["bucket", "binder-exports", "public|false"],
  ["bucket_attr", "binder-exports", "file_size_limit|26214400"],
  ["bucket_attr", "binder-exports", "allowed_mime_types|application/pdf"],
  ["no_storage_policy", "binder-exports", "zero_authenticated_policies"],
  ["prereq_table", "binder_exports", null],
  ["prereq_table", "documents", null],
  ["prereq_table", "platform_feature_controls", null],
  ["seed", "platform_feature_controls.binder_export", "present"],
  ["seed", "platform_feature_controls.binder_client_publication", "present"],
  ["seed", "platform_feature_controls.document_event_notifications", "present"],
  ["seed_attr", "platform_feature_controls.binder_client_publication", "enabled|false"],
];

const valuesSql = EXPECTED_ROWS.map(([kind, obj, detail]) => {
  const detailSql = detail === null ? "NULL" : `'${detail.replace(/'/g, "''")}'`;
  return `    ('202606200010','${kind}','${obj}',${detailSql})`;
}).join(",\n");

const resolvedCore = `expected AS (
  SELECT * FROM (VALUES
${valuesSql}
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
                    regexp_replace(ik.predicate_raw, '^\\\\s*where\\\\s+', '', 'i'),
                    'public\\\\.binder_exports\\\\.', '', 'gi'
                  ),
                  'binder_exports\\\\.', '', 'gi'
                )
              ),
              '::(?:text|uuid|boolean|timestamp|timestamptz)\\\\b', '', 'gi'
            ),
            '''([^'']+)''::text', '''\\\\1''', 'gi'
          ),
          '\\\\s+', ' ', 'g'
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
                regexp_replace(ik.predicate_pretty, 'public\\\\.binder_exports\\\\.', '', 'gi'),
                'binder_exports\\\\.', '', 'gi'
              )
            ),
            '\\\\s+', ' ', 'g'
          )
        )
      )
    END AS simple_pred_stage_0
  FROM index_key_cols ik
),
${simplePredStripStages.sql},
${predicateStripStages.sql},
index_conjunct_raw AS (
  SELECT
    p.index_name,
    btrim(term) AS conjunct_stage_0
  FROM index_predicate_prepped p
  CROSS JOIN LATERAL unnest(regexp_split_to_array(p.predicate_stage_0, '\\\\s+and\\\\s+')) AS term
  WHERE p.predicate_stage_0 LIKE '% and %'
    AND btrim(term) <> ''
),
${conjunctStripStages.sql},
index_catalog AS (
  SELECT p.*,
    sp.${simplePredStripStages.finalCol} AS simple_predicate_normalized,
    CASE
      WHEN p.predicate_stage_0 IS NULL THEN NULL::text
      WHEN p.predicate_stage_0 NOT LIKE '% and %' THEN p.${predicateStripStages.finalCol}
      ELSE (
        SELECT string_agg(c.${conjunctStripStages.finalCol}, ' and ' ORDER BY c.${conjunctStripStages.finalCol})
        FROM ${conjunctStripStages.finalCte} c
        WHERE c.index_name = p.index_name
      )
    END AS predicate_canonical,
    CASE
      WHEN p.predicate_stage_0 IS NULL THEN NULL::text[]
      WHEN p.predicate_stage_0 NOT LIKE '% and %' THEN ARRAY[p.${predicateStripStages.finalCol}]::text[]
      ELSE (
        SELECT array_agg(c.${conjunctStripStages.finalCol} ORDER BY c.${conjunctStripStages.finalCol})
        FROM ${conjunctStripStages.finalCte} c
        WHERE c.index_name = p.index_name
      )
    END AS predicate_conjuncts_sorted
  FROM ${predicateStripStages.finalCte} p
  LEFT JOIN ${simplePredStripStages.finalCte} sp ON sp.index_name = p.index_name
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
)`;

const verifyFooter = `-- PHASE9F3_RESOLVED_CORE_END
,
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE state = 'present') AS present_checks,
    COUNT(*) FILTER (WHERE state = 'absent') AS absent_checks,
    COUNT(*) FILTER (WHERE state = 'conflicting') AS conflicting_checks,
    COUNT(*) FILTER (WHERE state = 'unknown') AS unknown_checks
  FROM resolved
)
SELECT
  '202606200010' AS migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  unknown_checks,
  CASE
    WHEN present_checks = total_required_checks AND absent_checks = 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN present_checks = 0 AND absent_checks > 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'ABSENT'
    WHEN conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN unknown_checks > 0 THEN 'UNKNOWN'
    ELSE 'PARTIAL_MATCH'
  END AS classification
FROM summary;
`;

const discFooter = `-- PHASE9F3_RESOLVED_CORE_END
,
discrepancies AS (
  SELECT
    r.check_id, r.check_kind, r.expected_object, r.state, r.expected_detail,
    r.detail AS actual_detail, r.expected_canonical_detail, r.actual_canonical_detail,
    CASE
      WHEN r.state = 'absent' THEN 'Expected object missing — migration not applied or partial apply.'
      WHEN r.state = 'conflicting' THEN 'Object present but attributes differ from migration contract.'
      WHEN r.state = 'unknown' THEN 'Seed or optional dependency could not be verified.'
      ELSE 'Discrepancy requires manual review.'
    END AS suggested_interpretation
  FROM resolved r
  WHERE r.state IN ('conflicting', 'absent', 'unknown')
)
SELECT check_id, check_kind, expected_object, state, expected_detail, actual_detail,
  expected_canonical_detail, actual_canonical_detail, suggested_interpretation
FROM discrepancies ORDER BY check_id;
`;

const header = (title: string, extra = "") =>
  `-- Read-only ${title} for 202606200010_phase9f3_binder_pdf_client_vault.sql${extra}\n\nWITH\n-- PHASE9F3_RESOLVED_CORE_BEGIN\n`;

const PHASE9F3_DIAGNOSTIC_MAX_LINES = 2000;
const PHASE9F3_DIAGNOSTIC_MAX_BYTES = 250 * 1024;

function assertDiagnosticSizeGuard(path: string): void {
  const content = readFileSync(path, "utf8");
  const lines = content.split(/\r?\n/).length;
  const bytes = statSync(path).size;
  if (lines > PHASE9F3_DIAGNOSTIC_MAX_LINES) {
    throw new Error(`${path}: ${lines} lines exceeds ${PHASE9F3_DIAGNOSTIC_MAX_LINES} line guard`);
  }
  if (bytes > PHASE9F3_DIAGNOSTIC_MAX_BYTES) {
    throw new Error(`${path}: ${bytes} bytes exceeds ${PHASE9F3_DIAGNOSTIC_MAX_BYTES} byte guard`);
  }
}

writeFileSync(
  "supabase/diagnostics/phase9f3_202606200010_resolved_core.sql",
  `-- Shared resolved inventory for Phase 9F.3 diagnostics.\n-- Included verbatim in verify and discrepancy SQL files between PHASE9F3_RESOLVED_CORE markers.\n\n${resolvedCore}`,
  "utf8",
);
writeFileSync(
  "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
  header("verification") + resolvedCore + verifyFooter,
  "utf8",
);
writeFileSync(
  "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
  header("discrepancy report", "\n-- Filtered view of the same resolved inventory as verify_202606200010_phase9f3_binder_pdf_client_vault.sql.") +
    resolvedCore +
    discFooter,
  "utf8",
);

for (const path of [
  "supabase/diagnostics/phase9f3_202606200010_resolved_core.sql",
  "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
  "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
]) {
  assertDiagnosticSizeGuard(path);
}

console.log(`Generated Phase 9F.3 diagnostics (${EXPECTED_ROWS.length} expected checks)`);
