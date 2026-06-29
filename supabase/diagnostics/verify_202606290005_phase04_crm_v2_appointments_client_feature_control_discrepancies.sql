-- Discrepancy diagnostic: Phase 04 client appointments feature control seed
-- Uses guarded query_to_xml pattern for optional-relation-safe diagnostics.
WITH rel AS (
  SELECT to_regclass('public.platform_feature_controls') AS relid
),
actual AS (
  SELECT
    CASE
      WHEN rel.relid IS NULL THEN NULL::text
      ELSE
        CASE
          WHEN POSITION(
            '<feature_key>crm_v2_appointments_client</feature_key>' IN
            query_to_xml(
              $$SELECT feature_key FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
              false,
              true,
              ''
            )::text
          ) > 0
          THEN 'crm_v2_appointments_client'
          ELSE NULL::text
        END
      END AS feature_key,
    CASE
      WHEN rel.relid IS NULL THEN NULL::text
      ELSE
        CASE
          WHEN POSITION(
            '<enabled>false</enabled>' IN
            query_to_xml(
              $$SELECT enabled::text AS enabled FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
              false,
              true,
              ''
            )::text
          ) > 0
          THEN 'false'
          ELSE NULL::text
        END
      END AS enabled_text,
    CASE
      WHEN rel.relid IS NULL THEN NULL::text
      ELSE
        CASE
          WHEN POSITION(
            '<client_visible>false</client_visible>' IN
            query_to_xml(
              $$SELECT client_visible::text AS client_visible FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
              false,
              true,
              ''
            )::text
          ) > 0
          THEN 'false'
          ELSE NULL::text
        END
      END AS client_visible_text,
    CASE
      WHEN rel.relid IS NULL THEN NULL::text
      ELSE
        CASE
          WHEN POSITION(
            '<adviser_visible>false</adviser_visible>' IN
            query_to_xml(
              $$SELECT adviser_visible::text AS adviser_visible FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
              false,
              true,
              ''
            )::text
          ) > 0
          THEN 'false'
          ELSE NULL::text
        END
      END AS adviser_visible_text
  FROM rel
),
expected AS (
  SELECT
    'crm_v2_appointments_client'::text AS feature_key,
    'false'::text AS expected_enabled,
    'false'::text AS expected_client_visible,
    'false'::text AS expected_adviser_visible
)
SELECT
  'phase04.feature.discrepancy.crm_v2_appointments_client' AS check_id,
  'missing_or_mismatch' AS issue,
  expected.feature_key AS expected_feature_key,
  expected.expected_enabled,
  expected.expected_client_visible,
  expected.expected_adviser_visible,
  actual.enabled_text AS actual_enabled,
  actual.client_visible_text AS actual_client_visible,
  actual.adviser_visible_text AS actual_adviser_visible
FROM expected
CROSS JOIN actual
WHERE actual.feature_key IS DISTINCT FROM expected.feature_key
   OR actual.enabled_text IS DISTINCT FROM expected.expected_enabled
   OR actual.client_visible_text IS DISTINCT FROM expected.expected_client_visible
   OR actual.adviser_visible_text IS DISTINCT FROM expected.expected_adviser_visible;
