-- Discrepancy check for migration 202606290016 (Phase 10 Communications feature control).
-- Returns rows only when seed state mismatches; empty result set when correctly applied.

WITH communications_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS client_visible_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_communications'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS adviser_visible_text
)
SELECT
  'phase10.communications.feature.discrepancy' AS check_id,
  'crm_v2_communications' AS expected_feature_key,
  communications_resolved.feature_key AS actual_feature_key,
  communications_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM communications_resolved
WHERE communications_resolved.feature_key IS DISTINCT FROM 'crm_v2_communications'
   OR communications_resolved.enabled_text IS DISTINCT FROM 'false'
UNION ALL
SELECT
  'phase10.communications.feature.discrepancy',
  'crm_v2_communications_client_visible',
  communications_resolved.client_visible_text,
  communications_resolved.enabled_text,
  'client_visible_not_true'
FROM communications_resolved
WHERE communications_resolved.client_visible_text IS DISTINCT FROM 'true'
UNION ALL
SELECT
  'phase10.communications.feature.discrepancy',
  'crm_v2_communications_adviser_visible',
  communications_resolved.adviser_visible_text,
  communications_resolved.enabled_text,
  'adviser_visible_not_true'
FROM communications_resolved
WHERE communications_resolved.adviser_visible_text IS DISTINCT FROM 'true';
