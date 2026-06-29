-- Verification diagnostic: Phase 04 client appointments feature control seed
-- Uses guarded query_to_xml pattern for optional-relation-safe diagnostics.
WITH rel AS (
  SELECT to_regclass('public.platform_feature_controls') AS relid
),
rows AS (
  SELECT
    CASE
      WHEN rel.relid IS NULL THEN false
      ELSE (
        POSITION(
          '<feature_key>crm_v2_appointments_client</feature_key>' IN
          query_to_xml(
            $$SELECT feature_key FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
            false,
            true,
            ''
          )::text
        ) > 0
        AND POSITION(
          '<enabled>false</enabled>' IN
          query_to_xml(
            $$SELECT enabled::text AS enabled FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
            false,
            true,
            ''
          )::text
        ) > 0
        AND POSITION(
          '<client_visible>false</client_visible>' IN
          query_to_xml(
            $$SELECT client_visible::text AS client_visible FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
            false,
            true,
            ''
          )::text
        ) > 0
        AND POSITION(
          '<adviser_visible>false</adviser_visible>' IN
          query_to_xml(
            $$SELECT adviser_visible::text AS adviser_visible FROM public.platform_feature_controls WHERE feature_key = 'crm_v2_appointments_client'$$,
            false,
            true,
            ''
          )::text
        ) > 0
      )
    END AS ok
  FROM rel
)
SELECT
  'phase04.feature.verify.crm_v2_appointments_client' AS check_id,
  rows.ok
FROM rows;
