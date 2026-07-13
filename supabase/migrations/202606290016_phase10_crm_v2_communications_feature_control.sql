-- Phase 10 — CRM V2 Communications feature control seeds
-- Additive only. Default disabled. Fail-closed.

INSERT INTO platform_feature_controls (
  feature_key,
  enabled,
  client_visible,
  adviser_visible,
  description
)
VALUES
  (
    'crm_v2_communications',
    false,
    true,
    true,
    'CRM V2 governed communications — adviser workspace and client messages (Phase 10)'
  )
ON CONFLICT (feature_key) DO NOTHING;
