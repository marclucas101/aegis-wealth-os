-- Phase 06 — CRM V2 Service feature control seeds
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
    'crm_v2_service',
    false,
    false,
    true,
    'CRM V2 adviser Service workspace — commitments and servicing (Phase 06)'
  ),
  (
    'crm_v2_client_service',
    false,
    true,
    false,
    'CRM V2 client Actions and service requests collaboration (Phase 06)'
  )
ON CONFLICT (feature_key) DO NOTHING;
