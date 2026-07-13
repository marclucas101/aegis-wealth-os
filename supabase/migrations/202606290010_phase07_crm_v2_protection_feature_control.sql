-- Phase 07 — CRM V2 Protection portfolio feature control seed
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
    'crm_v2_protection_portfolio',
    false,
    true,
    true,
    'CRM V2 structured protection portfolio — adviser verification and client summary (Phase 07)'
  )
ON CONFLICT (feature_key) DO NOTHING;
