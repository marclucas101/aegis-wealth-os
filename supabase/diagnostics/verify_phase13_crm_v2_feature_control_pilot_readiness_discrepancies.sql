-- Discrepancy check for Phase 13 CRM V2 pilot readiness.
-- Returns rows only when unsafe pilot-readiness state is detected.
-- Empty result set = no discrepancies for checked conditions.
-- Does not mutate feature-control state.

WITH crm_v2_flags AS (
  SELECT feature_key, enabled, client_visible, adviser_visible
  FROM platform_feature_controls
  WHERE feature_key LIKE 'crm_v2_%'
     OR feature_key = 'adviser_work_queue'
),
master_state AS (
  SELECT COALESCE(bool_or(enabled), false) AS master_enabled
  FROM crm_v2_flags
  WHERE feature_key = 'crm_v2_master'
),
pilot_state AS (
  SELECT COALESCE(bool_or(enabled), false) AS pilot_enabled
  FROM crm_v2_flags
  WHERE feature_key = 'crm_v2_pilot_mode'
),
duplicate_keys AS (
  SELECT feature_key, COUNT(*)::int AS row_count
  FROM platform_feature_controls
  WHERE feature_key LIKE 'crm_v2_%'
     OR feature_key = 'adviser_work_queue'
  GROUP BY feature_key
  HAVING COUNT(*) > 1
)
SELECT
  'phase13.pilot_readiness.discrepancy' AS check_id,
  f.feature_key,
  'sub_flag_enabled_without_master_or_pilot' AS issue,
  f.enabled::text AS actual_enabled
FROM crm_v2_flags f
CROSS JOIN master_state m
CROSS JOIN pilot_state p
WHERE f.enabled = true
  AND f.feature_key NOT IN ('crm_v2_master', 'crm_v2_pilot_mode', 'crm_v2_cutover', 'crm_v2_legacy_fallback')
  AND (NOT m.master_enabled OR NOT p.pilot_enabled)
UNION ALL
SELECT
  'phase13.pilot_readiness.discrepancy',
  f.feature_key,
  'client_visible_flag_enabled',
  f.enabled::text
FROM crm_v2_flags f
WHERE f.enabled = true
  AND f.client_visible = true
  AND f.feature_key NOT IN ('crm_v2_cutover', 'crm_v2_legacy_fallback')
UNION ALL
SELECT
  'phase13.pilot_readiness.discrepancy',
  d.feature_key,
  'duplicate_feature_control_row',
  d.row_count::text
FROM duplicate_keys d
UNION ALL
SELECT
  'phase13.pilot_readiness.discrepancy',
  'crm_v2_pilot_mode',
  'pilot_mode_enabled_operator_must_confirm_CRM_V2_PILOT_USER_IDS',
  'true'
FROM pilot_state p
WHERE p.pilot_enabled = true
UNION ALL
SELECT
  'phase13.pilot_readiness.discrepancy',
  f.feature_key,
  'crm_v2_flag_missing_from_catalog',
  'missing'
FROM (
  VALUES
    ('crm_v2_master'),
    ('crm_v2_pilot_mode'),
    ('crm_v2_relationships'),
    ('crm_v2_appointments_adviser'),
    ('crm_v2_appointments_client'),
    ('crm_v2_google_calendar'),
    ('crm_v2_service'),
    ('crm_v2_client_service'),
    ('crm_v2_protection_portfolio'),
    ('crm_v2_relationship_moments'),
    ('crm_v2_client_profile'),
    ('crm_v2_advocacy'),
    ('crm_v2_communications'),
    ('crm_v2_today'),
    ('crm_v2_reports'),
    ('crm_v2_operations')
) AS expected(feature_key)
LEFT JOIN crm_v2_flags f ON f.feature_key = expected.feature_key
WHERE to_regclass('public.platform_feature_controls') IS NOT NULL
  AND f.feature_key IS NULL;
