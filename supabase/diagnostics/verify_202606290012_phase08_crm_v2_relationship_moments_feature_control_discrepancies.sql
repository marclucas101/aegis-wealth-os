-- Discrepancy report for migration 202606290012 (Phase 08 Relationship moments feature control).

WITH moments_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_relationship_moments'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_relationship_moments'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text
),
profile_resolved AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/feature_key/text()',
        query_to_xml(
          $$SELECT feature_key FROM platform_feature_controls WHERE feature_key = 'crm_v2_client_profile'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS feature_key,
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::text
      ELSE (xpath('//row/enabled/text()',
        query_to_xml(
          $$SELECT enabled::text AS enabled FROM platform_feature_controls WHERE feature_key = 'crm_v2_client_profile'$$,
          true,
          true,
          ''
        )))[1]::text
    END AS enabled_text
)
SELECT
  'phase08.feature.discrepancy' AS check_id,
  'crm_v2_relationship_moments' AS expected_feature_key,
  moments_resolved.feature_key AS actual_feature_key,
  moments_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM moments_resolved
WHERE moments_resolved.feature_key IS DISTINCT FROM 'crm_v2_relationship_moments'
   OR moments_resolved.enabled_text IS DISTINCT FROM 'false'
UNION ALL
SELECT
  'phase08.feature.discrepancy' AS check_id,
  'crm_v2_client_profile' AS expected_feature_key,
  profile_resolved.feature_key AS actual_feature_key,
  profile_resolved.enabled_text AS actual_enabled,
  'missing_or_mismatch' AS issue
FROM profile_resolved
WHERE profile_resolved.feature_key IS DISTINCT FROM 'crm_v2_client_profile'
   OR profile_resolved.enabled_text IS DISTINCT FROM 'false';
