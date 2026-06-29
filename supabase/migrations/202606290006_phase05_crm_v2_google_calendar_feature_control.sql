-- Phase 05 — CRM V2 Google Calendar feature control seed
-- Additive only. Default disabled. Fail-closed.

INSERT INTO platform_feature_controls (
  feature_key,
  enabled,
  client_visible,
  adviser_visible,
  description
)
VALUES (
  'crm_v2_google_calendar',
  false,
  false,
  true,
  'CRM V2 one-way Google Calendar synchronization (Phase 05)'
)
ON CONFLICT (feature_key) DO NOTHING;
