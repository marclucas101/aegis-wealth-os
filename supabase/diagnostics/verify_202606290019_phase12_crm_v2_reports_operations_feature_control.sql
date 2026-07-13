-- Verification for migration 202606290019 (Phase 12 Reports and Operations feature control).
-- Catalog-safe: always returns one row; shows 'missing' pre-apply, actual values post-apply.

SELECT
  'phase12.reports_operations.feature.verify' AS check_id,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'platform_feature_controls_absent'
    ELSE COALESCE(
      (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_reports'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_reports_key,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_reports'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_reports_enabled,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_operations'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_operations_key,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_operations'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_operations_enabled;
