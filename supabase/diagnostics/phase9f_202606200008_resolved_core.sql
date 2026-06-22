-- Shared authoritative resolved inventory for Phase 9F migration 202606200008 diagnostics.
-- Included verbatim in verify and discrepancy SQL files between PHASE9F_RESOLVED_CORE markers.

expected AS (
  SELECT * FROM (VALUES
    ('202606200008','table','automation_job_runs',NULL),
    ('202606200008','table','automation_job_items',NULL),
    ('202606200008','column','automation_job_runs','job_name'),
    ('202606200008','column','automation_job_runs','trigger_source'),
    ('202606200008','column','automation_job_runs','status'),
    ('202606200008','column','automation_job_runs','started_at'),
    ('202606200008','column','automation_job_runs','completed_at'),
    ('202606200008','column','automation_job_runs','items_examined'),
    ('202606200008','column','automation_job_runs','items_succeeded'),
    ('202606200008','column','automation_job_runs','items_skipped'),
    ('202606200008','column','automation_job_runs','items_failed'),
    ('202606200008','column','automation_job_runs','sanitized_error'),
    ('202606200008','column','automation_job_runs','metadata'),
    ('202606200008','column','automation_job_items','job_run_id'),
    ('202606200008','column','automation_job_items','reference_type'),
    ('202606200008','column','automation_job_items','reference_id'),
    ('202606200008','column','automation_job_items','outcome'),
    ('202606200008','column','automation_job_items','sanitized_reason'),
    ('202606200008','constraint','automation_job_runs_job_name_check','scheduled_publishing'),
    ('202606200008','constraint','automation_job_runs_trigger_source_check','scheduler'),
    ('202606200008','constraint','automation_job_runs_status_check','running'),
    ('202606200008','constraint','automation_job_items_reference_type_check','governed_content'),
    ('202606200008','constraint','automation_job_items_outcome_check','succeeded'),
    ('202606200008','fk','automation_job_items_job_run_id_fkey','automation_job_runs'),
    ('202606200008','index','idx_automation_job_runs_single_active','UNIQUE|automation_job_runs|job_name'),
    ('202606200008','index_def','idx_automation_job_runs_single_active','status = ''running'''),
    ('202606200008','index','idx_automation_job_runs_job_started','automation_job_runs|job_name, started_at DESC'),
    ('202606200008','index','idx_automation_job_items_run','automation_job_items|job_run_id'),
    ('202606200008','rls','automation_job_runs','enabled'),
    ('202606200008','rls','automation_job_items','enabled'),
    ('202606200008','no_policy','automation_job_runs','zero_client_adviser_policies'),
    ('202606200008','no_policy','automation_job_items','zero_client_adviser_policies'),
    ('202606200008','comment','automation_job_runs','Phase 9F.1'),
    ('202606200008','comment','automation_job_items','Sanitized reasons'),
    ('202606200008','seed','platform_feature_controls.scheduled_content_automation','disabled')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
tbl AS (
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
cols AS (
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
cons AS (
  SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
),
fk AS (
  SELECT
    con.conname,
    ref_cls.relname AS referenced_table
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
  JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
  WHERE nsp.nspname = 'public' AND con.contype = 'f'
),
index_key_cols AS (
  SELECT
    n.nspname AS schema_name,
    tbl.relname AS table_name,
    ic.relname AS index_name,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    pg_get_indexdef(ix.indexrelid) AS indexdef,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate_raw,
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
index_catalog AS (
  SELECT
    ik.*,
    CASE
      WHEN ik.predicate_raw IS NULL THEN NULL::text
      ELSE regexp_replace(
        regexp_replace(
          lower(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  btrim(regexp_replace(ik.predicate_raw, '^\s*where\s+', '', 'i')),
                  '::text\b', '', 'gi'
                ),
                '''([^'']+)''::text', '''\1''', 'gi'
              ),
              '\s+', ' ', 'g'
            )
          ),
          '^\((.*)\)$', '\1'
        ),
        '^\((.*)\)$', '\1'
      )
    END AS predicate_canonical
  FROM index_key_cols ik
),
pol AS (
  SELECT tablename, policyname, roles::text AS roles_text
  FROM pg_policies
  WHERE schemaname = 'public'
),
unexpected_client_policies AS (
  SELECT
    tablename,
    count(*)::bigint AS policy_count,
    string_agg(policyname, ', ' ORDER BY policyname) AS policy_names
  FROM pol
  WHERE tablename IN ('automation_job_runs', 'automation_job_items')
    AND (roles_text ILIKE '%client%' OR roles_text ILIKE '%advisor%' OR roles_text ILIKE '%adviser%')
  GROUP BY tablename
),
job_run_client_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pol
  WHERE tablename = 'automation_job_runs'
    AND (roles_text ILIKE '%client%' OR roles_text ILIKE '%advisor%' OR roles_text ILIKE '%adviser%')
),
job_item_client_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pol
  WHERE tablename = 'automation_job_items'
    AND (roles_text ILIKE '%client%' OR roles_text ILIKE '%advisor%' OR roles_text ILIKE '%adviser%')
),
tbl_comment AS (
  SELECT c.relname AS table_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
seed_probe AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
      ELSE (
        SELECT (pfc.enabled = false)
        FROM platform_feature_controls pfc
        WHERE pfc.feature_key = 'scheduled_content_automation'
        LIMIT 1
      )
    END AS seed_disabled
),
refs AS (
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations'
      AND c.relname = 'schema_migrations'
      AND c.relkind IN ('r', 'p')
  ) AS history_table_exists
),
migration_history AS (
  SELECT
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = '202606200008'
      )
    END AS migration_recorded
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind || ':' || e.object_name AS check_id,
    e.check_kind,
    e.object_name AS expected_object,
    e.expected_detail,
    CASE
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_automation_job_runs_single_active' THEN
        CASE
          WHEN ik.table_name = 'automation_job_runs'
            AND ik.is_unique
            AND ik.is_valid
            AND ik.is_ready
            AND ik.key_columns_ordered = 'job_name'
            THEN 'present'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_automation_job_runs_single_active' THEN
        CASE
          WHEN ik.predicate_canonical = lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g')) THEN 'present'
          WHEN ik.predicate_raw IS NULL THEN 'conflicting'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_automation_job_runs_job_started' THEN
        CASE
          WHEN ik.table_name = 'automation_job_runs'
            AND NOT ik.is_unique
            AND ik.is_valid
            AND ik.is_ready
            AND ik.key_columns_ordered = 'job_name, started_at DESC'
            AND ik.predicate_raw IS NULL
            THEN 'present'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_automation_job_items_run' THEN
        CASE
          WHEN ik.table_name = 'automation_job_items'
            AND NOT ik.is_unique
            AND ik.is_valid
            AND ik.is_ready
            AND ik.key_columns_ordered = 'job_run_id'
            AND ik.predicate_raw IS NULL
            THEN 'present'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'constraint' AND co.conname IS NULL THEN 'absent'
      WHEN e.check_kind = 'constraint' AND co.definition ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'constraint' THEN 'conflicting'
      WHEN e.check_kind = 'fk' AND fk.conname IS NULL THEN 'absent'
      WHEN e.check_kind = 'fk' AND fk.referenced_table = e.expected_detail THEN 'present'
      WHEN e.check_kind = 'fk' THEN 'conflicting'
      WHEN e.check_kind IN ('table','rls') AND t.relname IS NULL THEN 'absent'
      WHEN e.check_kind = 'table' AND t.relname IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'rls' AND t.relrowsecurity THEN 'present'
      WHEN e.check_kind = 'rls' THEN 'conflicting'
      WHEN e.check_kind = 'column' AND c.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs'
        AND to_regclass('public.automation_job_runs') IS NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items'
        AND to_regclass('public.automation_job_items') IS NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' AND jrcp.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' AND jicp.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_policy' THEN 'conflicting'
      WHEN e.check_kind = 'comment' AND tc.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment' AND tc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment' THEN 'conflicting'
      WHEN e.check_kind = 'seed' AND sp.seed_disabled IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND sp.seed_disabled = true THEN 'present'
      WHEN e.check_kind = 'seed' THEN 'conflicting'
      ELSE 'conflicting'
    END AS state,
    CASE
      WHEN e.check_kind IN ('table','rls') THEN t.relname IS NOT NULL
      WHEN e.check_kind = 'column' THEN c.column_name IS NOT NULL
      WHEN e.check_kind = 'constraint' THEN co.conname IS NOT NULL
      WHEN e.check_kind = 'fk' THEN fk.conname IS NOT NULL
      WHEN e.check_kind IN ('index','index_def') THEN ik.index_name IS NOT NULL
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' THEN jrcp.policy_count = 0
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' THEN jicp.policy_count = 0
      WHEN e.check_kind = 'comment' THEN tc.table_name IS NOT NULL
      WHEN e.check_kind = 'seed' THEN sp.seed_disabled IS NOT NULL
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'constraint' THEN co.definition
      WHEN e.check_kind = 'fk' THEN fk.referenced_table
      WHEN e.check_kind IN ('index','index_def') THEN
        'schema=' || COALESCE(ik.schema_name, '?')
        || '|table=' || COALESCE(ik.table_name, '?')
        || '|unique=' || COALESCE(ik.is_unique::text, '?')
        || '|keys=' || COALESCE(ik.key_columns_ordered, '?')
        || '|predicate_raw=' || COALESCE(ik.predicate_raw, '')
        || '|indexdef=' || COALESCE(ik.indexdef, '')
      WHEN e.check_kind = 'rls' THEN
        CASE
          WHEN t.relname IS NULL THEN NULL
          WHEN t.relrowsecurity THEN 'enabled'
          ELSE 'disabled'
        END
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' THEN
        COALESCE(ucp_r.policy_count, 0)::text || ' unexpected policies'
        || CASE WHEN ucp_r.policy_names IS NOT NULL THEN ' (' || ucp_r.policy_names || ')' ELSE '' END
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' THEN
        COALESCE(ucp_i.policy_count, 0)::text || ' unexpected policies'
        || CASE WHEN ucp_i.policy_names IS NOT NULL THEN ' (' || ucp_i.policy_names || ')' ELSE '' END
      WHEN e.check_kind = 'comment' THEN tc.description
      WHEN e.check_kind = 'seed' THEN
        CASE
          WHEN sp.seed_disabled IS NULL THEN 'row_absent_or_table_missing'
          WHEN sp.seed_disabled THEN 'disabled'
          ELSE 'enabled'
        END
      ELSE NULL
    END AS detail,
    CASE
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_automation_job_runs_single_active' THEN
        'schema=public|table=automation_job_runs|unique=true|keys=job_name'
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_automation_job_runs_single_active' THEN
        lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g'))
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_automation_job_runs_job_started' THEN
        'schema=public|table=automation_job_runs|unique=false|keys=job_name, started_at DESC'
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_automation_job_items_run' THEN
        'schema=public|table=automation_job_items|unique=false|keys=job_run_id'
      WHEN e.check_kind = 'constraint' THEN e.expected_detail
      WHEN e.check_kind = 'fk' THEN e.expected_detail
      WHEN e.check_kind = 'rls' THEN e.expected_detail
      WHEN e.check_kind = 'no_policy' THEN e.expected_detail
      WHEN e.check_kind = 'comment' THEN e.expected_detail
      WHEN e.check_kind = 'seed' THEN e.expected_detail
      ELSE NULL
    END AS expected_canonical_detail,
    CASE
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NOT NULL THEN
        'schema=' || ik.schema_name
        || '|table=' || ik.table_name
        || '|unique=' || ik.is_unique::text
        || '|keys=' || COALESCE(ik.key_columns_ordered, '')
        || CASE
          WHEN e.check_kind = 'index_def' THEN '|predicate=' || COALESCE(ik.predicate_canonical, '')
          ELSE ''
        END
      WHEN e.check_kind = 'constraint' AND co.definition IS NOT NULL THEN
        lower(regexp_replace(co.definition, '\s+', ' ', 'g'))
      WHEN e.check_kind = 'fk' THEN fk.referenced_table
      WHEN e.check_kind = 'rls' THEN
        CASE
          WHEN t.relname IS NULL THEN NULL
          WHEN t.relrowsecurity THEN 'enabled'
          ELSE 'disabled'
        END
      WHEN e.check_kind = 'seed' THEN
        CASE
          WHEN sp.seed_disabled IS NULL THEN NULL
          WHEN sp.seed_disabled THEN 'disabled'
          ELSE 'enabled'
        END
      ELSE NULL
    END AS actual_canonical_detail,
    mh.migration_recorded
  FROM expected e
  LEFT JOIN tbl t ON e.check_kind IN ('table','rls') AND t.relname = e.object_name
  LEFT JOIN cols c ON e.check_kind = 'column' AND c.table_name = e.object_name AND c.column_name = e.expected_detail
  LEFT JOIN cons co ON e.check_kind = 'constraint' AND co.conname = e.object_name
  LEFT JOIN fk fk ON e.check_kind = 'fk' AND fk.conname = e.object_name
  LEFT JOIN index_catalog ik ON e.check_kind IN ('index','index_def') AND ik.index_name = e.object_name
  LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
  LEFT JOIN unexpected_client_policies ucp_r
    ON e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' AND ucp_r.tablename = e.object_name
  LEFT JOIN unexpected_client_policies ucp_i
    ON e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' AND ucp_i.tablename = e.object_name
  CROSS JOIN seed_probe sp
  CROSS JOIN job_run_client_policies jrcp
  CROSS JOIN job_item_client_policies jicp
  CROSS JOIN migration_history mh
)
