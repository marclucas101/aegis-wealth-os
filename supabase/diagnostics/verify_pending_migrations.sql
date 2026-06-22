-- Read-only verification for ALL pending migrations (202606100019 through 202606200007)
-- Run in Supabase SQL Editor or psql read-only session.
-- NO writes. Does NOT modify supabase_migrations.schema_migrations.

-- =============================================================================
-- A. Migration history status (informational)
-- =============================================================================
WITH pending AS (
  SELECT unnest(ARRAY[
    '202606100019',
    '202606100020',
    '202606100021',
    '202606150001',
    '202606180001',
    '202606180002',
    '202606200001',
    '202606200002',
    '202606200003',
    '202606200004',
    '202606200005',
    '202606200006',
    '202606200007'
  ]) AS version
)
SELECT
  p.version AS migration_version,
  EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations sm
    WHERE sm.version = p.version
  ) AS present_in_history,
  (
    SELECT sm.name FROM supabase_migrations.schema_migrations sm
    WHERE sm.version = p.version LIMIT 1
  ) AS history_name
FROM pending p
ORDER BY p.version;

-- =============================================================================
-- B. 202606100019 — adviser_profiles (see also verify_202606100019_adviser_profiles.sql)
-- =============================================================================
SELECT '202606100019' AS migration, 'table' AS kind, 'adviser_profiles' AS name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adviser_profiles') AS present;

SELECT '202606100019' AS migration, 'column' AS kind, column_name AS name, true AS present
FROM information_schema.columns
WHERE table_schema='public' AND table_name='adviser_profiles'
  AND column_name IN ('adviser_user_id','display_name','photo_storage_path','professional_title',
    'representing_insurer','short_bio','years_experience','calendar_connected','booking_enabled',
    'created_at','updated_at');

SELECT '202606100019' AS migration, 'rls_policy' AS kind, policyname AS name, true AS present
FROM pg_policies WHERE schemaname='public' AND tablename='adviser_profiles';

SELECT '202606100019' AS migration, 'storage_bucket' AS kind, 'adviser-photos' AS name,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id='adviser-photos') AS present;

SELECT '202606100019' AS migration, 'storage_policy' AS kind, policyname AS name, true AS present
FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'adviser_photos_%';

SELECT '202606100019' AS migration, 'function' AS kind, 'adviser_id_from_storage_path' AS name,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='adviser_id_from_storage_path') AS present;

-- =============================================================================
-- C. 202606100020 — Google Calendar booking
-- =============================================================================
SELECT '202606100020' AS migration, 'extension' AS kind, 'btree_gist' AS name,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gist') AS present;

SELECT '202606100020' AS migration, 'table' AS kind, t AS name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) AS present
FROM unnest(ARRAY['adviser_calendar_connections','adviser_calendar_settings','adviser_appointments']) AS t;

SELECT '202606100020' AS migration, 'enum' AS kind, 'adviser_appointment_status' AS name,
  EXISTS (SELECT 1 FROM pg_type WHERE typname='adviser_appointment_status') AS present;

SELECT '202606100020' AS migration, 'index' AS kind, indexname AS name, true AS present
FROM pg_indexes WHERE schemaname='public' AND tablename='adviser_appointments'
  AND indexname IN ('idx_adviser_appointments_adviser_starts','idx_adviser_appointments_client_starts',
    'idx_adviser_appointments_status','idx_adviser_appointments_idempotency');

SELECT '202606100020' AS migration, 'constraint' AS kind, con.conname AS name, true AS present
FROM pg_constraint con
JOIN pg_class rel ON rel.oid=con.conrelid
JOIN pg_namespace nsp ON nsp.oid=rel.relnamespace
WHERE nsp.nspname='public' AND rel.relname='adviser_appointments'
  AND con.conname IN ('adviser_appointments_no_overlap','adviser_appointments_time_check');

SELECT '202606100020' AS migration, 'rls_policy' AS kind, tablename || ':' || policyname AS name, true AS present
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('adviser_calendar_connections','adviser_calendar_settings','adviser_appointments');

-- =============================================================================
-- D. 202606100021 — performance indexes
-- =============================================================================
SELECT '202606100021' AS migration, 'index' AS kind, indexname AS name,
  EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname='public' AND i.indexname=n) AS present
FROM unnest(ARRAY[
  'idx_adviser_feedback_client_created',
  'idx_clients_advisor_display_name',
  'idx_discover_profiles_client_current'
]) AS n(indexname);

-- =============================================================================
-- E. 202606150001 — clients.user_id unique index
-- =============================================================================
SELECT '202606150001' AS migration, 'index' AS kind, 'clients_user_id_unique' AS name,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='clients_user_id_unique') AS present;

-- =============================================================================
-- F. 202606180001 — birthday reminders
-- =============================================================================
SELECT '202606180001' AS migration, 'column' AS kind, 'clients.date_of_birth' AS name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='clients' AND column_name='date_of_birth') AS present;

