-- Phase 09 — CRM V2 Advocacy feature control seeds
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
    'crm_v2_advocacy',
    false,
    true,
    true,
    'CRM V2 advocacy events, consent, and yearly score — adviser workspace and client preferences (Phase 09)'
  )
ON CONFLICT (feature_key) DO NOTHING;
