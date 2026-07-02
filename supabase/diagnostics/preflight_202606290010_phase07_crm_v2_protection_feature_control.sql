-- Read-only preflight for migration 202606290010 (Phase 07 Protection feature control).
SELECT
  'phase07.feature.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_feature_controls'
  ) AS platform_feature_controls_present;
