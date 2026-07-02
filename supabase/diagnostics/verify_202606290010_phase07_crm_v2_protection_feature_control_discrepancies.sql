-- Discrepancy check for migration 202606290010 (Phase 07 Protection feature control).

WITH protection_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_protection_portfolio'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_protection_portfolio'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text
)
SELECT
  'phase07.feature.discrepancy' AS check_id,
  'crm_v2_protection_portfolio' AS expected_feature_key,
  protection_resolved.feature_key AS actual_feature_key,
  protection_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM protection_resolved
WHERE protection_resolved.feature_key IS DISTINCT FROM 'crm_v2_protection_portfolio'
   OR protection_resolved.enabled_text IS DISTINCT FROM 'false';
