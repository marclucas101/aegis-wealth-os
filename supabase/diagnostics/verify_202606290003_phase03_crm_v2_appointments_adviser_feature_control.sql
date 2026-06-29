-- Post-apply verification for 202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql

WITH refs AS (
  SELECT to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists
),
rows AS (
  SELECT feature_key, enabled, client_visible, adviser_visible
  FROM platform_feature_controls
  WHERE feature_key = 'crm_v2_appointments_adviser'
)
SELECT check_id, expected, observed, classification
FROM (
  SELECT
    'crm_v2_appointments_adviser.present' AS check_id,
    'present' AS expected,
    CASE WHEN EXISTS (SELECT 1 FROM rows) THEN 'present' ELSE 'absent' END AS observed,
    CASE WHEN EXISTS (SELECT 1 FROM rows) THEN 'match' ELSE 'conflicting' END AS classification
  UNION ALL
  SELECT
    'crm_v2_appointments_adviser.enabled',
    'false',
    CASE WHEN (SELECT enabled FROM rows LIMIT 1) IS FALSE THEN 'false' ELSE 'true' END,
    CASE WHEN (SELECT enabled FROM rows LIMIT 1) IS FALSE THEN 'match' ELSE 'conflicting' END
  UNION ALL
  SELECT
    'crm_v2_appointments_adviser.client_visible',
    'false',
    CASE WHEN (SELECT client_visible FROM rows LIMIT 1) IS FALSE THEN 'false' ELSE 'true' END,
    CASE WHEN (SELECT client_visible FROM rows LIMIT 1) IS FALSE THEN 'match' ELSE 'conflicting' END
  UNION ALL
  SELECT
    'crm_v2_appointments_adviser.adviser_visible',
    'true',
    CASE WHEN (SELECT adviser_visible FROM rows LIMIT 1) IS TRUE THEN 'true' ELSE 'false' END,
    CASE WHEN (SELECT adviser_visible FROM rows LIMIT 1) IS TRUE THEN 'match' ELSE 'conflicting' END
) checks
WHERE (SELECT fc_exists FROM refs);
