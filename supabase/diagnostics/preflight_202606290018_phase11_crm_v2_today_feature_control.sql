-- Read-only preflight for migration 202606290018 (Phase 11 Today feature control).
SELECT
  'phase11.today.feature_control.preflight' AS check_id,
  to_regclass('public.platform_feature_controls') IS NOT NULL AS platform_feature_controls_present;
