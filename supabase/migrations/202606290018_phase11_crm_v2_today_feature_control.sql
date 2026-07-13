-- Phase 11 — CRM V2 Today feature control seeds
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
    'crm_v2_today',
    false,
    false,
    true,
    'CRM V2 Today workspace — adviser daily operating dashboard (Phase 11)'
  ),
  (
    'adviser_work_queue',
    false,
    false,
    true,
    'Virtual adviser work queue assembly — enable with Today (Phase 11)'
  )
ON CONFLICT (feature_key) DO NOTHING;
