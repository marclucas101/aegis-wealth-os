-- Read-only verification for pending migrations 202606100019..202606200009.
-- Safe when expected post-018 relations are absent.
-- No writes. No schema changes. No migration-history modification.

-- =============================================================================
-- A. Migration history table availability (catalog-safe)
-- =============================================================================
WITH pending(version) AS (
  VALUES
    ('202606100019'), ('202606100020'), ('202606100021'), ('202606150001'),
    ('202606180001'), ('202606180002'), ('202606200001'), ('202606200002'),
    ('202606200003'), ('202606200004'), ('202606200005'), ('202606200006'),
    ('202606200007'), ('202606200008'), ('202606200009')
),
history_table AS (
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations'
      AND c.relname = 'schema_migrations'
      AND c.relkind IN ('r', 'p')
  ) AS present
)
SELECT
  p.version AS migration,
  'history_table_exists' AS check_id,
  'supabase_migrations.schema_migrations' AS expected_object,
  ht.present,
  CASE WHEN ht.present THEN 'present' ELSE 'absent' END AS state,
  'History-row checks are intentionally not executed here when table availability is unknown.' AS detail
FROM pending p
CROSS JOIN history_table ht
ORDER BY p.version;

-- =============================================================================
-- B. Object-level checks (always safe; catalog and information_schema only)
-- =============================================================================
WITH expected_checks AS (
  SELECT * FROM (VALUES
    -- 019
    ('202606100019','table','public','adviser_profiles',NULL),
    ('202606100019','trigger','public','adviser_profiles','adviser_profiles_set_updated_at'),
    ('202606100019','policy','public','adviser_profiles','adviser_profiles_select_own_assigned_or_admin'),
    ('202606100019','policy','public','adviser_profiles','adviser_profiles_insert_own_or_admin'),
    ('202606100019','policy','public','adviser_profiles','adviser_profiles_update_own_or_admin'),
    ('202606100019','policy','public','adviser_profiles','adviser_profiles_delete_admin'),
    ('202606100019','function','public',NULL,'adviser_id_from_storage_path'),
    ('202606100019','table','storage','buckets',NULL),
    ('202606100019','table','storage','objects',NULL),
    ('202606100019','policy','storage','objects','adviser_photos_select_own_or_admin'),
    ('202606100019','policy','storage','objects','adviser_photos_insert_own'),
    ('202606100019','policy','storage','objects','adviser_photos_update_own'),
    ('202606100019','policy','storage','objects','adviser_photos_delete_own'),
    ('202606100019','seed_row','storage','buckets','adviser-photos'),

    -- 020
    ('202606100020','extension',NULL,NULL,'btree_gist'),
    ('202606100020','table','public','adviser_calendar_connections',NULL),
    ('202606100020','table','public','adviser_calendar_settings',NULL),
    ('202606100020','table','public','adviser_appointments',NULL),
    ('202606100020','enum',NULL,NULL,'adviser_appointment_status'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_adviser_starts'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_client_starts'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_status'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_idempotency'),
    ('202606100020','constraint','public','adviser_appointments','adviser_appointments_no_overlap'),
    ('202606100020','policy','public','adviser_calendar_connections','adviser_calendar_connections_no_client_access'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_select_own_or_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_select_own_client_or_admin'),

    -- 021 / 150001 / 8A / 8B
    ('202606100021','index','public','adviser_feedback','idx_adviser_feedback_client_created'),
    ('202606100021','index','public','clients','idx_clients_advisor_display_name'),
    ('202606100021','index','public','discover_profiles','idx_discover_profiles_client_current'),
    ('202606150001','index','public','clients','clients_user_id_unique'),
    ('202606180001','column','public','clients','date_of_birth'),
    ('202606180001','column','public','advisor_tasks','source_key'),
    ('202606180001','column','public','advisor_tasks','dismissed_at'),
    ('202606180001','column','public','advisor_tasks','metadata'),
    ('202606180001','index','public','advisor_tasks','idx_advisor_tasks_source_key_unique'),
    ('202606180001','index','public','advisor_tasks','idx_advisor_tasks_birthday_open'),
    ('202606180002','column','public','adviser_appointments','source'),
    ('202606180002','column','public','adviser_appointments','created_by_user_id'),
    ('202606180002','column','public','adviser_appointments','notification_status'),
    ('202606180002','index','public','adviser_appointments','idx_adviser_appointments_creator_idempotency'),

    -- 9A / 9A hardening
    ('202606200001','enum',NULL,NULL,'relationship_stage'),
    ('202606200001','enum',NULL,NULL,'output_audience'),
    ('202606200001','enum',NULL,NULL,'publication_status'),
    ('202606200001','column','public','clients','relationship_stage'),
    ('202606200001','table','public','published_outputs',NULL),
    ('202606200001','table','public','platform_feature_controls',NULL),
    ('202606200001','policy','public','published_outputs','published_outputs_select_client'),
    ('202606200001','policy','public','platform_feature_controls','platform_feature_controls_select_admin'),
    ('202606200001','seed_row','public','platform_feature_controls','phase9a_feature_rows'),
    ('202606200002','index','public','published_outputs','idx_published_outputs_one_current_published'),

    -- 9C / 9C docs / 9D
    ('202606200003','enum',NULL,NULL,'meeting_session_status'),
    ('202606200003','enum',NULL,NULL,'meeting_summary_status'),
    ('202606200003','table','public','meeting_sessions',NULL),
    ('202606200003','table','public','meeting_session_events',NULL),
    ('202606200003','policy','public','meeting_sessions','meeting_sessions_select_adviser'),
    ('202606200003','policy','public','meeting_session_events','meeting_session_events_select_adviser'),
    ('202606200003','seed_row','public','platform_feature_controls','phase9c_feature_rows'),
    ('202606200004','policy_comment','public','meeting_sessions','meeting_sessions_select_adviser'),
    ('202606200004','policy_comment','public','meeting_session_events','meeting_session_events_select_adviser'),
    ('202606200005','column','public','roadmap_items','task_owner'),
    ('202606200005','column','public','roadmap_items','client_visible'),
    ('202606200005','table','public','client_goals',NULL),
    ('202606200005','table','public','client_review_submissions',NULL),
    ('202606200005','policy','public','client_goals','client_goals_select_owner'),
    ('202606200005','policy','public','client_review_submissions','client_review_submissions_select_owner'),

    -- 9E / 9E hardening
    ('202606200006','table','public','governed_content',NULL),
    ('202606200006','table','public','client_notifications',NULL),
    ('202606200006','table','public','communication_preferences',NULL),
    ('202606200006','table','public','communication_deliveries',NULL),
    ('202606200006','table','public','binder_exports',NULL),
    ('202606200006','table','public','promotion_migration_reviews',NULL),
    ('202606200006','rls_enabled','public','governed_content',NULL),
    ('202606200006','rls_enabled','public','client_notifications',NULL),
    ('202606200006','rls_enabled','public','communication_preferences',NULL),
    ('202606200006','rls_enabled','public','communication_deliveries',NULL),
    ('202606200006','rls_enabled','public','binder_exports',NULL),
    ('202606200006','rls_enabled','public','promotion_migration_reviews',NULL),
    ('202606200006','seed_row','public','platform_feature_controls','phase9e_feature_rows'),
    ('202606200007','index','public','client_notifications','idx_client_notifications_idempotent'),
    ('202606200007','index','public','communication_deliveries','idx_communication_deliveries_idempotent'),

    -- 9F.1 scheduled publishing automation
    ('202606200008','table','public','automation_job_runs',NULL),
    ('202606200008','table','public','automation_job_items',NULL),
    ('202606200008','rls_enabled','public','automation_job_runs',NULL),
    ('202606200008','rls_enabled','public','automation_job_items',NULL),
    ('202606200008','index','public','automation_job_runs','idx_automation_job_runs_single_active'),
    ('202606200008','index','public','automation_job_runs','idx_automation_job_runs_job_started'),
    ('202606200008','index','public','automation_job_items','idx_automation_job_items_run'),
    ('202606200008','seed_row','public','platform_feature_controls','scheduled_content_automation'),

    -- 9F.2 lifecycle notification hardening
    ('202606200009','column','public','client_notifications','lifecycle_event'),
    ('202606200009','column','public','client_notifications','idempotency_key'),
    ('202606200009','column','public','client_notifications','metadata'),
    ('202606200009','index','public','client_notifications','idx_client_notifications_lifecycle_idempotent'),
    ('202606200009','index','public','client_notifications','idx_client_notifications_lifecycle_event')
  ) AS expected(
    expected_migration,
    expected_check_kind,
    expected_schema_name,
    expected_relation_name,
    expected_object_name
  )
),
table_presence AS (
  SELECT n.nspname AS actual_schema_name, c.relname AS actual_relation_name, true AS is_present
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
),
column_presence AS (
  SELECT cols.table_schema AS actual_schema_name, cols.table_name AS actual_relation_name,
         cols.column_name AS actual_object_name, true AS is_present
  FROM information_schema.columns cols
),
index_presence AS (
  SELECT idx.schemaname AS actual_schema_name, idx.tablename AS actual_relation_name,
         idx.indexname AS actual_object_name, true AS is_present
  FROM pg_indexes idx
),
constraint_presence AS (
  SELECT n.nspname AS actual_schema_name, rel.relname AS actual_relation_name,
         con.conname AS actual_object_name, true AS is_present
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
),
trigger_presence AS (
  SELECT n.nspname AS actual_schema_name, rel.relname AS actual_relation_name,
         tg.tgname AS actual_object_name, true AS is_present
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE NOT tg.tgisinternal
),
policy_presence AS (
  SELECT pol.schemaname AS actual_schema_name, pol.tablename AS actual_relation_name,
         pol.policyname AS actual_object_name, true AS is_present
  FROM pg_policies pol
),
policy_comment_presence AS (
  SELECT n.nspname AS actual_schema_name, rel.relname AS actual_relation_name,
         pol.polname AS actual_object_name,
         (obj_description(pol.oid, 'pg_policy') IS NOT NULL) AS is_present
  FROM pg_policy pol
  JOIN pg_class rel ON rel.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
),
function_presence AS (
  SELECT n.nspname AS actual_schema_name, p.proname AS actual_object_name, true AS is_present
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
),
enum_presence AS (
  SELECT t.typname AS actual_object_name, true AS is_present
  FROM pg_type t
  WHERE t.typtype = 'e'
),
extension_presence AS (
  SELECT ext.extname AS actual_object_name, true AS is_present
  FROM pg_extension ext
),
rls_presence AS (
  SELECT n.nspname AS actual_schema_name, c.relname AS actual_relation_name, c.relrowsecurity AS is_present
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
),
resolved AS (
  SELECT
    e.expected_migration,
    e.expected_check_kind,
    e.expected_schema_name,
    e.expected_relation_name,
    e.expected_object_name,
    e.expected_check_kind || ':' || COALESCE(e.expected_object_name, e.expected_relation_name) AS check_id,
    COALESCE(e.expected_schema_name || '.', '')
      || COALESCE(e.expected_relation_name, e.expected_object_name, '(n/a)') AS expected_object,
    CASE
      WHEN e.expected_check_kind = 'seed_row' THEN NULL::boolean
      WHEN e.expected_check_kind = 'table' THEN tp.is_present
      WHEN e.expected_check_kind = 'column' THEN cp.is_present
      WHEN e.expected_check_kind = 'index' THEN ip.is_present
      WHEN e.expected_check_kind = 'constraint' THEN csp.is_present
      WHEN e.expected_check_kind = 'trigger' THEN trp.is_present
      WHEN e.expected_check_kind = 'policy' THEN pp.is_present
      WHEN e.expected_check_kind = 'policy_comment' THEN pcp.is_present
      WHEN e.expected_check_kind = 'function' THEN fp.is_present
      WHEN e.expected_check_kind = 'enum' THEN ep.is_present
      WHEN e.expected_check_kind = 'extension' THEN exp.is_present
      WHEN e.expected_check_kind = 'rls_enabled' THEN rp.is_present
      ELSE NULL::boolean
    END AS is_present
  FROM expected_checks e
  LEFT JOIN table_presence tp
    ON e.expected_check_kind = 'table'
   AND tp.actual_schema_name = e.expected_schema_name
   AND tp.actual_relation_name = e.expected_relation_name
  LEFT JOIN column_presence cp
    ON e.expected_check_kind = 'column'
   AND cp.actual_schema_name = e.expected_schema_name
   AND cp.actual_relation_name = e.expected_relation_name
   AND cp.actual_object_name = e.expected_object_name
  LEFT JOIN index_presence ip
    ON e.expected_check_kind = 'index'
   AND ip.actual_schema_name = e.expected_schema_name
   AND ip.actual_relation_name = e.expected_relation_name
   AND ip.actual_object_name = e.expected_object_name
  LEFT JOIN constraint_presence csp
    ON e.expected_check_kind = 'constraint'
   AND csp.actual_schema_name = e.expected_schema_name
   AND csp.actual_relation_name = e.expected_relation_name
   AND csp.actual_object_name = e.expected_object_name
  LEFT JOIN trigger_presence trp
    ON e.expected_check_kind = 'trigger'
   AND trp.actual_schema_name = e.expected_schema_name
   AND trp.actual_relation_name = e.expected_relation_name
   AND trp.actual_object_name = e.expected_object_name
  LEFT JOIN policy_presence pp
    ON e.expected_check_kind = 'policy'
   AND pp.actual_schema_name = e.expected_schema_name
   AND pp.actual_relation_name = e.expected_relation_name
   AND pp.actual_object_name = e.expected_object_name
  LEFT JOIN policy_comment_presence pcp
    ON e.expected_check_kind = 'policy_comment'
   AND pcp.actual_schema_name = e.expected_schema_name
   AND pcp.actual_relation_name = e.expected_relation_name
   AND pcp.actual_object_name = e.expected_object_name
  LEFT JOIN function_presence fp
    ON e.expected_check_kind = 'function'
   AND fp.actual_schema_name = e.expected_schema_name
   AND fp.actual_object_name = e.expected_object_name
  LEFT JOIN enum_presence ep
    ON e.expected_check_kind = 'enum'
   AND ep.actual_object_name = e.expected_object_name
  LEFT JOIN extension_presence exp
    ON e.expected_check_kind = 'extension'
   AND exp.actual_object_name = e.expected_object_name
  LEFT JOIN rls_presence rp
    ON e.expected_check_kind = 'rls_enabled'
   AND rp.actual_schema_name = e.expected_schema_name
   AND rp.actual_relation_name = e.expected_relation_name
)
SELECT
  r.expected_migration AS migration,
  r.check_id,
  r.expected_object,
  r.is_present AS present,
  CASE
    WHEN r.expected_check_kind = 'seed_row' THEN 'unknown'
    WHEN COALESCE(r.is_present, false) THEN 'present'
    ELSE 'absent'
  END AS state,
  CASE
    WHEN r.expected_check_kind = 'seed_row' THEN 'Row-level seed inspection is intentionally deferred to Section C to avoid optional-table parse failures.'
    WHEN r.expected_check_kind = 'rls_enabled' AND r.is_present IS NULL THEN 'Table absent; RLS status unavailable.'
    WHEN r.expected_check_kind = 'policy_comment' AND r.is_present IS NULL THEN 'Policy missing; comment check unavailable.'
    WHEN COALESCE(r.is_present, false) THEN 'Object found in catalogs.'
    ELSE 'Object missing from catalogs.'
  END AS detail
FROM resolved r
ORDER BY r.expected_migration, r.check_id;

-- =============================================================================
-- C. Seed-row probes (manual follow-up SQL text only; not executed here)
-- =============================================================================
SELECT
  migration,
  check_id,
  relation_exists,
  probe_sql
FROM (
  VALUES
    (
      '202606100019',
      'seed_row:adviser-photos',
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage' AND c.relname = 'buckets' AND c.relkind IN ('r','p')
      ),
      $$SELECT id, name, public, file_size_limit, allowed_mime_types
        FROM storage.buckets WHERE id = 'adviser-photos';$$
    ),
    (
      '202606200001',
      'seed_row:phase9a_feature_rows',
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'platform_feature_controls' AND c.relkind IN ('r','p')
      ),
      $$SELECT feature_key, enabled FROM platform_feature_controls
        WHERE feature_key IN ('raw_client_financial_views','prospect_readiness_snapshot',
          'client_published_financial_overview','client_stress_test_visibility',
          'adviser_publication_workflow','insights_and_updates')
        ORDER BY feature_key;$$
    ),
    (
      '202606200003',
      'seed_row:phase9c_feature_rows',
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'platform_feature_controls' AND c.relkind IN ('r','p')
      ),
      $$SELECT feature_key, enabled FROM platform_feature_controls
        WHERE feature_key IN ('adviser_meeting_studio','meeting_presentation_mode',
          'meeting_exact_amount_presentations','meeting_client_acknowledgements','meeting_summary_publication')
        ORDER BY feature_key;$$
    ),
    (
      '202606200006',
      'seed_row:phase9e_feature_rows',
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'platform_feature_controls' AND c.relkind IN ('r','p')
      ),
      $$SELECT feature_key, enabled FROM platform_feature_controls
        WHERE feature_key IN ('adviser_insight_authoring','admin_content_approval','market_updates',
          'product_related_content','client_in_app_notifications','client_email_notifications',
          'document_event_notifications','communication_preferences','binder_export','binder_client_publication')
        ORDER BY feature_key;$$
    )
) AS probes(migration, check_id, relation_exists, probe_sql)
ORDER BY migration;

