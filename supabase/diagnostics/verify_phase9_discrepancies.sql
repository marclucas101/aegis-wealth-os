-- Read-only Phase 9 discrepancy report.
-- Same 106-check inventory and catalog resolution as verify_phase9_migrations.sql.
-- Returns only absent, conflicting, or unknown checks — never present rows.
-- Does not apply dependency blocking; each check is evaluated independently.

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
    ('202606200001','seed','platform_feature_controls.phase9a_keys','6'),
    ('202606200002','index','idx_published_outputs_one_current_published','UNIQUE'),
    ('202606200002','index_def','idx_published_outputs_one_current_published','WHERE ((publication_status = ''published''::publication_status) AND (withdrawn_at IS NULL) AND (superseded_at IS NULL))'),
    ('202606200002','index_cols','idx_published_outputs_one_current_published','(client_id, output_type, output_audience)'),
    ('202606200002','comment','idx_published_outputs_one_current_published','at most one current published output'),
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
    ('202606200003','seed','platform_feature_controls.phase9c_keys','5'),
    ('202606200004','policy_comment','meeting_sessions_select_adviser','Assigned adviser or admin SELECT only'),
    ('202606200004','policy_comment','meeting_session_events_select_adviser','Assigned adviser or admin SELECT only'),
    ('202606200004','no_client_policy','meeting_sessions',''),
    ('202606200004','no_client_policy','meeting_session_events',''),
    ('202606200005','constraint','published_outputs_output_type_check','client_plan_summary'),
    ('202606200005','constraint','published_outputs_output_type_check','goal_plan_summary'),
    ('202606200005','constraint','published_outputs_output_type_check','meeting_summary'),
    ('202606200005','column','roadmap_items.task_owner','text|NO|adviser'),
    ('202606200005','column','roadmap_items.client_visible','boolean|NO|false'),
    ('202606200005','column','roadmap_items.client_status_label','text|YES|'),
    ('202606200005','column','roadmap_items.display_category','text|YES|'),
    ('202606200005','constraint','roadmap_items_task_owner_check','task_owner'),
    ('202606200005','table','client_goals',NULL),
    ('202606200005','index','idx_client_goals_client_id','client_goals'),
    ('202606200005','trigger','client_goals_set_updated_at','set_updated_at'),
    ('202606200005','policy','client_goals_select_owner','SELECT'),
    ('202606200005','policy','client_goals_insert_owner','INSERT'),
    ('202606200005','policy','client_goals_update_owner','UPDATE'),
    ('202606200005','table','client_review_submissions',NULL),
    ('202606200005','constraint','client_review_submissions_source_key_unique','UNIQUE'),
    ('202606200005','index','idx_client_review_submissions_client','client_review_submissions'),
    ('202606200005','trigger','client_review_submissions_set_updated_at','set_updated_at'),
    ('202606200005','policy','client_review_submissions_select_owner','SELECT'),
    ('202606200005','policy','client_review_submissions_insert_client','INSERT'),
    ('202606200005','dup_probe','client_review_submissions.source_key','0'),
    ('202606200006','table','governed_content',NULL),
    ('202606200006','table','client_notifications',NULL),
    ('202606200006','table','communication_preferences',NULL),
    ('202606200006','table','communication_deliveries',NULL),
    ('202606200006','table','binder_exports',NULL),
    ('202606200006','table','promotion_migration_reviews',NULL),
    ('202606200006','constraint','governed_content_approval_status_check','approval_status'),
    ('202606200006','constraint','governed_content_audience_scope_check','audience_scope'),
    ('202606200006','constraint','client_notifications_type_check','notification_type'),
    ('202606200006','constraint','communication_deliveries_status_check','delivery_status'),
    ('202606200006','constraint','binder_exports_status_check','status'),
    ('202606200006','index','idx_governed_content_published','approval_status'),
    ('202606200006','index','idx_communication_deliveries_status','retrying'),
    ('202606200006','index','idx_client_notifications_unread','read_at IS NULL'),
    ('202606200006','policy','client_notifications_select_owner','SELECT'),
    ('202606200006','policy','client_notifications_update_owner','UPDATE'),
    ('202606200006','policy','communication_preferences_select_owner','SELECT'),
    ('202606200006','policy','communication_preferences_update_owner','UPDATE'),
    ('202606200006','rls','governed_content','enabled'),
    ('202606200006','rls','client_notifications','enabled'),
    ('202606200006','rls','communication_preferences','enabled'),
    ('202606200006','rls','communication_deliveries','enabled'),
    ('202606200006','rls','binder_exports','enabled'),
    ('202606200006','seed','platform_feature_controls.phase9e_keys','10'),
    ('202606200007','index','idx_client_notifications_idempotent','UNIQUE'),
    ('202606200007','index','idx_communication_deliveries_idempotent','UNIQUE'),
    ('202606200007','index_def','idx_client_notifications_idempotent','WHERE ((reference_id IS NOT NULL) AND (reference_type IS NOT NULL))'),
    ('202606200007','index_def','idx_communication_deliveries_idempotent','WHERE (communication_id IS NOT NULL)'),
    ('202606200007','comment','governed_content','RLS enabled'),
    ('202606200007','comment','communication_deliveries','RLS enabled'),
    ('202606200007','comment','binder_exports','RLS enabled'),
    ('202606200007','comment','promotion_migration_reviews','UNIQUE(promotion_id)')
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
    END AS canonical_default,
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
policy_expressions AS (
  SELECT
    pol.policyname AS object_name,
    pol.cmd
      || COALESCE(' USING (' || pol.qual || ')', '')
      || COALESCE(' WITH CHECK (' || pol.with_check || ')', '') AS full_definition
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
),
policy_comments AS (
  SELECT pol.policyname, d.description
  FROM pg_policy pp
  JOIN pg_class c ON c.oid = pp.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_policies pol ON pol.schemaname = n.nspname AND pol.tablename = c.relname AND pol.policyname = pp.polname
  LEFT JOIN pg_description d ON d.objoid = pp.oid
  WHERE n.nspname = 'public'
),
index_comments AS (
  SELECT cls.relname AS indexname, d.description
  FROM pg_class cls
  JOIN pg_namespace n ON n.oid = cls.relnamespace
  LEFT JOIN pg_description d ON d.objoid = cls.oid AND d.classoid = 'pg_class'::regclass
  WHERE n.nspname = 'public' AND cls.relkind = 'i'
),
table_comments AS (
  SELECT c.relname AS table_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
client_policy_counts AS (
  SELECT
    tablename,
    COUNT(*) FILTER (WHERE policyname ILIKE '%client%') AS client_named_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename IN ('meeting_sessions','meeting_session_events')
  GROUP BY tablename
),
seed_counts AS (
  SELECT
    'platform_feature_controls.phase9a_keys'::text AS seed_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::bigint
      ELSE NULLIF(
        ((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM platform_feature_controls
          WHERE feature_key IN (
            'raw_client_financial_views','prospect_readiness_snapshot',
            'client_published_financial_overview','client_stress_test_visibility',
            'adviser_publication_workflow','insights_and_updates'
          )$$, true, true, '')))[1]::text), ''
      )::bigint
    END AS seed_count
  UNION ALL
  SELECT
    'platform_feature_controls.phase9c_keys',
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::bigint
      ELSE NULLIF(
        ((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM platform_feature_controls
          WHERE feature_key IN (
            'adviser_meeting_studio','meeting_presentation_mode',
            'meeting_exact_amount_presentations','meeting_client_acknowledgements',
            'meeting_summary_publication'
          )$$, true, true, '')))[1]::text), ''
      )::bigint
    END
  UNION ALL
  SELECT
    'platform_feature_controls.phase9e_keys',
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::bigint
      ELSE NULLIF(
        ((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM platform_feature_controls
          WHERE feature_key IN (
            'adviser_insight_authoring','admin_content_approval','market_updates',
            'product_related_content','client_in_app_notifications','client_email_notifications',
            'document_event_notifications','communication_preferences','binder_export',
            'binder_client_publication'
          )$$, true, true, '')))[1]::text), ''
      )::bigint
    END
),
dup_review_source AS (
  SELECT
    CASE
      WHEN to_regclass('public.client_review_submissions') IS NULL THEN NULL::bigint
      ELSE NULLIF(
        ((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM (
            SELECT source_key
            FROM client_review_submissions
            GROUP BY source_key
            HAVING count(*) > 1
          ) d$$, true, true, '')))[1]::text), ''
      )::bigint
    END AS duplicate_count
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind || ':' || e.object_name || COALESCE(':' || LEFT(e.expected_detail, 24), '') AS check_id,
    e.check_kind,
    e.object_name AS expected_object,
    e.expected_detail,
    CASE
      WHEN e.check_kind = 'enum' AND ev.enum_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'enum' AND ev.labels <> e.expected_detail THEN 'conflicting'
      WHEN e.check_kind = 'table' AND tp.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND cd.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND cd.object_name IS NOT NULL AND (
        cd.is_nullable <> ecs.exp_nullable
        OR (ecs.exp_data_type = 'USER-DEFINED' AND (cd.data_type <> 'USER-DEFINED' OR cd.udt_name IS DISTINCT FROM ecs.exp_udt_name))
        OR (ecs.exp_data_type <> 'USER-DEFINED' AND lower(cd.data_type) <> lower(ecs.exp_data_type))
        OR (ecs.exp_nullable = 'NO' AND ecs.exp_default_raw IS NOT NULL AND NULLIF(btrim(cd.column_default_raw), '') IS NULL)
        OR (ecs.exp_nullable = 'NO' AND ecs.exp_default_raw IS NOT NULL AND cd.canonical_detail IS DISTINCT FROM ecs.expected_canonical_detail)
      ) THEN 'conflicting'
      WHEN e.check_kind = 'constraint' AND co.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'constraint' AND co.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
      WHEN e.check_kind = 'index' AND ix.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'index' AND e.expected_detail = 'UNIQUE' AND ix.definition NOT ILIKE '%UNIQUE INDEX%' THEN 'conflicting'
      WHEN e.check_kind = 'index' AND e.expected_detail <> 'UNIQUE' AND ix.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
      WHEN e.check_kind = 'index_def' AND ix.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'index_def' AND ix.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
      WHEN e.check_kind = 'index_cols' AND ix.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'index_cols' AND ix.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
      WHEN e.check_kind = 'trigger' AND tr.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'trigger' AND tr.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
      WHEN e.check_kind = 'rls' AND tp.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'rls' AND NOT tp.rls_enabled THEN 'conflicting'
      WHEN e.check_kind = 'policy' AND po.object_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'policy' AND po.cmd <> e.expected_detail THEN 'conflicting'
      WHEN e.check_kind = 'policy_comment' AND pc.policyname IS NULL THEN 'absent'
      WHEN e.check_kind = 'policy_comment' AND (pc.description IS NULL OR pc.description NOT ILIKE '%' || e.expected_detail || '%') THEN 'conflicting'
      WHEN e.check_kind = 'no_client_policy' AND COALESCE(cpc.client_named_policies, 0) > 0 THEN 'conflicting'
      WHEN e.check_kind = 'seed' AND sc.seed_count IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND sc.seed_count < e.expected_detail::bigint THEN 'conflicting'
      WHEN e.check_kind = 'dup_probe' AND drs.duplicate_count IS NULL THEN 'unknown'
      WHEN e.check_kind = 'dup_probe' AND drs.duplicate_count > 0 THEN 'conflicting'
      WHEN e.check_kind = 'comment' AND e.object_name LIKE 'idx_%' AND ic.indexname IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment' AND e.object_name LIKE 'idx_%' AND (ic.description IS NULL OR ic.description NOT ILIKE '%' || e.expected_detail || '%') THEN 'conflicting'
      WHEN e.check_kind = 'comment' AND e.object_name NOT LIKE 'idx_%' AND tc.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment' AND e.object_name NOT LIKE 'idx_%' AND (tc.description IS NULL OR tc.description NOT ILIKE '%' || e.expected_detail || '%') THEN 'conflicting'
      ELSE 'present'
    END AS state,
    CASE
      WHEN e.check_kind = 'enum' THEN ev.labels
      WHEN e.check_kind = 'table' THEN tp.table_name
      WHEN e.check_kind = 'column' THEN cd.data_type || '|' || cd.is_nullable || '|' || cd.column_default_raw
      WHEN e.check_kind = 'constraint' THEN co.definition
      WHEN e.check_kind IN ('index','index_def','index_cols') THEN ix.definition
      WHEN e.check_kind = 'trigger' THEN tr.definition
      WHEN e.check_kind = 'rls' THEN
        CASE
          WHEN tp.table_name IS NULL THEN NULL
          WHEN tp.rls_enabled THEN 'enabled'
          ELSE 'disabled'
        END
      WHEN e.check_kind = 'policy' THEN pex.full_definition
      WHEN e.check_kind = 'policy_comment' THEN pc.description
      WHEN e.check_kind = 'no_client_policy' THEN COALESCE(cpc.client_named_policies, 0)::text || ' client-named policies on ' || e.object_name
      WHEN e.check_kind = 'seed' THEN sc.seed_count::text
      WHEN e.check_kind = 'dup_probe' THEN drs.duplicate_count::text
      WHEN e.check_kind = 'comment' AND e.object_name LIKE 'idx_%' THEN ic.description
      WHEN e.check_kind = 'comment' AND e.object_name NOT LIKE 'idx_%' THEN tc.description
      ELSE NULL
    END AS actual_detail,
    ecs.expected_canonical_detail,
    cd.canonical_detail AS actual_canonical_detail,
    cd.udt_schema AS actual_udt_schema,
    cd.udt_name AS actual_udt_name
  FROM expected_checks e
  LEFT JOIN enum_values ev ON e.check_kind = 'enum' AND ev.enum_name = e.object_name
  LEFT JOIN table_presence tp ON e.check_kind IN ('table','rls') AND tp.table_name = e.object_name
  LEFT JOIN column_defs cd ON e.check_kind = 'column' AND cd.object_name = e.object_name
  LEFT JOIN expected_column_specs ecs ON e.check_kind = 'column' AND ecs.migration = e.migration AND ecs.object_name = e.object_name
  LEFT JOIN constraint_defs co ON e.check_kind = 'constraint' AND co.object_name = e.object_name
  LEFT JOIN index_defs ix ON e.check_kind IN ('index','index_def','index_cols') AND ix.object_name = e.object_name
  LEFT JOIN trigger_defs tr ON e.check_kind = 'trigger' AND tr.object_name = e.object_name
  LEFT JOIN policy_defs po ON e.check_kind = 'policy' AND po.object_name = e.object_name
  LEFT JOIN policy_expressions pex ON e.check_kind = 'policy' AND pex.object_name = e.object_name
  LEFT JOIN policy_comments pc ON e.check_kind = 'policy_comment' AND pc.policyname = e.object_name
  LEFT JOIN client_policy_counts cpc ON e.check_kind = 'no_client_policy' AND cpc.tablename = e.object_name
  LEFT JOIN seed_counts sc ON e.check_kind = 'seed' AND sc.seed_key = e.object_name
  LEFT JOIN index_comments ic ON e.check_kind = 'comment' AND e.object_name LIKE 'idx_%' AND ic.indexname = e.object_name
  LEFT JOIN table_comments tc ON e.check_kind = 'comment' AND e.object_name NOT LIKE 'idx_%' AND tc.table_name = e.object_name
  CROSS JOIN dup_review_source drs
),
discrepancies AS (
  SELECT
    r.migration,
    r.check_id,
    r.check_kind,
    r.expected_object,
    r.state,
    r.expected_detail,
    r.actual_detail,
    r.expected_canonical_detail,
    r.actual_canonical_detail,
    r.actual_udt_schema,
    r.actual_udt_name,
    CASE
      WHEN r.state = 'absent' AND r.check_kind = 'enum' THEN
        'Enum type missing from pg_type; migration may not have run or type was renamed.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'enum' THEN
        'Enum labels differ from expected pipe-delimited inventory; compare label order, spelling, and additions or removals manually.'
      WHEN r.state = 'absent' AND r.check_kind = 'table' THEN
        'Table missing from public schema; migration object not created or relation renamed.'
      WHEN r.state = 'absent' THEN
        'Expected catalog object missing; compare migration file and remote history.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'column' THEN
        'Column type, nullability, udt_name, or canonical default differs; compare expected_canonical_detail and actual_canonical_detail to separate formatting from drift.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'constraint' THEN
        'Constraint definition text differs; equivalent CHECK/UNIQUE predicates may differ only in whitespace or qualification.'
      WHEN r.state = 'conflicting' AND r.check_kind IN ('index','index_def','index_cols') THEN
        'Index definition or predicate differs; review indexdef, UNIQUE flag, column list, and WHERE clause for cosmetic versus semantic drift.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'trigger' THEN
        'Trigger definition differs; function name or timing may match semantically with different formatting.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'rls' THEN
        'Row level security is disabled on a table the migration enables.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'policy' THEN
        'Policy command or USING/WITH CHECK expression differs; compare full policy text for expression drift.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'policy_comment' THEN
        'Policy COMMENT ON metadata differs or is missing; wording-only differences require manual review.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'no_client_policy' THEN
        'Unexpected client-named RLS policies exist on meeting studio tables.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'comment' THEN
        'Table or index COMMENT ON text differs or is missing; metadata-only drift possible.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'seed' THEN
        'Feature-control seed count below expected; keys may be missing or table partially seeded.'
      WHEN r.state = 'conflicting' AND r.check_kind = 'dup_probe' THEN
        'Duplicate source_key values detected in client_review_submissions.'
      WHEN r.state = 'unknown' AND r.check_kind = 'seed' THEN
        'platform_feature_controls absent or seed probe could not count rows safely.'
      WHEN r.state = 'unknown' AND r.check_kind = 'dup_probe' THEN
        'client_review_submissions absent or duplicate probe could not run safely.'
      WHEN r.state = 'unknown' THEN
        'Catalog probe returned unknown; optional relation may be absent.'
      WHEN r.state = 'conflicting' THEN
        'Live catalog differs from migration expectation; compare expected_detail and actual_detail manually.'
      ELSE
        'Discrepancy requires manual review.'
    END AS suggested_interpretation
  FROM resolved r
  WHERE r.state IN ('conflicting', 'absent', 'unknown')
)
SELECT
  migration,
  check_id,
  check_kind,
  expected_object,
  state,
  expected_detail,
  actual_detail,
  expected_canonical_detail,
  actual_canonical_detail,
  actual_udt_schema,
  actual_udt_name,
  suggested_interpretation
FROM discrepancies
ORDER BY migration, check_kind, check_id;
