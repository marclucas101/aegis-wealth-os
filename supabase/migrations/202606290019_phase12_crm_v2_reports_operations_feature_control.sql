-- Phase 12 — CRM V2 Reports and Operations feature control seeds
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
    'crm_v2_reports',
    false,
    false,
    true,
    'CRM V2 adviser reports — bounded projection-only insight (Phase 12)'
  ),
  (
    'crm_v2_operations',
    false,
    false,
    true,
    'CRM V2 operations diagnostics — sync, migration and exception visibility (Phase 12)'
  )
ON CONFLICT (feature_key) DO NOTHING;
