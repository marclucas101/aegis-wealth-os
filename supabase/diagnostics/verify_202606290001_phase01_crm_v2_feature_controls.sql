-- Verification for 202606290001_phase01_crm_v2_feature_controls.sql

WITH refs AS (
  SELECT to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists
),
rows AS (
  SELECT feature_key, enabled, client_visible, adviser_visible
  FROM platform_feature_controls
  WHERE feature_key IN ('crm_v2_master', 'crm_v2_pilot_mode')
)
SELECT check_id, expected, observed, classification
FROM (
  SELECT
    'crm_v2_master.present' AS check_id,
    'present' AS expected,
    CASE WHEN EXISTS (SELECT 1 FROM rows WHERE feature_key = 'crm_v2_master') THEN 'present' ELSE 'absent' END AS observed,
    CASE WHEN EXISTS (SELECT 1 FROM rows WHERE feature_key = 'crm_v2_master') THEN 'match' ELSE 'conflicting' END AS classification
  UNION ALL
  SELECT
    'crm_v2_master.enabled',
    'false',
    CASE WHEN (SELECT enabled FROM rows WHERE feature_key = 'crm_v2_master' LIMIT 1) IS FALSE THEN 'false' ELSE 'true' END,
    CASE WHEN (SELECT enabled FROM rows WHERE feature_key = 'crm_v2_master' LIMIT 1) IS FALSE THEN 'match' ELSE 'conflicting' END
  UNION ALL
  SELECT
    'crm_v2_master.client_visible',
    'false',
    CASE WHEN (SELECT client_visible FROM rows WHERE feature_key = 'crm_v2_master' LIMIT 1) IS FALSE THEN 'false' ELSE 'true' END,
    CASE WHEN (SELECT client_visible FROM rows WHERE feature_key = 'crm_v2_master' LIMIT 1) IS FALSE THEN 'match' ELSE 'conflicting' END
  UNION ALL
  SELECT
    'crm_v2_pilot_mode.present',
    'present',
    CASE WHEN EXISTS (SELECT 1 FROM rows WHERE feature_key = 'crm_v2_pilot_mode') THEN 'present' ELSE 'absent' END,
    CASE WHEN EXISTS (SELECT 1 FROM rows WHERE feature_key = 'crm_v2_pilot_mode') THEN 'match' ELSE 'conflicting' END
  UNION ALL
  SELECT
    'crm_v2_pilot_mode.enabled',
    'false',
    CASE WHEN (SELECT enabled FROM rows WHERE feature_key = 'crm_v2_pilot_mode' LIMIT 1) IS FALSE THEN 'false' ELSE 'true' END,
    CASE WHEN (SELECT enabled FROM rows WHERE feature_key = 'crm_v2_pilot_mode' LIMIT 1) IS FALSE THEN 'match' ELSE 'conflicting' END
) checks
WHERE (SELECT fc_exists FROM refs);
