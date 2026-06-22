-- Read-only deep verification for 202606200003_phase9c_meeting_studio.sql

WITH expected AS (
  SELECT * FROM (VALUES
    ('202606200003','enum','meeting_session_status','draft|prepared|in_progress|completed|cancelled|archived'),
    ('202606200003','enum','meeting_summary_status','draft|adviser_reviewed|ready_for_publication|published|archived'),
    ('202606200003','table','meeting_sessions',NULL),
    ('202606200003','table','meeting_session_events',NULL),
    ('202606200003','column','meeting_sessions.status','USER-DEFINED|NO|draft'),
    ('202606200003','column','meeting_sessions.relationship_stage_at_start','USER-DEFINED|YES|'),
    ('202606200003','column','meeting_sessions.summary_payload','jsonb|NO|{}'),
    ('202606200003','column','meeting_sessions.appointment_id','uuid|YES|'),
    ('202606200003','constraint','meeting_sessions_meeting_type_check','meeting_type'),
    ('202606200003','constraint','meeting_sessions_selected_sections_is_array','jsonb_typeof'),
    ('202606200003','constraint','meeting_session_events_metadata_is_object','jsonb_typeof'),
    ('202606200003','index','idx_meeting_sessions_adviser_status','meeting_sessions'),
    ('202606200003','index','idx_meeting_sessions_appointment_id','appointment_id IS NOT NULL'),
    ('202606200003','index','idx_meeting_session_events_session_id','meeting_session_events'),
    ('202606200003','trigger','meeting_sessions_set_updated_at','set_updated_at'),
    ('202606200003','rls','meeting_sessions','enabled'),
    ('202606200003','rls','meeting_session_events','enabled'),
    ('202606200003','policy','meeting_sessions_select_adviser','SELECT'),
    ('202606200003','policy','meeting_session_events_select_adviser','SELECT'),
    ('202606200003','seed','platform_feature_controls.phase9c_keys','5')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
enum_values AS (
  SELECT t.typname, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typtype = 'e'
  GROUP BY t.typname
),
tables AS (
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
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
  FROM expected e
  WHERE e.check_kind = 'column'
),
cons AS (
  SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
),
idx AS (
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
),
trg AS (
  SELECT tg.tgname, pg_get_triggerdef(tg.oid) AS definition
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE n.nspname = 'public' AND NOT tg.tgisinternal
),
pol AS (
  SELECT policyname, cmd
  FROM pg_policies
  WHERE schemaname = 'public'
),
seed_probe AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::bigint
      ELSE NULLIF(
        ((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM platform_feature_controls
          WHERE feature_key IN (
            'adviser_meeting_studio',
            'meeting_presentation_mode',
            'meeting_exact_amount_presentations',
            'meeting_client_acknowledgements',
            'meeting_summary_publication'
          )$$, true, true, '')))[1]::text), ''
      )::bigint
    END AS seed_count
)
SELECT
  e.migration,
  e.check_kind || ':' || e.object_name AS check_id,
  e.object_name AS expected_object,
  CASE
    WHEN e.check_kind = 'enum' THEN ev.typname IS NOT NULL
    WHEN e.check_kind IN ('table','rls') THEN t.relname IS NOT NULL
    WHEN e.check_kind = 'column' THEN cd.object_name IS NOT NULL
    WHEN e.check_kind = 'constraint' THEN co.conname IS NOT NULL
    WHEN e.check_kind = 'index' THEN i.indexname IS NOT NULL
    WHEN e.check_kind = 'trigger' THEN tr.tgname IS NOT NULL
    WHEN e.check_kind = 'policy' THEN p.policyname IS NOT NULL
    WHEN e.check_kind = 'seed' THEN sp.seed_count IS NOT NULL
    ELSE NULL::boolean
  END AS present,
  CASE
    WHEN e.check_kind = 'enum' THEN ev.labels
    WHEN e.check_kind = 'column' THEN cd.data_type || '|' || cd.is_nullable || '|' || cd.column_default_raw
    WHEN e.check_kind = 'constraint' THEN co.definition
    WHEN e.check_kind = 'index' THEN i.indexdef
    WHEN e.check_kind = 'trigger' THEN tr.definition
    WHEN e.check_kind = 'policy' THEN p.cmd
    WHEN e.check_kind = 'rls' THEN CASE WHEN t.relrowsecurity THEN 'enabled' ELSE 'disabled' END
    WHEN e.check_kind = 'seed' THEN COALESCE(sp.seed_count::text, 'unknown')
    ELSE NULL
  END AS detail,
  CASE
    WHEN e.check_kind = 'enum' AND ev.typname IS NOT NULL AND ev.labels <> e.expected_detail THEN 'conflicting'
    WHEN e.check_kind = 'column' AND cd.object_name IS NOT NULL AND (
      cd.is_nullable <> ecs.exp_nullable
      OR (ecs.exp_data_type = 'USER-DEFINED' AND (cd.data_type <> 'USER-DEFINED' OR cd.udt_name IS DISTINCT FROM ecs.exp_udt_name))
      OR (ecs.exp_data_type <> 'USER-DEFINED' AND lower(cd.data_type) <> lower(ecs.exp_data_type))
      OR (ecs.exp_nullable = 'NO' AND ecs.exp_default_raw IS NOT NULL AND NULLIF(btrim(cd.column_default_raw), '') IS NULL)
      OR (ecs.exp_nullable = 'NO' AND ecs.exp_default_raw IS NOT NULL AND cd.canonical_detail IS DISTINCT FROM ecs.expected_canonical_detail)
    ) THEN 'conflicting'
    WHEN e.check_kind = 'constraint' AND co.conname IS NOT NULL AND co.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'trigger' AND tr.tgname IS NOT NULL AND tr.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'policy' AND p.policyname IS NOT NULL AND p.cmd <> e.expected_detail THEN 'conflicting'
    WHEN e.check_kind = 'rls' AND t.relname IS NOT NULL AND NOT t.relrowsecurity THEN 'conflicting'
    WHEN e.check_kind = 'seed' AND sp.seed_count IS NOT NULL AND sp.seed_count < e.expected_detail::bigint THEN 'conflicting'
    WHEN e.check_kind = 'seed' AND sp.seed_count IS NULL THEN 'unknown'
    WHEN (
      (e.check_kind='enum' AND ev.typname IS NULL) OR
      (e.check_kind IN ('table','rls') AND t.relname IS NULL) OR
      (e.check_kind='column' AND cd.object_name IS NULL) OR
      (e.check_kind='constraint' AND co.conname IS NULL) OR
      (e.check_kind='index' AND i.indexname IS NULL) OR
      (e.check_kind='trigger' AND tr.tgname IS NULL) OR
      (e.check_kind='policy' AND p.policyname IS NULL)
    ) THEN 'absent'
    ELSE 'present'
  END AS state
