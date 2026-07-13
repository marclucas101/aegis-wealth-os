-- Read-only preflight for migration 202606290008 (Phase 06 Service feature control).
SELECT
  'phase06.feature.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_feature_controls'
  ) AS platform_feature_controls_present;
