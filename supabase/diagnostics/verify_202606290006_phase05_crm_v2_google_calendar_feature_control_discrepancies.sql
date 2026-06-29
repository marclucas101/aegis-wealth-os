-- Discrepancy check for migration 202606290006.

WITH resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS client_visible_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_google_calendar'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS adviser_visible_text
)
SELECT
  'phase05.feature.discrepancy' AS check_id,
  'crm_v2_google_calendar' AS expected_feature_key,
  false AS expected_enabled,
  false AS expected_client_visible,
  true AS expected_adviser_visible,
  resolved.feature_key AS actual_feature_key,
  resolved.enabled_text AS actual_enabled,
  resolved.client_visible_text AS actual_client_visible,
  resolved.adviser_visible_text AS actual_adviser_visible,
  'missing_or_mismatch' AS issue
FROM resolved
WHERE resolved.feature_key IS DISTINCT FROM 'crm_v2_google_calendar'
   OR resolved.enabled_text IS DISTINCT FROM 'false'
   OR resolved.client_visible_text IS DISTINCT FROM 'false'
   OR resolved.adviser_visible_text IS DISTINCT FROM 'true';
