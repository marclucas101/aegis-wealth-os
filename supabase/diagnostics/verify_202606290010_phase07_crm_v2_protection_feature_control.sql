-- Verification for migration 202606290010 (Phase 07 Protection feature control).

SELECT
  'phase07.feature.verify' AS check_id,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'platform_feature_controls_absent'
    ELSE COALESCE(
      (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_protection_portfolio'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_protection_portfolio_key,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_protection_portfolio'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_protection_portfolio_enabled;
