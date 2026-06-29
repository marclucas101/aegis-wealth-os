-- Phase 02 — CRM V2 relationships feature control (additive seed only)
-- Reversible by leaving flag disabled. Does not modify existing feature-control rows.

INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  (
    'crm_v2_relationships',
    false,
    false,
    true,
    'Adviser CRM V2 relationship list and Relationship 360 workspace. Default disabled until operator-approved pilot.'
  )
ON CONFLICT (feature_key) DO NOTHING;