-- =============================================================================
-- O. Per-migration rollup (one row per pending migration; works when all absent)
-- =============================================================================
WITH expected_migrations(version) AS (
  VALUES
    ('202606100019'), ('202606100020'), ('202606100021'), ('202606150001'),
    ('202606180001'), ('202606180002'), ('202606200001'), ('202606200002'),
    ('202606200003'), ('202606200004'), ('202606200005'), ('202606200006'),
    ('202606200007'), ('202606200008'), ('202606200009')
),
rollup_checks AS (
  SELECT * FROM (VALUES
    ('202606100019','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adviser_profiles')),
    ('202606100020','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adviser_appointments')),
    ('202606100021','index', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_adviser_feedback_client_created')),
    ('202606150001','index', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='clients_user_id_unique')),
    ('202606180001','column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='date_of_birth')),
    ('202606180002','column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='adviser_appointments' AND column_name='source')),
    ('202606200001','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='published_outputs')),
    ('202606200001','seed_row', NULL::boolean),
    ('202606200002','index', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_published_outputs_one_current_published')),
    ('202606200003','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_sessions')),
    ('202606200003','seed_row', NULL::boolean),
    ('202606200004','policy_comment', EXISTS (
      SELECT 1 FROM pg_policy pol
      JOIN pg_class rel ON rel.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname='public' AND rel.relname='meeting_sessions' AND pol.polname='meeting_sessions_select_adviser'
        AND obj_description(pol.oid, 'pg_policy') IS NOT NULL
    )),
    ('202606200005','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_goals')),
    ('202606200006','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='governed_content')),
    ('202606200006','seed_row', NULL::boolean),
    ('202606200007','index', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_client_notifications_idempotent')),
    ('202606200008','table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='automation_job_runs')),
    ('202606200008','index', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_automation_job_runs_single_active')),
    ('202606200008','seed_row', NULL::boolean),
    ('202606200009','column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='client_notifications' AND column_name='idempotency_key')),
    ('202606200009','index', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_client_notifications_lifecycle_idempotent'))
  ) AS rollup_input(rollup_migration, rollup_check_kind, rollup_is_present)
),
checks AS (
  SELECT
    ri.rollup_migration AS migration,
    ri.rollup_check_kind AS check_kind,
    ri.rollup_is_present AS is_present,
    CASE
      WHEN ri.rollup_check_kind = 'seed_row' THEN 'unknown'
      WHEN ri.rollup_is_present IS TRUE THEN 'present'
      WHEN ri.rollup_is_present IS FALSE THEN 'absent'
      ELSE 'unknown'
    END AS check_state
  FROM rollup_checks ri
),
rollup AS (
  SELECT
    em.version AS migration,
    COUNT(ch.migration) AS total_expected_checks,
    COUNT(*) FILTER (WHERE ch.check_state = 'present') AS present_checks,
    COUNT(*) FILTER (WHERE ch.check_state = 'absent') AS absent_checks,
    COUNT(*) FILTER (WHERE ch.check_state = 'unknown') AS unknown_checks
  FROM expected_migrations em
  LEFT JOIN checks ch ON ch.migration = em.version
  GROUP BY em.version
)
SELECT
  r.migration,
  r.total_expected_checks,
  r.present_checks,
  r.absent_checks,
  r.unknown_checks,
  CASE
    WHEN r.total_expected_checks = 0 THEN 'UNKNOWN'
    WHEN r.absent_checks = r.total_expected_checks THEN 'ABSENT'
    WHEN r.present_checks = r.total_expected_checks AND r.unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN r.present_checks > 0 AND r.absent_checks > 0 THEN 'PARTIAL_MATCH'
    WHEN r.unknown_checks > 0 AND r.present_checks = 0 AND r.absent_checks = 0 THEN 'UNKNOWN'
    ELSE 'PARTIAL_MATCH'
  END AS preliminary_classification
FROM rollup r
ORDER BY r.migration;
