-- Read-only verification for 202606200008_phase9f_scheduled_publishing.sql

WITH expected AS (
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
    ('202606200008','index','idx_automation_job_runs_single_active','UNIQUE'),
    ('202606200008','index_def','idx_automation_job_runs_single_active','WHERE ((status = ''running''::text))'),
    ('202606200008','index','idx_automation_job_runs_job_started','job_name'),
    ('202606200008','index','idx_automation_job_items_run','job_run_id'),
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
idx AS (
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
),
pol AS (
  SELECT tablename, policyname, roles::text AS roles_text
  FROM pg_policies
  WHERE schemaname = 'public'
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
      ELSE NULLIF(
        ((xpath('/row/enabled/text()', query_to_xml($$
          SELECT enabled::text AS enabled
            FROM platform_feature_controls
           WHERE feature_key = 'scheduled_content_automation'
           LIMIT 1
        $$, true, true, '')))[1]::text),
        ''
      ) = 'false'
    END AS seed_disabled
)
SELECT
  e.migration,
  e.check_kind || ':' || e.object_name AS check_id,
  e.object_name AS expected_object,
  CASE
    WHEN e.check_kind IN ('table','rls') THEN t.relname IS NOT NULL
    WHEN e.check_kind = 'column' THEN c.column_name IS NOT NULL
    WHEN e.check_kind = 'constraint' THEN co.conname IS NOT NULL
    WHEN e.check_kind = 'fk' THEN fk.conname IS NOT NULL
    WHEN e.check_kind IN ('index','index_def') THEN i.indexname IS NOT NULL
    WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' THEN jrcp.policy_count = 0
    WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' THEN jicp.policy_count = 0
    WHEN e.check_kind = 'comment' THEN tc.table_name IS NOT NULL
    WHEN e.check_kind = 'seed' THEN sp.seed_disabled IS NOT NULL
    ELSE NULL::boolean
  END AS present,
  CASE
    WHEN e.check_kind = 'constraint' THEN co.definition
    WHEN e.check_kind = 'fk' THEN fk.referenced_table
    WHEN e.check_kind IN ('index','index_def') THEN i.indexdef
    WHEN e.check_kind = 'rls' THEN CASE WHEN t.relrowsecurity THEN 'enabled' ELSE 'disabled' END
    WHEN e.check_kind = 'comment' THEN tc.description
    WHEN e.check_kind = 'seed' THEN CASE WHEN sp.seed_disabled THEN 'disabled' ELSE 'not_disabled_or_absent' END
    ELSE NULL
  END AS detail,
  CASE
    WHEN e.check_kind = 'constraint' AND co.conname IS NOT NULL AND co.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'fk' AND fk.conname IS NOT NULL AND fk.referenced_table <> e.expected_detail THEN 'conflicting'
    WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%UNIQUE INDEX%' THEN 'conflicting'
    WHEN e.check_kind = 'index_def' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND e.expected_detail = 'job_name' AND i.indexdef NOT ILIKE '%job_name%' THEN 'conflicting'
    WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND e.expected_detail = 'job_run_id' AND i.indexdef NOT ILIKE '%job_run_id%' THEN 'conflicting'
    WHEN e.check_kind = 'rls' AND t.relname IS NOT NULL AND NOT t.relrowsecurity THEN 'conflicting'
    WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' AND jrcp.policy_count > 0 THEN 'conflicting'
    WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' AND jicp.policy_count > 0 THEN 'conflicting'
    WHEN e.check_kind = 'comment' AND (tc.description IS NULL OR tc.description NOT ILIKE '%' || e.expected_detail || '%') THEN 'conflicting'
    WHEN e.check_kind = 'seed' AND sp.seed_disabled IS NULL THEN 'unknown'
    WHEN e.check_kind = 'seed' AND sp.seed_disabled = false THEN 'conflicting'
    WHEN (
      (e.check_kind IN ('table','rls') AND t.relname IS NULL) OR
      (e.check_kind = 'column' AND c.column_name IS NULL) OR
      (e.check_kind = 'constraint' AND co.conname IS NULL) OR
      (e.check_kind = 'fk' AND fk.conname IS NULL) OR
      (e.check_kind IN ('index','index_def') AND i.indexname IS NULL)
    ) THEN 'absent'
    ELSE 'present'
  END AS state
FROM expected e
LEFT JOIN tbl t ON e.check_kind IN ('table','rls') AND t.relname = e.object_name
LEFT JOIN cols c ON e.check_kind = 'column' AND c.table_name = e.object_name AND c.column_name = e.expected_detail
LEFT JOIN cons co ON e.check_kind = 'constraint' AND co.conname = e.object_name
LEFT JOIN fk fk ON e.check_kind = 'fk' AND fk.conname = e.object_name
LEFT JOIN idx i ON e.check_kind IN ('index','index_def') AND i.indexname = e.object_name
LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
CROSS JOIN seed_probe sp
CROSS JOIN job_run_client_policies jrcp
CROSS JOIN job_item_client_policies jicp
ORDER BY check_id;

-- Strict rollup
WITH expected AS (
  SELECT * FROM (VALUES
    ('table','automation_job_runs',NULL),
    ('table','automation_job_items',NULL),
    ('column','automation_job_runs','job_name'),
    ('column','automation_job_runs','trigger_source'),
    ('column','automation_job_runs','status'),
    ('column','automation_job_runs','started_at'),
    ('column','automation_job_runs','completed_at'),
    ('column','automation_job_runs','items_examined'),
    ('column','automation_job_runs','items_succeeded'),
    ('column','automation_job_runs','items_skipped'),
    ('column','automation_job_runs','items_failed'),
    ('column','automation_job_runs','sanitized_error'),
    ('column','automation_job_runs','metadata'),
    ('column','automation_job_items','job_run_id'),
    ('column','automation_job_items','reference_type'),
    ('column','automation_job_items','reference_id'),
    ('column','automation_job_items','outcome'),
    ('column','automation_job_items','sanitized_reason'),
    ('constraint','automation_job_runs_job_name_check','scheduled_publishing'),
    ('constraint','automation_job_runs_trigger_source_check','scheduler'),
    ('constraint','automation_job_runs_status_check','running'),
    ('constraint','automation_job_items_reference_type_check','governed_content'),
    ('constraint','automation_job_items_outcome_check','succeeded'),
    ('fk','automation_job_items_job_run_id_fkey','automation_job_runs'),
    ('index','idx_automation_job_runs_single_active','UNIQUE'),
    ('index_def','idx_automation_job_runs_single_active','WHERE ((status = ''running''::text))'),
    ('index','idx_automation_job_runs_job_started','job_name'),
    ('index','idx_automation_job_items_run','job_run_id'),
    ('rls','automation_job_runs','enabled'),
    ('rls','automation_job_items','enabled'),
    ('no_policy','automation_job_runs','zero_client_adviser_policies'),
    ('no_policy','automation_job_items','zero_client_adviser_policies'),
    ('comment','automation_job_runs','Phase 9F.1'),
    ('comment','automation_job_items','Sanitized reasons'),
    ('seed','platform_feature_controls.scheduled_content_automation','disabled')
  ) AS t(check_kind, object_name, expected_detail)
),
tbl AS (
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
cols AS (
  SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
),
cons AS (SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint),
fk AS (
  SELECT con.conname, ref_cls.relname AS referenced_table
  FROM pg_constraint con
  JOIN pg_class cls ON cls.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
  JOIN pg_class ref_cls ON ref_cls.oid = con.confrelid
  WHERE nsp.nspname = 'public' AND con.contype = 'f'
),
idx AS (SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'),
pol AS (SELECT tablename, policyname, roles::text AS roles_text FROM pg_policies WHERE schemaname = 'public'),
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
      ELSE NULLIF(
        ((xpath('/row/enabled/text()', query_to_xml($$
          SELECT enabled::text AS enabled
            FROM platform_feature_controls
           WHERE feature_key = 'scheduled_content_automation'
           LIMIT 1
        $$, true, true, '')))[1]::text),
        ''
      ) = 'false'
    END AS seed_disabled
),
states AS (
  SELECT
    CASE
      WHEN e.check_kind = 'constraint' AND co.conname IS NOT NULL AND co.definition ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'fk' AND fk.conname IS NOT NULL AND fk.referenced_table = e.expected_detail THEN 'present'
      WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef ILIKE '%UNIQUE INDEX%' THEN 'present'
      WHEN e.check_kind = 'index_def' AND i.indexname IS NOT NULL AND i.indexdef ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND e.expected_detail = 'job_name' AND i.indexdef ILIKE '%job_name%' THEN 'present'
      WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND e.expected_detail = 'job_run_id' AND i.indexdef ILIKE '%job_run_id%' THEN 'present'
      WHEN e.check_kind IN ('table','rls') AND t.relname IS NOT NULL AND (e.check_kind = 'table' OR t.relrowsecurity) THEN 'present'
      WHEN e.check_kind = 'column' AND c.column_name IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_runs' AND jrcp.policy_count = 0
        AND to_regclass('public.automation_job_runs') IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.object_name = 'automation_job_items' AND jicp.policy_count = 0
        AND to_regclass('public.automation_job_items') IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'comment' AND tc.table_name IS NOT NULL AND tc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'seed' AND sp.seed_disabled = true THEN 'present'
      WHEN e.check_kind = 'seed' AND sp.seed_disabled IS NULL THEN 'unknown'
      WHEN (
        (e.check_kind IN ('table','rls','column','constraint','fk','index','index_def') AND (
          (e.check_kind IN ('table','rls') AND t.relname IS NULL) OR
          (e.check_kind = 'column' AND c.column_name IS NULL) OR
          (e.check_kind = 'constraint' AND co.conname IS NULL) OR
          (e.check_kind = 'fk' AND fk.conname IS NULL) OR
          (e.check_kind IN ('index','index_def') AND i.indexname IS NULL)
        ))
      ) THEN 'absent'
      ELSE 'conflicting'
    END AS state
  FROM expected e
  LEFT JOIN tbl t ON e.check_kind IN ('table','rls') AND t.relname = e.object_name
  LEFT JOIN cols c ON e.check_kind = 'column' AND c.table_name = e.object_name AND c.column_name = e.expected_detail
  LEFT JOIN cons co ON e.check_kind = 'constraint' AND co.conname = e.object_name
  LEFT JOIN fk fk ON e.check_kind = 'fk' AND fk.conname = e.object_name
  LEFT JOIN idx i ON e.check_kind IN ('index','index_def') AND i.indexname = e.object_name
  LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
  CROSS JOIN seed_probe sp
  CROSS JOIN job_run_client_policies jrcp
  CROSS JOIN job_item_client_policies jicp
),
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE state = 'present') AS present_checks,
    COUNT(*) FILTER (WHERE state = 'absent') AS absent_checks,
    COUNT(*) FILTER (WHERE state = 'conflicting') AS conflicting_checks,
    COUNT(*) FILTER (WHERE state = 'unknown') AS unknown_checks
  FROM states
)
SELECT
  '202606200008' AS migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  unknown_checks,
  CASE
    WHEN present_checks = total_required_checks AND absent_checks = 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN present_checks = 0 AND absent_checks > 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'ABSENT'
    WHEN conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN present_checks > 0 AND absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM summary;
