-- Consolidated read-only rollup for Phase 9 migrations.
-- Aggregates the detailed per-object checks from all seven dedicated diagnostics.

WITH expected_checks AS (
  SELECT * FROM (VALUES
    -- 202606200001_phase9a_compliance_access_architecture (25 checks)
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
    -- 202606200002_phase9a_publication_hardening (4 checks)
    ('202606200002','index','idx_published_outputs_one_current_published','UNIQUE'),
    ('202606200002','index_def','idx_published_outputs_one_current_published','WHERE ((publication_status = ''published''::publication_status) AND (withdrawn_at IS NULL) AND (superseded_at IS NULL))'),
    ('202606200002','index_cols','idx_published_outputs_one_current_published','(client_id, output_type, output_audience)'),
    ('202606200002','comment','idx_published_outputs_one_current_published','at most one current published output'),
    -- 202606200003_phase9c_meeting_studio (20 checks)
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
    -- 202606200004_phase9c_meeting_studio_rls_documentation (4 checks)
    ('202606200004','policy_comment','meeting_sessions_select_adviser','Assigned adviser or admin SELECT only'),
    ('202606200004','policy_comment','meeting_session_events_select_adviser','Assigned adviser or admin SELECT only'),
    ('202606200004','no_client_policy','meeting_sessions',''),
    ('202606200004','no_client_policy','meeting_session_events',''),
    -- 202606200005_phase9d_converted_client_portal (21 checks)
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
    -- 202606200006_phase9e_communications_governance (24 checks)
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
    -- 202606200007_phase9e_hardening (8 checks)
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
    END AS state
  FROM expected_checks e
  LEFT JOIN enum_values ev ON e.check_kind = 'enum' AND ev.enum_name = e.object_name
  LEFT JOIN table_presence tp ON e.check_kind IN ('table','rls') AND tp.table_name = e.object_name
  LEFT JOIN column_defs cd ON e.check_kind = 'column' AND cd.object_name = e.object_name
  LEFT JOIN expected_column_specs ecs ON e.check_kind = 'column' AND ecs.migration = e.migration AND ecs.object_name = e.object_name
  LEFT JOIN constraint_defs co ON e.check_kind = 'constraint' AND co.object_name = e.object_name
  LEFT JOIN index_defs ix ON e.check_kind IN ('index','index_def','index_cols') AND ix.object_name = e.object_name
  LEFT JOIN trigger_defs tr ON e.check_kind = 'trigger' AND tr.object_name = e.object_name
  LEFT JOIN policy_defs po ON e.check_kind = 'policy' AND po.object_name = e.object_name
  LEFT JOIN policy_comments pc ON e.check_kind = 'policy_comment' AND pc.policyname = e.object_name
  LEFT JOIN client_policy_counts cpc ON e.check_kind = 'no_client_policy' AND cpc.tablename = e.object_name
  LEFT JOIN seed_counts sc ON e.check_kind = 'seed' AND sc.seed_key = e.object_name
  LEFT JOIN index_comments ic ON e.check_kind = 'comment' AND e.object_name LIKE 'idx_%' AND ic.indexname = e.object_name
  LEFT JOIN table_comments tc ON e.check_kind = 'comment' AND e.object_name NOT LIKE 'idx_%' AND tc.table_name = e.object_name
  CROSS JOIN dup_review_source drs
),
per_migration AS (
  SELECT
    migration,
    COUNT(*)::bigint AS total_required_checks,
    COUNT(*) FILTER (WHERE state = 'present')::bigint AS present_checks,
    COUNT(*) FILTER (WHERE state = 'absent')::bigint AS absent_checks,
    COUNT(*) FILTER (WHERE state = 'conflicting')::bigint AS conflicting_checks,
    COUNT(*) FILTER (WHERE state = 'unknown')::bigint AS unknown_checks
  FROM resolved
  GROUP BY migration
),
dependency_graph AS (
  SELECT * FROM (VALUES
    ('202606200001', NULL::text),
    ('202606200002', '202606200001'),
    ('202606200003', '202606200001'),
    ('202606200004', '202606200003'),
    ('202606200005', '202606200001'),
    ('202606200006', '202606200001'),
    ('202606200007', '202606200006')
  ) AS d(migration, depends_on)
),
migration_classification AS (
  SELECT
    p.migration,
    p.total_required_checks,
    p.present_checks,
    p.absent_checks,
    p.conflicting_checks,
    p.unknown_checks,
    CASE
      WHEN dg.depends_on IS NULL THEN 'READY'
      WHEN dep.present_checks = dep.total_required_checks
        AND dep.absent_checks = 0
        AND dep.conflicting_checks = 0
        AND dep.unknown_checks = 0 THEN 'READY'
      WHEN dep.present_checks = 0
        AND dep.absent_checks > 0
        AND dep.conflicting_checks = 0
        AND dep.unknown_checks = 0 THEN 'READY'
      ELSE 'BLOCKED_BY_DEPENDENCY'
    END AS dependency_status,
    CASE
      WHEN (
        CASE
          WHEN dg.depends_on IS NULL THEN 'READY'
          WHEN dep.present_checks = dep.total_required_checks
            AND dep.absent_checks = 0
            AND dep.conflicting_checks = 0
            AND dep.unknown_checks = 0 THEN 'READY'
          WHEN dep.present_checks = 0
            AND dep.absent_checks > 0
            AND dep.conflicting_checks = 0
            AND dep.unknown_checks = 0 THEN 'READY'
          ELSE 'BLOCKED_BY_DEPENDENCY'
        END
      ) = 'BLOCKED_BY_DEPENDENCY' THEN 'BLOCKED_BY_DEPENDENCY'
      WHEN p.present_checks = p.total_required_checks
        AND p.absent_checks = 0
        AND p.conflicting_checks = 0
        AND p.unknown_checks = 0 THEN 'EXACT_MATCH'
      WHEN p.present_checks = 0 AND p.absent_checks > 0 AND p.conflicting_checks = 0 AND p.unknown_checks = 0 THEN 'ABSENT'
      WHEN p.conflicting_checks > 0 THEN 'CONFLICTING'
      WHEN p.present_checks > 0 AND p.absent_checks > 0 THEN 'PARTIAL_MATCH'
      ELSE 'UNKNOWN'
    END AS classification
  FROM per_migration p
  LEFT JOIN dependency_graph dg ON dg.migration = p.migration
  LEFT JOIN per_migration dep ON dep.migration = dg.depends_on
)
SELECT
  migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  unknown_checks,
  dependency_status,
  classification
FROM migration_classification
ORDER BY migration;
