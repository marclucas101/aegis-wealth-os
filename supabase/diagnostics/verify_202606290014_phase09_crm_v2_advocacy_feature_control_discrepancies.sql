-- Discrepancy check for migration 202606290014 (Phase 09 Advocacy feature control).
-- Returns rows only when seed state mismatches; empty result set when correctly applied.

WITH advocacy_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS client_visible_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_advocacy'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS adviser_visible_text
)
SELECT
  'phase09.advocacy.feature.discrepancy' AS check_id,
  'crm_v2_advocacy' AS expected_feature_key,
  advocacy_resolved.feature_key AS actual_feature_key,
  advocacy_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM advocacy_resolved
WHERE advocacy_resolved.feature_key IS DISTINCT FROM 'crm_v2_advocacy'
   OR advocacy_resolved.enabled_text IS DISTINCT FROM 'false'
UNION ALL
SELECT
  'phase09.advocacy.feature.discrepancy',
  'crm_v2_advocacy_client_visible',
  advocacy_resolved.client_visible_text,
  advocacy_resolved.enabled_text,
  'client_visible_not_true'
FROM advocacy_resolved
WHERE advocacy_resolved.client_visible_text IS DISTINCT FROM 'true'
UNION ALL
SELECT
  'phase09.advocacy.feature.discrepancy',
  'crm_v2_advocacy_adviser_visible',
  advocacy_resolved.adviser_visible_text,
  advocacy_resolved.enabled_text,
  'adviser_visible_not_true'
FROM advocacy_resolved
WHERE advocacy_resolved.adviser_visible_text IS DISTINCT FROM 'true';
