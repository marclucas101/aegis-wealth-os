-- Phase 01 — CRM V2 foundation feature controls (additive seed only)
-- Reversible by leaving flags disabled. Does not modify existing feature-control rows.

INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  (
    'crm_v2_master',
    false,
    false,
    true,
    'Adviser CRM V2 master gate for /advisor-v2. Default disabled until operator-approved pilot.'
  ),
  (
    'crm_v2_pilot_mode',
    false,
    false,
    true,
    'When enabled with crm_v2_master, restricts CRM V2 to CRM_V2_PILOT_USER_IDS allowlist.'
  )
ON CONFLICT (feature_key) DO NOTHING;
