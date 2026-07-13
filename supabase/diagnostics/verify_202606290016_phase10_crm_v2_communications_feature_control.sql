-- Verification for migration 202606290016 (Phase 10 Communications feature control).
-- Catalog-safe: always returns one row; shows 'missing' pre-apply, actual values post-apply.

SELECT
  'phase10.communications.feature.verify' AS check_id,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'platform_feature_controls_absent'
    ELSE COALESCE(
      (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_communications_key,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_communications_enabled,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_communications_client_visible,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS crm_v2_communications_adviser_visible;
