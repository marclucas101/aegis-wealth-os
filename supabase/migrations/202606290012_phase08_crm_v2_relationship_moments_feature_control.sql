-- Phase 08 — CRM V2 Relationship moments feature control seeds
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
    'crm_v2_relationship_moments',
    false,
    false,
    true,
    'CRM V2 relationship moments and review rhythm — adviser workspace (Phase 08)'
  ),
  (
    'crm_v2_client_profile',
    false,
    true,
    false,
    'CRM V2 client relationship preferences — safe profile extensions (Phase 08)'
  )
ON CONFLICT (feature_key) DO NOTHING;
