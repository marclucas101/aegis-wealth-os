-- Read-only deep verification for 202606200001_phase9a_compliance_access_architecture.sql
-- Catalog-safe: tolerates absent optional relations.

WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606200001','enum','relationship_stage','prospect|fact_find_complete|adviser_review|meeting_scheduled|recommendation_prepared|active_client|inactive_client'),
    ('202606200001','enum','output_audience','adviser_internal|meeting_presentation|client_published|public_education'),
    ('202606200001','enum','publication_status','draft|adviser_reviewed|published|superseded|expired|withdrawn'),
    ('202606200001','table','clients',NULL),
    ('202606200001','column','clients.relationship_stage','USER-DEFINED|NO|prospect'),
    ('202606200001','index','idx_clients_relationship_stage','CREATE INDEX idx_clients_relationship_stage ON public.clients USING btree (relationship_stage)'),
    ('202606200001','table','published_outputs',NULL),
    ('202606200001','column','published_outputs.output_audience','USER-DEFINED|NO|client_published'),
    ('202606200001','column','published_outputs.publication_status','USER-DEFINED|NO|draft'),
    ('202606200001','column','published_outputs.safe_payload','jsonb|NO|{}'),
    ('202606200001','constraint','published_outputs_output_type_check','output_type'),
    ('202606200001','constraint','published_outputs_safe_payload_is_object','jsonb_typeof'),
    ('202606200001','index','idx_published_outputs_client_type_status','published_outputs'),
    ('202606200001','index','idx_published_outputs_published_at','publication_status'),
    ('202606200001','trigger','published_outputs_set_updated_at','set_updated_at'),
    ('202606200001','rls','published_outputs','enabled'),
    ('202606200001','policy','published_outputs_select_client','SELECT'),
    ('202606200001','policy','published_outputs_select_adviser','SELECT'),
    ('202606200001','policy','published_outputs_select_admin','SELECT'),
    ('202606200001','table','platform_feature_controls',NULL),
    ('202606200001','column','platform_feature_controls.client_visible','boolean|NO|true'),
    ('202606200001','trigger','platform_feature_controls_set_updated_at','set_updated_at'),
    ('202606200001','rls','platform_feature_controls','enabled'),
    ('202606200001','policy','platform_feature_controls_select_admin','SELECT'),
    ('202606200001','seed','platform_feature_controls.phase9a_keys','6')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
