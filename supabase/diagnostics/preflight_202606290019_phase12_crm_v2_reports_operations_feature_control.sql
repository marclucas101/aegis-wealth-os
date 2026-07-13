-- Read-only preflight for migration 202606290019 (Phase 12 Reports and Operations feature control).
SELECT
  'phase12.reports_operations.feature_control.preflight' AS check_id,
  to_regclass('public.platform_feature_controls') IS NOT NULL AS platform_feature_controls_present;
