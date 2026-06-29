-- Verification for migration 202606290006 (Phase 05 feature-control seed).

SELECT
  'phase05.feature.verify' AS check_id,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'platform_feature_controls_absent'
    ELSE COALESCE(
      (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS feature_key,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS enabled,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS client_visible,
  CASE
    WHEN to_regclass('public.platform_feature_controls') IS NULL THEN 'unknown'
    ELSE COALESCE(
      (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text,
      'missing'
    )
  END AS adviser_visible;