enum_values AS (
  SELECT t.typname AS enum_name, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) AS labels
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typtype = 'e'
  GROUP BY t.typname
),
table_presence AS (
  SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
column_defs AS (
  SELECT
    cols.table_name || '.' || cols.column_name AS object_name,
    cols.data_type,
    cols.udt_schema,
    cols.udt_name,
    cols.is_nullable,
    COALESCE(cols.column_default, '') AS column_default_raw,
    (
      CASE WHEN cols.data_type = 'USER-DEFINED' THEN 'USER-DEFINED|' || cols.udt_name ELSE lower(cols.data_type) END
      || '|' || cols.is_nullable || '|' ||
      CASE
        WHEN NULLIF(btrim(COALESCE(cols.column_default, '')), '') IS NULL THEN ''
        WHEN lower(cols.data_type) IN ('json', 'jsonb')
          AND btrim(cols.column_default) ~ '^(\(*\s*)?''?\{\}''?(::jsonb)?\s*\)*$' THEN 'jsonb:{}'
        WHEN lower(cols.data_type) = 'boolean'
          AND lower(btrim(regexp_replace(regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'), '\)+$', '', 'g')))
            IN ('false', '''false''::boolean', 'false::boolean') THEN 'boolean:false'
        WHEN lower(cols.data_type) = 'boolean'
          AND lower(btrim(regexp_replace(regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'), '\)+$', '', 'g')))
            IN ('true', '''true''::boolean', 'true::boolean') THEN 'boolean:true'
        WHEN cols.data_type = 'USER-DEFINED' THEN
          'enum:' || cols.udt_name || ':' || COALESCE(
            (regexp_match(btrim(regexp_replace(regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'), '\)+$', '', 'g')), '^''([^'']+)''::'))[1],
            (regexp_match(btrim(regexp_replace(regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'), '\)+$', '', 'g')), '^''([^'']+)''$'))[1],
            btrim(regexp_replace(regexp_replace(btrim(cols.column_default), '^\(+', '', 'g'), '\)+$', '', 'g'))
          )
        WHEN lower(cols.data_type) = 'text' AND btrim(cols.column_default) ~ '^''([^'']+)''(::text)?$' THEN
          'text:' || (regexp_match(btrim(cols.column_default), '^''([^'']+)''(::text)?$'))[1]
        WHEN lower(cols.data_type) = 'text' AND btrim(cols.column_default) !~ '[''()]' THEN
          'text:' || btrim(cols.column_default)
        ELSE 'raw:' || btrim(cols.column_default)
      END
    ) AS canonical_detail
  FROM information_schema.columns cols
  WHERE cols.table_schema = 'public'
),
expected_column_specs AS (
  SELECT
    e.migration,
    e.object_name,
    split_part(e.expected_detail, '|', 1) AS exp_data_type,
    split_part(e.expected_detail, '|', 2) AS exp_nullable,
    NULLIF(split_part(e.expected_detail, '|', 3), '') AS exp_default_raw,
    CASE
      WHEN split_part(e.expected_detail, '|', 1) = 'USER-DEFINED' THEN
        CASE e.object_name
          WHEN 'clients.relationship_stage' THEN 'relationship_stage'
          WHEN 'published_outputs.output_audience' THEN 'output_audience'
          WHEN 'published_outputs.publication_status' THEN 'publication_status'
          WHEN 'meeting_sessions.status' THEN 'meeting_session_status'
          WHEN 'meeting_sessions.relationship_stage_at_start' THEN 'relationship_stage'
          ELSE split_part(e.object_name, '.', 2)
        END
      ELSE NULL
    END AS exp_udt_name,
    (
      CASE
        WHEN split_part(e.expected_detail, '|', 1) = 'USER-DEFINED' THEN
          'USER-DEFINED|' ||
          CASE e.object_name
            WHEN 'clients.relationship_stage' THEN 'relationship_stage'
            WHEN 'published_outputs.output_audience' THEN 'output_audience'
            WHEN 'published_outputs.publication_status' THEN 'publication_status'
            WHEN 'meeting_sessions.status' THEN 'meeting_session_status'
            WHEN 'meeting_sessions.relationship_stage_at_start' THEN 'relationship_stage'
            ELSE split_part(e.object_name, '.', 2)
          END
        ELSE lower(split_part(e.expected_detail, '|', 1))
      END
      || '|' || split_part(e.expected_detail, '|', 2)
      || '|' ||
      CASE
        WHEN NULLIF(split_part(e.expected_detail, '|', 3), '') IS NULL THEN ''
        WHEN split_part(e.expected_detail, '|', 1) = 'USER-DEFINED' THEN
          'enum:' ||
          CASE e.object_name
            WHEN 'clients.relationship_stage' THEN 'relationship_stage'
            WHEN 'published_outputs.output_audience' THEN 'output_audience'
            WHEN 'published_outputs.publication_status' THEN 'publication_status'
            WHEN 'meeting_sessions.status' THEN 'meeting_session_status'
            WHEN 'meeting_sessions.relationship_stage_at_start' THEN 'relationship_stage'
            ELSE split_part(e.object_name, '.', 2)
          END
          || ':' || split_part(e.expected_detail, '|', 3)
        WHEN lower(split_part(e.expected_detail, '|', 1)) IN ('json', 'jsonb')
          AND split_part(e.expected_detail, '|', 3) = '{}' THEN 'jsonb:{}'
        WHEN lower(split_part(e.expected_detail, '|', 1)) = 'boolean' THEN
          'boolean:' || lower(split_part(e.expected_detail, '|', 3))
        WHEN lower(split_part(e.expected_detail, '|', 1)) = 'text' THEN
          'text:' || split_part(e.expected_detail, '|', 3)
        ELSE 'raw:' || split_part(e.expected_detail, '|', 3)
      END
    ) AS expected_canonical_detail
  FROM expected_checks e
  WHERE e.check_kind = 'column'
),
constraint_defs AS (
  SELECT con.conname AS object_name, pg_get_constraintdef(con.oid) AS definition
  FROM pg_constraint con
),
index_defs AS (
  SELECT idx.indexname AS object_name, idx.indexdef AS definition
  FROM pg_indexes idx
  WHERE idx.schemaname = 'public'
),
trigger_defs AS (
  SELECT tg.tgname AS object_name, pg_get_triggerdef(tg.oid) AS definition
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public' AND NOT tg.tgisinternal
),
policy_defs AS (
  SELECT pol.policyname AS object_name, pol.cmd AS cmd
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
),
seed_probe AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::bigint
      ELSE (
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              $$SELECT count(*)::text AS cnt
                FROM platform_feature_controls
               WHERE feature_key IN (
                 'raw_client_financial_views',
                 'prospect_readiness_snapshot',
                 'client_published_financial_overview',
                 'client_stress_test_visibility',
                 'adviser_publication_workflow',
                 'insights_and_updates'
               )$$,
              true, true, ''
            )
          ))[1]::text),
          ''
        )::bigint
      )
    END AS seed_count
)
SELECT
  e.migration,
  e.check_kind || ':' || e.object_name AS check_id,
  e.object_name AS expected_object,
  CASE
    WHEN e.check_kind = 'enum' THEN (ev.enum_name IS NOT NULL)
    WHEN e.check_kind = 'table' THEN (tp.table_name IS NOT NULL)
    WHEN e.check_kind = 'column' THEN (cd.object_name IS NOT NULL)
    WHEN e.check_kind = 'constraint' THEN (co.object_name IS NOT NULL)
    WHEN e.check_kind = 'index' THEN (ix.object_name IS NOT NULL)
    WHEN e.check_kind = 'trigger' THEN (tr.object_name IS NOT NULL)
    WHEN e.check_kind = 'policy' THEN (po.object_name IS NOT NULL)
    WHEN e.check_kind = 'rls' THEN (tp.table_name IS NOT NULL)
    WHEN e.check_kind = 'seed' THEN (sp.seed_count IS NOT NULL)
    ELSE NULL::boolean
  END AS present,
  CASE
    WHEN e.check_kind = 'enum' THEN ev.labels
    WHEN e.check_kind = 'column' THEN cd.data_type || '|' || cd.is_nullable || '|' || cd.column_default_raw
    WHEN e.check_kind = 'constraint' THEN co.definition
    WHEN e.check_kind = 'index' THEN ix.definition
    WHEN e.check_kind = 'trigger' THEN tr.definition
    WHEN e.check_kind = 'policy' THEN po.cmd
    WHEN e.check_kind = 'rls' THEN CASE WHEN tp.rls_enabled THEN 'enabled' ELSE 'disabled' END
    WHEN e.check_kind = 'seed' THEN COALESCE(sp.seed_count::text, 'unknown')
    ELSE NULL
  END AS detail,
  CASE
    WHEN e.check_kind = 'enum' AND ev.enum_name IS NOT NULL AND ev.labels <> e.expected_detail THEN 'conflicting'
    WHEN e.check_kind = 'column' AND cd.object_name IS NOT NULL AND (
      cd.is_nullable <> ecs.exp_nullable
      OR (ecs.exp_data_type = 'USER-DEFINED' AND (cd.data_type <> 'USER-DEFINED' OR cd.udt_name IS DISTINCT FROM ecs.exp_udt_name))
      OR (ecs.exp_data_type <> 'USER-DEFINED' AND lower(cd.data_type) <> lower(ecs.exp_data_type))
      OR (ecs.exp_nullable = 'NO' AND ecs.exp_default_raw IS NOT NULL AND NULLIF(btrim(cd.column_default_raw), '') IS NULL)
      OR (ecs.exp_nullable = 'NO' AND ecs.exp_default_raw IS NOT NULL AND cd.canonical_detail IS DISTINCT FROM ecs.expected_canonical_detail)
    ) THEN 'conflicting'
    WHEN e.check_kind = 'constraint' AND co.object_name IS NOT NULL AND co.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'index' AND ix.object_name IS NOT NULL AND ix.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'trigger' AND tr.object_name IS NOT NULL AND tr.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'policy' AND po.object_name IS NOT NULL AND po.cmd <> e.expected_detail THEN 'conflicting'
    WHEN e.check_kind = 'rls' AND tp.table_name IS NOT NULL AND NOT tp.rls_enabled THEN 'conflicting'
    WHEN e.check_kind = 'seed' AND sp.seed_count IS NOT NULL AND sp.seed_count < e.expected_detail::bigint THEN 'conflicting'
    WHEN e.check_kind IN ('seed') AND sp.seed_count IS NULL THEN 'unknown'
    WHEN (
      (e.check_kind = 'enum' AND ev.enum_name IS NULL) OR
      (e.check_kind = 'table' AND tp.table_name IS NULL) OR
      (e.check_kind = 'column' AND cd.object_name IS NULL) OR
      (e.check_kind = 'constraint' AND co.object_name IS NULL) OR
      (e.check_kind = 'index' AND ix.object_name IS NULL) OR
      (e.check_kind = 'trigger' AND tr.object_name IS NULL) OR
      (e.check_kind = 'policy' AND po.object_name IS NULL) OR
      (e.check_kind = 'rls' AND tp.table_name IS NULL)
    ) THEN 'absent'
    ELSE 'present'
  END AS state
FROM expected_checks e
LEFT JOIN enum_values ev ON e.check_kind = 'enum' AND ev.enum_name = e.object_name
LEFT JOIN table_presence tp ON (e.check_kind IN ('table','rls') AND tp.table_name = e.object_name)
LEFT JOIN column_defs cd ON e.check_kind = 'column' AND cd.object_name = e.object_name
LEFT JOIN expected_column_specs ecs ON e.check_kind = 'column' AND ecs.migration = e.migration AND ecs.object_name = e.object_name
LEFT JOIN constraint_defs co ON e.check_kind = 'constraint' AND co.object_name = e.object_name
LEFT JOIN index_defs ix ON e.check_kind = 'index' AND ix.object_name = e.object_name
LEFT JOIN trigger_defs tr ON e.check_kind = 'trigger' AND tr.object_name = e.object_name
LEFT JOIN policy_defs po ON e.check_kind = 'policy' AND po.object_name = e.object_name
CROSS JOIN seed_probe sp
ORDER BY check_id;

-- Rollup (CTE chain re-declared — PostgreSQL CTEs are statement-scoped)
WITH raw AS (
  SELECT * FROM (
    SELECT state
    FROM (
      WITH expected_checks AS (
        SELECT * FROM (VALUES
          ('enum','relationship_stage','prospect|fact_find_complete|adviser_review|meeting_scheduled|recommendation_prepared|active_client|inactive_client'),
          ('enum','output_audience','adviser_internal|meeting_presentation|client_published|public_education'),
          ('enum','publication_status','draft|adviser_reviewed|published|superseded|expired|withdrawn'),
          ('table','published_outputs',NULL),
          ('table','platform_feature_controls',NULL),
          ('policy','published_outputs_select_client','SELECT'),
          ('policy','platform_feature_controls_select_admin','SELECT')
        ) AS t(check_kind, object_name, expected_detail)
      )
      SELECT
        CASE
          WHEN check_kind = 'enum' AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = object_name) THEN 'absent'
          WHEN check_kind = 'table' AND to_regclass('public.' || object_name) IS NULL THEN 'absent'
          WHEN check_kind = 'policy' AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND policyname = object_name) THEN 'absent'
          ELSE 'present'
        END AS state
      FROM expected_checks
    ) x
  ) y
),
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE state = 'present') AS present_checks,
    COUNT(*) FILTER (WHERE state = 'absent') AS absent_checks,
    COUNT(*) FILTER (WHERE state = 'conflicting') AS conflicting_checks,
    COUNT(*) FILTER (WHERE state = 'unknown') AS unknown_checks
  FROM raw
)
SELECT
  '202606200001' AS migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  unknown_checks,
  CASE
    WHEN present_checks = total_required_checks AND absent_checks = 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN present_checks = 0 AND absent_checks > 0 AND conflicting_checks = 0 THEN 'ABSENT'
    WHEN conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN present_checks > 0 AND absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM summary;
