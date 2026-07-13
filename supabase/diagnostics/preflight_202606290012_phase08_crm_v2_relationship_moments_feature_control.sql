-- Read-only preflight for migration 202606290012 (Phase 08 Relationship moments feature control).
SELECT
  'phase08.feature.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_feature_controls'
  ) AS platform_feature_controls_present;
