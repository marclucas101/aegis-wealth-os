-- Discrepancy check for migration 202606290008 (Phase 06 Service feature control).

WITH service_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_service'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_service'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text
),
client_service_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_client_service'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_client_service'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text
)
SELECT
  'phase06.feature.discrepancy' AS check_id,
  'crm_v2_service' AS expected_feature_key,
  service_resolved.feature_key AS actual_feature_key,
  service_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM service_resolved
WHERE service_resolved.feature_key IS DISTINCT FROM 'crm_v2_service'
   OR service_resolved.enabled_text IS DISTINCT FROM 'false'
UNION ALL
SELECT
  'phase06.feature.discrepancy' AS check_id,
  'crm_v2_client_service' AS expected_feature_key,
  client_service_resolved.feature_key AS actual_feature_key,
  client_service_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM client_service_resolved
WHERE client_service_resolved.feature_key IS DISTINCT FROM 'crm_v2_client_service'
   OR client_service_resolved.enabled_text IS DISTINCT FROM 'false';