FROM expected e
LEFT JOIN enum_values ev ON e.check_kind='enum' AND ev.typname = e.object_name
LEFT JOIN tables t ON e.check_kind IN ('table','rls') AND t.relname = e.object_name
LEFT JOIN column_defs cd ON e.check_kind='column' AND cd.object_name = e.object_name
LEFT JOIN expected_column_specs ecs ON e.check_kind='column' AND ecs.migration = e.migration AND ecs.object_name = e.object_name
LEFT JOIN cons co ON e.check_kind='constraint' AND co.conname = e.object_name
LEFT JOIN idx i ON e.check_kind='index' AND i.indexname = e.object_name
LEFT JOIN trg tr ON e.check_kind='trigger' AND tr.tgname = e.object_name
LEFT JOIN pol p ON e.check_kind='policy' AND p.policyname = e.object_name
CROSS JOIN seed_probe sp
ORDER BY check_id;

-- Rollup
WITH rows AS (
  SELECT state FROM (
    SELECT
      CASE
        WHEN to_regclass('public.meeting_sessions') IS NULL THEN 'absent'
        WHEN to_regclass('public.meeting_session_events') IS NULL THEN 'absent'
        WHEN NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_session_status') THEN 'absent'
        WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND policyname='meeting_sessions_select_adviser') THEN 'absent'
        WHEN EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname='public' AND tablename='meeting_sessions' AND policyname ILIKE '%client%'
        ) THEN 'conflicting'
        ELSE 'present'
      END AS state
  ) x
),
summary AS (
  SELECT
    1::bigint AS total_required_checks,
    COUNT(*) FILTER (WHERE state='present') AS present_checks,
    COUNT(*) FILTER (WHERE state='absent') AS absent_checks,
    COUNT(*) FILTER (WHERE state='conflicting') AS conflicting_checks,
    COUNT(*) FILTER (WHERE state='unknown') AS unknown_checks
  FROM rows
)
SELECT
  '202606200003' AS migration,
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