SELECT '202606180001' AS migration, 'column' AS kind, column_name AS name, true AS present
FROM information_schema.columns
WHERE table_schema='public' AND table_name='advisor_tasks'
  AND column_name IN ('source_key','dismissed_at','metadata');

SELECT '202606180001' AS migration, 'index' AS kind, indexname AS name,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=n) AS present
FROM unnest(ARRAY['idx_advisor_tasks_source_key_unique','idx_advisor_tasks_birthday_open']) AS n(indexname);

-- =============================================================================
-- G. 202606180002 — adviser-created appointments
-- =============================================================================
SELECT '202606180002' AS migration, 'column' AS kind, column_name AS name, true AS present
FROM information_schema.columns
WHERE table_schema='public' AND table_name='adviser_appointments'
  AND column_name IN ('source','created_by_user_id','external_reference','external_url',
    'private_adviser_note','phone_instructions','custom_meeting_link','location_text',
    'notification_status','notification_error','calendar_sync_status','calendar_sync_error');

SELECT '202606180002' AS migration, 'index' AS kind, 'idx_adviser_appointments_creator_idempotency' AS name,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_adviser_appointments_creator_idempotency') AS present;

-- =============================================================================
-- H. 202606200001 — Phase 9A compliance access
-- =============================================================================
SELECT '202606200001' AS migration, 'enum' AS kind, typname AS name, true AS present
FROM pg_type WHERE typname IN ('relationship_stage','output_audience','publication_status');

SELECT '202606200001' AS migration, 'column' AS kind, 'clients.relationship_stage' AS name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='clients' AND column_name='relationship_stage') AS present;

SELECT '202606200001' AS migration, 'table' AS kind, t AS name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) AS present
FROM unnest(ARRAY['published_outputs','platform_feature_controls']) AS t;

SELECT '202606200001' AS migration, 'rls_policy' AS kind, tablename || ':' || policyname AS name, true AS present
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('published_outputs','platform_feature_controls');

SELECT '202606200001' AS migration, 'feature_seed' AS kind, feature_key AS name, true AS present
FROM platform_feature_controls
WHERE feature_key IN ('raw_client_financial_views','prospect_readiness_snapshot',
  'client_published_financial_overview','client_stress_test_visibility',
  'adviser_publication_workflow','insights_and_updates');

-- =============================================================================
-- I. 202606200002 — publication hardening index
-- =============================================================================
SELECT '202606200002' AS migration, 'index' AS kind, 'idx_published_outputs_one_current_published' AS name,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
    AND indexname='idx_published_outputs_one_current_published') AS present;

-- =============================================================================
-- J. 202606200003 — Meeting Studio
-- =============================================================================
SELECT '202606200003' AS migration, 'enum' AS kind, typname AS name, true AS present
FROM pg_type WHERE typname IN ('meeting_session_status','meeting_summary_status');

SELECT '202606200003' AS migration, 'table' AS kind, t AS name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) AS present
FROM unnest(ARRAY['meeting_sessions','meeting_session_events']) AS t;

SELECT '202606200003' AS migration, 'rls_policy' AS kind, tablename || ':' || policyname AS name, true AS present
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('meeting_sessions','meeting_session_events');

SELECT '202606200003' AS migration, 'feature_seed' AS kind, feature_key AS name, true AS present
FROM platform_feature_controls
WHERE feature_key IN ('adviser_meeting_studio','meeting_presentation_mode',
  'meeting_exact_amount_presentations','meeting_client_acknowledgements','meeting_summary_publication');

-- =============================================================================
-- K. 202606200004 — RLS documentation (policy comments)
-- =============================================================================
SELECT '202606200004' AS migration, 'policy_comment' AS kind,
  pol.polname AS name,
  (obj_description(pol.oid, 'pg_policy') IS NOT NULL) AS present
FROM pg_policy pol
JOIN pg_class rel ON rel.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname IN ('meeting_sessions','meeting_session_events')
  AND pol.polname IN ('meeting_sessions_select_adviser','meeting_session_events_select_adviser');

-- =============================================================================
-- L. 202606200005 — Phase 9D converted client portal
-- =============================================================================
SELECT '202606200005' AS migration, 'column' AS kind, column_name AS name, true AS present
FROM information_schema.columns
WHERE table_schema='public' AND table_name='roadmap_items'
  AND column_name IN ('task_owner','client_visible','client_status_label','display_category');

SELECT '202606200005' AS migration, 'table' AS kind, t AS name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) AS present
FROM unnest(ARRAY['client_goals','client_review_submissions']) AS t;

SELECT '202606200005' AS migration, 'rls_policy' AS kind, tablename || ':' || policyname AS name, true AS present
FROM pg_policies WHERE schemaname='public'
  AND tablename IN ('client_goals','client_review_submissions');

