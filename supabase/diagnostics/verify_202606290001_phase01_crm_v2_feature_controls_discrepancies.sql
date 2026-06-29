-- Discrepancy checks for Phase 01 CRM V2 feature-control seed.
-- Returns only rows that fail the expected state.

WITH refs AS (
  SELECT to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists
),
rows AS (
  SELECT feature_key, enabled, client_visible, adviser_visible
  FROM platform_feature_controls
  WHERE feature_key IN ('crm_v2_master', 'crm_v2_pilot_mode')
),
expected AS (
  SELECT *
  FROM (VALUES
    ('crm_v2_master', false, false, true),
    ('crm_v2_pilot_mode', false, false, true)
  ) AS t(feature_key, enabled, client_visible, adviser_visible)
),
evaluated AS (
  SELECT
    e.feature_key,
    e.enabled AS expected_enabled,
    e.client_visible AS expected_client_visible,
    e.adviser_visible AS expected_adviser_visible,
    r.enabled AS observed_enabled,
    r.client_visible AS observed_client_visible,
    r.adviser_visible AS observed_adviser_visible
  FROM expected e
  LEFT JOIN rows r ON r.feature_key = e.feature_key
  WHERE (SELECT fc_exists FROM refs)
)
SELECT
  feature_key,
  'missing_or_mismatch' AS issue,
  expected_enabled,
  observed_enabled,
  expected_client_visible,
  observed_client_visible,
  expected_adviser_visible,
  observed_adviser_visible
FROM evaluated
WHERE observed_enabled IS NULL
   OR observed_enabled IS DISTINCT FROM expected_enabled
   OR observed_client_visible IS DISTINCT FROM expected_client_visible
   OR observed_adviser_visible IS DISTINCT FROM expected_adviser_visible;
