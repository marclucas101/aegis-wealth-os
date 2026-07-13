-- Verification for migration 202606290014 (Phase 09 Advocacy feature control).
-- Catalog-safe: always returns one row; shows 'missing' pre-apply, actual values post-apply.

SELECT
  'phase09.advocacy.feature.verify' AS check_id,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'platform_feature_controls_absent'
    ELSE COALESCE(
      (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_advocacy_key,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_advocacy_enabled,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_advocacy_client_visible,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_advocacy_adviser_visible;