-- =============================================================================
-- M. 202606200006 — Phase 9E communications governance
-- =============================================================================
SELECT '202606200006' AS migration, 'table' AS kind, t AS name,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) AS present
FROM unnest(ARRAY[
  'governed_content','client_notifications','communication_preferences',
  'communication_deliveries','binder_exports','promotion_migration_reviews'
]) AS t;

SELECT '202606200006' AS migration, 'rls_enabled' AS kind, c.relname AS name, c.relrowsecurity AS present
FROM pg_class c
JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
WHERE nsp.nspname = 'public'
  AND c.relname IN (
    'governed_content','client_notifications','communication_preferences',
    'communication_deliveries','binder_exports','promotion_migration_reviews'
  );

SELECT '202606200006' AS migration, 'feature_seed' AS kind, feature_key AS name, true AS present
FROM platform_feature_controls
WHERE feature_key IN (
  'adviser_insight_authoring','admin_content_approval','market_updates',
  'product_related_content','client_in_app_notifications','client_email_notifications',
  'document_event_notifications','communication_preferences','binder_export','binder_client_publication'
);

-- =============================================================================
-- N. 202606200007 — Phase 9E hardening indexes
-- =============================================================================
SELECT '202606200007' AS migration, 'index' AS kind, indexname AS name,
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname=n) AS present
FROM unnest(ARRAY[
  'idx_client_notifications_idempotent',
  'idx_communication_deliveries_idempotent'
]) AS n(indexname);

-- =============================================================================
-- O. Per-migration rollup (export this result for classify-migration-drift.ts)
-- =============================================================================
WITH checks AS (
  SELECT '202606100019' AS migration, 'adviser_profiles_table' AS check_id,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adviser_profiles') AS present
  UNION ALL SELECT '202606100019', 'adviser_profiles_rls_policies',
    (SELECT COUNT(*) = 4 FROM pg_policies WHERE schemaname='public' AND tablename='adviser_profiles'
      AND policyname IN ('adviser_profiles_select_own_assigned_or_admin','adviser_profiles_insert_own_or_admin',
        'adviser_profiles_update_own_or_admin','adviser_profiles_delete_admin'))
  UNION ALL SELECT '202606100019', 'adviser_photos_bucket',
    EXISTS (SELECT 1 FROM storage.buckets WHERE id='adviser-photos')
  UNION ALL SELECT '202606100019', 'adviser_photos_storage_policies',
    (SELECT COUNT(*) = 4 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'adviser_photos_%')
  UNION ALL SELECT '202606100020', 'calendar_tables',
    (SELECT COUNT(*) = 3 FROM information_schema.tables WHERE table_schema='public'
      AND table_name IN ('adviser_calendar_connections','adviser_calendar_settings','adviser_appointments'))
  UNION ALL SELECT '202606100021', 'performance_indexes',
    (SELECT COUNT(*) = 3 FROM pg_indexes WHERE schemaname='public' AND indexname IN (
      'idx_adviser_feedback_client_created','idx_clients_advisor_display_name','idx_discover_profiles_client_current'))
  UNION ALL SELECT '202606150001', 'clients_user_id_unique',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='clients_user_id_unique')
  UNION ALL SELECT '202606180001', 'birthday_columns',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='date_of_birth')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='advisor_tasks' AND column_name='source_key')
  UNION ALL SELECT '202606180002', 'appointment_source_column',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='adviser_appointments' AND column_name='source')
  UNION ALL SELECT '202606200001', 'phase9a_core',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='published_outputs')
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='relationship_stage')
  UNION ALL SELECT '202606200002', 'one_current_published_index',
    EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_published_outputs_one_current_published')
  UNION ALL SELECT '202606200003', 'meeting_studio_tables',
    (SELECT COUNT(*) = 2 FROM information_schema.tables WHERE table_schema='public'
      AND table_name IN ('meeting_sessions','meeting_session_events'))
  UNION ALL SELECT '202606200004', 'meeting_policy_comments',
    (SELECT COUNT(*) >= 1 FROM pg_policy pol JOIN pg_class rel ON rel.oid=pol.polrelid
      JOIN pg_namespace nsp ON nsp.oid=rel.relnamespace
      WHERE nsp.nspname='public' AND rel.relname='meeting_sessions'
        AND obj_description(pol.oid,'pg_policy') IS NOT NULL)
  UNION ALL SELECT '202606200005', 'client_goals_table',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='client_goals')
  UNION ALL SELECT '202606200006', 'governed_content_table',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='governed_content')
  UNION ALL SELECT '202606200007', 'idempotency_indexes',
    (SELECT COUNT(*) = 2 FROM pg_indexes WHERE schemaname='public' AND indexname IN (
      'idx_client_notifications_idempotent','idx_communication_deliveries_idempotent'))
)
SELECT
  migration,
  check_id,
  present,
  CASE WHEN present THEN 'present' ELSE 'absent' END AS state
FROM checks
ORDER BY migration, check_id;
