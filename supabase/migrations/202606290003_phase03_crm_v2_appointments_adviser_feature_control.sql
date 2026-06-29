-- Phase 03 — CRM V2 appointments adviser feature control (additive seed only)

INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  (
    'crm_v2_appointments_adviser',
    false,
    false,
    true,
    'Adviser CRM V2 appointment workflow. Default disabled until operator-approved pilot.'
  )
ON CONFLICT (feature_key) DO NOTHING;
