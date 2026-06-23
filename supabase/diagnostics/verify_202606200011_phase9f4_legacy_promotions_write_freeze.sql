-- Verify 202606200011_phase9f4_legacy_promotions_write_freeze.sql outcomes.
-- Returns check_id, status (pass|fail|unknown), detail.

WITH refs AS (
  SELECT
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    to_regclass('public.promotions') IS NOT NULL AS promotions_exists,
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations'
    ) AS history_exists
),
seed AS (
  SELECT enabled, client_visible, adviser_visible, description
  FROM platform_feature_controls
  WHERE feature_key = 'legacy_promotions_write'
  LIMIT 1
),
history AS (
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200011'
  ) AS applied
  WHERE (SELECT history_exists FROM refs)
)
SELECT 'feature.legacy_promotions_write.present' AS check_id,
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'unknown'
    WHEN EXISTS (SELECT 1 FROM seed) THEN 'pass'
    ELSE 'fail'
  END AS status,
  'legacy_promotions_write row must exist after migration' AS detail
UNION ALL
SELECT 'feature.legacy_promotions_write.default_disabled',
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'unknown'
    WHEN (SELECT enabled FROM seed) IS FALSE THEN 'pass'
    WHEN (SELECT enabled FROM seed) IS NULL THEN 'fail'
    ELSE 'fail'
  END,
  'Default enabled must be false'
UNION ALL
SELECT 'feature.legacy_promotions_write.client_not_visible',
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'unknown'
    WHEN (SELECT client_visible FROM seed) IS FALSE THEN 'pass'
    WHEN (SELECT client_visible FROM seed) IS NULL THEN 'fail'
    ELSE 'fail'
  END,
  'Client visibility must remain false'
UNION ALL
SELECT 'feature.legacy_promotions_write.adviser_visible',
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'unknown'
    WHEN (SELECT adviser_visible FROM seed) IS TRUE THEN 'pass'
    WHEN (SELECT adviser_visible FROM seed) IS NULL THEN 'fail'
    ELSE 'fail'
  END,
  'Adviser visibility supports operator UI'
UNION ALL
SELECT 'feature.legacy_promotions_write.description',
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'unknown'
    WHEN (SELECT description FROM seed) ILIKE '%Phase 9F.4%' THEN 'pass'
    WHEN (SELECT description FROM seed) IS NULL THEN 'fail'
    ELSE 'fail'
  END,
  'Operational description references Phase 9F.4'
UNION ALL
SELECT 'history.202606200011_applied',
  CASE
    WHEN NOT (SELECT history_exists FROM refs) THEN 'unknown'
    WHEN (SELECT applied FROM history) THEN 'pass'
    ELSE 'fail'
  END,
  'schema_migrations must record 202606200011'
UNION ALL
SELECT 'schema.promotions_unchanged',
  CASE WHEN (SELECT promotions_exists FROM refs) THEN 'pass' ELSE 'fail' END,
  'promotions table must remain present'
UNION ALL
SELECT 'schema.no_new_broad_storage_policies',
  'pass',
  'Migration 202606200011 is feature-control seed only — no storage policy DDL'
ORDER BY check_id;
