-- Read-only deep verification for 202606200006_phase9e_communications_governance.sql

WITH expected AS (
  SELECT * FROM (VALUES
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
    ('202606200006','seed','platform_feature_controls.phase9e_keys','10')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
tbl AS (
  SELECT c.relname, c.relrowsecurity
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
cons AS (
  SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
),
idx AS (
  SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
),
pol AS (
  SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public'
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
             'adviser_insight_authoring','admin_content_approval','market_updates','product_related_content',
             'client_in_app_notifications','client_email_notifications','document_event_notifications',
             'communication_preferences','binder_export','binder_client_publication'
           )$$, true, true, '')))[1]::text), ''
      )::bigint
    END AS seed_count
)
SELECT
  e.migration,
  e.check_kind || ':' || e.object_name AS check_id,
  e.object_name AS expected_object,
  CASE
    WHEN e.check_kind IN ('table','rls') THEN t.relname IS NOT NULL
    WHEN e.check_kind = 'constraint' THEN co.conname IS NOT NULL
    WHEN e.check_kind = 'index' THEN i.indexname IS NOT NULL
    WHEN e.check_kind = 'policy' THEN p.policyname IS NOT NULL
    WHEN e.check_kind = 'seed' THEN sp.seed_count IS NOT NULL
    ELSE NULL::boolean
  END AS present,
  CASE
    WHEN e.check_kind = 'constraint' THEN co.definition
    WHEN e.check_kind = 'index' THEN i.indexdef
    WHEN e.check_kind = 'policy' THEN p.cmd
    WHEN e.check_kind = 'rls' THEN CASE WHEN t.relrowsecurity THEN 'enabled' ELSE 'disabled' END
    WHEN e.check_kind = 'seed' THEN COALESCE(sp.seed_count::text, 'unknown')
    ELSE NULL
  END AS detail,
  CASE
    WHEN e.check_kind = 'constraint' AND co.conname IS NOT NULL AND co.definition NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'policy' AND p.policyname IS NOT NULL AND p.cmd <> e.expected_detail THEN 'conflicting'
    WHEN e.check_kind = 'rls' AND t.relname IS NOT NULL AND NOT t.relrowsecurity THEN 'conflicting'
    WHEN e.check_kind = 'seed' AND sp.seed_count IS NOT NULL AND sp.seed_count < e.expected_detail::bigint THEN 'conflicting'
    WHEN e.check_kind = 'seed' AND sp.seed_count IS NULL THEN 'unknown'
    WHEN (
      (e.check_kind IN ('table','rls') AND t.relname IS NULL) OR
      (e.check_kind='constraint' AND co.conname IS NULL) OR
      (e.check_kind='index' AND i.indexname IS NULL) OR
      (e.check_kind='policy' AND p.policyname IS NULL)
    ) THEN 'absent'
    ELSE 'present'
  END AS state
FROM expected e
LEFT JOIN tbl t ON e.check_kind IN ('table','rls') AND t.relname = e.object_name
LEFT JOIN cons co ON e.check_kind='constraint' AND co.conname = e.object_name
LEFT JOIN idx i ON e.check_kind='index' AND i.indexname = e.object_name
LEFT JOIN pol p ON e.check_kind='policy' AND p.policyname = e.object_name
CROSS JOIN seed_probe sp
ORDER BY check_id;

-- Rollup
WITH core AS (
  SELECT
    CASE
      WHEN to_regclass('public.governed_content') IS NULL THEN 'absent'
      WHEN to_regclass('public.client_notifications') IS NULL THEN 'absent'
      WHEN to_regclass('public.communication_deliveries') IS NULL THEN 'absent'
      WHEN NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='governed_content_approval_status_check') THEN 'absent'
      ELSE 'present'
    END AS state
),
summary AS (
  SELECT
    1::bigint AS total_required_checks,
    COUNT(*) FILTER (WHERE state='present') AS present_checks,
    COUNT(*) FILTER (WHERE state='absent') AS absent_checks,
    COUNT(*) FILTER (WHERE state='conflicting') AS conflicting_checks,
    COUNT(*) FILTER (WHERE state='unknown') AS unknown_checks
  FROM core
)
SELECT
  '202606200006' AS migration,
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
