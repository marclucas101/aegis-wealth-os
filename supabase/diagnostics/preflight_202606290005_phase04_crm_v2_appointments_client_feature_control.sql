-- Preflight diagnostic (read-only): Phase 04 client appointments feature control seed
SELECT
  'phase04.feature.preflight.platform_feature_controls_exists' AS check_id,
  EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'platform_feature_controls'
  ) AS ok;
