-- Read-only preflight before 202606200011_phase9f4_legacy_promotions_write_freeze.sql
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail.

WITH refs AS (
  SELECT
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    to_regclass('public.promotions') IS NOT NULL AS promotions_exists,
    to_regclass('public.promotion_migration_reviews') IS NOT NULL AS migration_reviews_exists,
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations'
        AND c.relname = 'schema_migrations'
        AND c.relkind IN ('r', 'p')
    ) AS history_table_exists
),
history_probe AS (
  SELECT
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202606200010'
      ) END AS phase9f3_applied,
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202606200011'
      ) END AS phase9f4_write_freeze_applied
),
feature_probe AS (
  SELECT
    CASE WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM platform_feature_controls
        WHERE feature_key = 'legacy_promotions_write'
      ) END AS legacy_write_seed_present,
    CASE WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM platform_feature_controls
        WHERE feature_key = 'legacy_promotions_ui'
      ) END AS legacy_ui_seed_present
),
promotion_rows AS (
  SELECT
    CASE WHEN NOT (SELECT promotions_exists FROM refs) THEN NULL::bigint
      ELSE (SELECT count(*) FROM promotions) END AS promotion_count
)
SELECT 'migration.202606200010_prerequisite' AS probe_id,
  CASE
    WHEN (SELECT history_table_exists FROM refs) IS NOT TRUE THEN 'UNKNOWN'
    WHEN (SELECT phase9f3_applied FROM history_probe) IS NOT TRUE THEN 'BLOCKER'
    WHEN (SELECT phase9f4_write_freeze_applied FROM history_probe) THEN 'WARNING'
    ELSE 'READY'
  END AS classification,
  'Phase 9F.3 binder migration must be applied before write freeze' AS detail
UNION ALL
SELECT 'schema.platform_feature_controls',
  CASE WHEN (SELECT feature_controls_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
  'platform_feature_controls required for legacy_promotions_write seed'
UNION ALL
SELECT 'schema.promotions_table',
  CASE WHEN (SELECT promotions_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
  'public.promotions must exist (read-only retention)'
UNION ALL
SELECT 'schema.promotion_migration_reviews',
  CASE WHEN (SELECT migration_reviews_exists FROM refs) THEN 'READY' ELSE 'WARNING' END,
  'promotion_migration_reviews supports admin migration path'
UNION ALL
SELECT 'feature.legacy_promotions_write_absent_or_compatible',
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
    WHEN (SELECT legacy_write_seed_present FROM feature_probe) THEN 'WARNING'
    ELSE 'READY'
  END,
  'Seed uses ON CONFLICT DO NOTHING — pre-existing row must be reviewed if present'
UNION ALL
SELECT 'feature.legacy_promotions_ui_absent',
  CASE
    WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
    WHEN (SELECT legacy_ui_seed_present FROM feature_probe) THEN 'WARNING'
    ELSE 'READY'
  END,
  'legacy_promotions_ui must not be seeded in this checkpoint'
UNION ALL
SELECT 'data.promotions_rows_compatible',
  CASE
    WHEN (SELECT promotion_count FROM promotion_rows) IS NULL THEN 'UNKNOWN'
    ELSE 'READY'
  END,
  'Existing promotion rows remain untouched by this migration'
UNION ALL
SELECT 'history.pending_202606200011',
  CASE
    WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
    WHEN (SELECT phase9f4_write_freeze_applied FROM history_probe) THEN 'WARNING'
  ELSE 'READY'
  END,
  'Migration 202606200011 should be pending before apply'
ORDER BY probe_id;
