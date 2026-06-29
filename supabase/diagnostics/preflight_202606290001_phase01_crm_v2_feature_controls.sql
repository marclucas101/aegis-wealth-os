-- Read-only preflight before 202606290001_phase01_crm_v2_feature_controls.sql

WITH refs AS (
  SELECT to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists
),
history_probe AS (
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '202606290001'
  ) AS phase01_applied
),
seed_probe AS (
  SELECT
    EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'crm_v2_master') AS master_seed,
    EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'crm_v2_pilot_mode') AS pilot_seed
  WHERE (SELECT fc_exists FROM refs)
)
SELECT probe_id, classification, detail
FROM (
  SELECT
    'phase01.fc_table' AS probe_id,
    CASE WHEN (SELECT fc_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END AS classification,
    CASE WHEN (SELECT fc_exists FROM refs) THEN 'platform_feature_controls present' ELSE 'platform_feature_controls missing' END AS detail
  UNION ALL
  SELECT
    'phase01.already_applied',
    CASE WHEN (SELECT phase01_applied FROM history_probe) THEN 'WARNING' ELSE 'READY' END,
    CASE WHEN (SELECT phase01_applied FROM history_probe) THEN 'migration already recorded' ELSE 'migration not yet applied' END
  UNION ALL
  SELECT
    'phase01.master_seed_pre',
    CASE
      WHEN NOT (SELECT fc_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT master_seed FROM seed_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    CASE
      WHEN NOT (SELECT fc_exists FROM refs) THEN 'cannot probe seed'
      WHEN (SELECT master_seed FROM seed_probe) THEN 'crm_v2_master already present'
      ELSE 'crm_v2_master absent — seed will insert'
    END
  UNION ALL
  SELECT
    'phase01.pilot_seed_pre',
    CASE
      WHEN NOT (SELECT fc_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT pilot_seed FROM seed_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    CASE
      WHEN NOT (SELECT fc_exists FROM refs) THEN 'cannot probe seed'
      WHEN (SELECT pilot_seed FROM seed_probe) THEN 'crm_v2_pilot_mode already present'
      ELSE 'crm_v2_pilot_mode absent — seed will insert'
    END
) probes;
