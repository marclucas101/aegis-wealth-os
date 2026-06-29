-- Read-only preflight before 202606290002_phase02_crm_v2_relationships_feature_control.sql

WITH refs AS (
  SELECT to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists
),
history_probe AS (
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '202606290002'
  ) AS phase02_applied
),
seed_probe AS (
  SELECT
    EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'crm_v2_relationships') AS relationships_seed
  WHERE (SELECT fc_exists FROM refs)
)
SELECT probe_id, classification, detail
FROM (
  SELECT
    'phase02.fc_table' AS probe_id,
    CASE WHEN (SELECT fc_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END AS classification,
    CASE WHEN (SELECT fc_exists FROM refs) THEN 'platform_feature_controls present' ELSE 'platform_feature_controls missing' END AS detail
  UNION ALL
  SELECT
    'phase02.already_applied',
    CASE WHEN (SELECT phase02_applied FROM history_probe) THEN 'WARNING' ELSE 'READY' END,
    CASE WHEN (SELECT phase02_applied FROM history_probe) THEN 'migration already recorded' ELSE 'migration not yet applied' END
  UNION ALL
  SELECT
    'phase02.relationships_seed_pre',
    CASE
      WHEN NOT (SELECT fc_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT relationships_seed FROM seed_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    CASE
      WHEN NOT (SELECT fc_exists FROM refs) THEN 'cannot probe seed'
      WHEN (SELECT relationships_seed FROM seed_probe) THEN 'crm_v2_relationships already present'
      ELSE 'crm_v2_relationships absent — seed will add row'
    END
) probes;
