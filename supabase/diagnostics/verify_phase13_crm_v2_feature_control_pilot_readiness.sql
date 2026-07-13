-- Verification for Phase 13 CRM V2 pilot readiness (read-only catalog).
-- Lists CRM V2 feature-control states and pilot safety signals.
-- Does not mutate feature-control state.
-- Note: CRM_V2_PILOT_USER_IDS is server environment only — not detectable in SQL.

WITH crm_v2_flags AS (
  SELECT
    feature_key,
    enabled,
    client_visible,
    adviser_visible
  FROM platform_feature_controls
  WHERE feature_key LIKE 'crm_v2_%'
    OR feature_key = 'adviser_work_queue'
),
master_state AS (
  SELECT COALESCE(MAX(enabled::int), 0) AS master_enabled
  FROM crm_v2_flags
  WHERE feature_key = 'crm_v2_master'
),
pilot_state AS (
  SELECT COALESCE(MAX(enabled::int), 0) AS pilot_enabled
  FROM crm_v2_flags
  WHERE feature_key = 'crm_v2_pilot_mode'
),
enabled_flags AS (
  SELECT feature_key
  FROM crm_v2_flags
  WHERE enabled = true
),
client_visible_enabled AS (
  SELECT feature_key
  FROM crm_v2_flags
  WHERE enabled = true AND client_visible = true
),
sub_flags_without_gates AS (
  SELECT f.feature_key
  FROM crm_v2_flags f
  CROSS JOIN master_state m
  CROSS JOIN pilot_state p
  WHERE f.enabled = true
    AND f.feature_key NOT IN ('crm_v2_master', 'crm_v2_pilot_mode', 'crm_v2_cutover', 'crm_v2_legacy_fallback')
    AND (m.master_enabled = 0 OR p.pilot_enabled = 0)
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
  'phase13.pilot_readiness.verify.summary' AS check_id,
  (SELECT COUNT(*)::int FROM crm_v2_flags) AS crm_v2_flag_rows,
  (SELECT COUNT(*)::int FROM enabled_flags) AS enabled_crm_v2_flag_count,
  (SELECT string_agg(feature_key, ', ' ORDER BY feature_key) FROM enabled_flags) AS enabled_feature_keys,
  (SELECT master_enabled FROM master_state) AS crm_v2_master_enabled,
  (SELECT pilot_enabled FROM pilot_state) AS crm_v2_pilot_mode_enabled,
  (SELECT COUNT(*)::int FROM client_visible_enabled) AS client_visible_enabled_count,
  (SELECT string_agg(feature_key, ', ' ORDER BY feature_key) FROM client_visible_enabled) AS client_visible_enabled_keys,
  (SELECT COUNT(*)::int FROM sub_flags_without_gates) AS sub_flags_enabled_without_master_or_pilot,
  (SELECT string_agg(feature_key, ', ' ORDER BY feature_key) FROM sub_flags_without_gates) AS sub_flags_without_gates_keys,
  (SELECT COUNT(*)::int FROM duplicate_keys) AS duplicate_feature_key_count,
  'CRM_V2_PILOT_USER_IDS_not_sql_detectable' AS pilot_allowlist_env_note
WHERE to_regclass('public.platform_feature_controls') IS NOT NULL
UNION ALL
SELECT
  'phase13.pilot_readiness.verify.summary',
  0,
  0,
  NULL,
  0,
  0,
  0,
  NULL,
  0,
  NULL,
  0,
  'platform_feature_controls_absent'
WHERE to_regclass('public.platform_feature_controls') IS NULL;

-- Detail: all CRM V2 feature-control rows (second result set when table present).
SELECT
  'phase13.pilot_readiness.verify.flag_row' AS check_id,
  feature_key,
  enabled::text AS enabled,
  client_visible::text AS client_visible,
  adviser_visible::text AS adviser_visible
FROM platform_feature_controls
WHERE feature_key LIKE 'crm_v2_%'
   OR feature_key = 'adviser_work_queue'
ORDER BY feature_key
;
