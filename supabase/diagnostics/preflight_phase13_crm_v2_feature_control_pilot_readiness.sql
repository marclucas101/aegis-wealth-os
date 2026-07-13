-- Read-only preflight for Phase 13 CRM V2 pilot readiness diagnostics.
-- Does not mutate feature-control state.

SELECT
  'phase13.pilot_readiness.preflight' AS check_id,
  to_regclass('public.platform_feature_controls') IS NOT NULL AS platform_feature_controls_present,
  (
    SELECT COUNT(*)::int
    FROM platform_feature_controls
    WHERE feature_key LIKE 'crm_v2_%'
  ) AS crm_v2_feature_row_count
WHERE to_regclass('public.platform_feature_controls') IS NOT NULL
UNION ALL
SELECT
  'phase13.pilot_readiness.preflight',
  false,
  0
WHERE to_regclass('public.platform_feature_controls') IS NULL;
