-- Discrepancy check for migration 202606290019 (Phase 12 Reports and Operations feature control).
-- Returns rows only when seed state mismatches; empty result set when correctly applied.

WITH reports_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_reports'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_reports'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/client_visible/text()',
        query_to_xml(
          $$SELECT client_visible::text AS client_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_reports'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS client_visible_text,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/adviser_visible/text()',
        query_to_xml(
          $$SELECT adviser_visible::text AS adviser_visible FROM platform_feature_controls WHERE feature_key = 'crm_v2_reports'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS adviser_visible_text
),
operations_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_operations'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_operations'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text
)
SELECT
  'phase12.reports_operations.feature.discrepancy' AS check_id,
  'crm_v2_reports' AS expected_feature_key,
  reports_resolved.feature_key AS actual_feature_key,
  reports_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM reports_resolved
WHERE reports_resolved.feature_key IS DISTINCT FROM 'crm_v2_reports'
   OR reports_resolved.enabled_text IS DISTINCT FROM 'false'
UNION ALL
SELECT
  'phase12.reports_operations.feature.discrepancy',
  'crm_v2_reports_client_visible',
  reports_resolved.client_visible_text,
  reports_resolved.enabled_text,
  'client_visible_not_false'
FROM reports_resolved
WHERE reports_resolved.client_visible_text IS DISTINCT FROM 'false'
UNION ALL
SELECT
  'phase12.reports_operations.feature.discrepancy',
  'crm_v2_reports_adviser_visible',
  reports_resolved.adviser_visible_text,
  reports_resolved.enabled_text,
  'adviser_visible_not_true'
FROM reports_resolved
WHERE reports_resolved.adviser_visible_text IS DISTINCT FROM 'true'
UNION ALL
SELECT
  'phase12.reports_operations.feature.discrepancy',
  'crm_v2_operations',
  operations_resolved.feature_key,
  operations_resolved.enabled_text,
  'missing_or_mismatch'
FROM operations_resolved
WHERE operations_resolved.feature_key IS DISTINCT FROM 'crm_v2_operations'
   OR operations_resolved.enabled_text IS DISTINCT FROM 'false';
