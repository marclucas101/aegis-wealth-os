-- Phase 04 — CRM V2 client appointment collaboration feature control seed
-- Additive only. Default disabled. Fail-closed.

INSERT INTO platform_feature_controls (
  feature_key,
  enabled,
  client_visible,
  adviser_visible,
  description
)
VALUES (
  'crm_v2_appointments_client',
  false,
  false,
  false,
  'CRM V2 client portal appointment collaboration (Phase 04)'
)
ON CONFLICT (feature_key) DO NOTHING;
