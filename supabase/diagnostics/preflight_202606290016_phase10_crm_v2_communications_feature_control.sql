-- Read-only preflight for migration 202606290016 (Phase 10 Communications feature control).
SELECT
  'phase10.communications.feature_control.preflight' AS check_id,
  to_regclass('public.platform_feature_controls') IS NOT NULL AS platform_feature_controls_present;
