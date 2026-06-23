-- Phase 9F.2 — document lifecycle notification hardening
-- Additive only. Do not apply to production without staging validation.

ALTER TABLE client_notifications
  ADD COLUMN IF NOT EXISTS lifecycle_event TEXT,
  ADD COLUMN IF NOT EXISTS source_entity_type TEXT,
  ADD COLUMN IF NOT EXISTS source_lifecycle_version TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN client_notifications.lifecycle_event IS
  'Phase 9F.2 governed lifecycle event name (replaced, superseded, withdrawn, action_required, action_completed).';

COMMENT ON COLUMN client_notifications.idempotency_key IS
  'Phase 9F.2 SHA-256 hex digest of canonical lifecycle tuple — prevents duplicate notifications without storing PII.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_notifications_lifecycle_idempotent
  ON client_notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_notifications_lifecycle_event
  ON client_notifications (lifecycle_event, created_at DESC)
  WHERE lifecycle_event IS NOT NULL;

COMMENT ON TABLE client_notifications IS
  'Phase 9E/9F.2 client in-app notifications. RLS: clients read own rows via API service-role.';

-- Rollback (manual, staging only):
-- DROP INDEX IF EXISTS idx_client_notifications_lifecycle_event;
-- DROP INDEX IF EXISTS idx_client_notifications_lifecycle_idempotent;
-- ALTER TABLE client_notifications
--   DROP COLUMN IF EXISTS metadata,
--   DROP COLUMN IF EXISTS idempotency_key,
--   DROP COLUMN IF EXISTS source_lifecycle_version,
--   DROP COLUMN IF EXISTS source_entity_type,
--   DROP COLUMN IF EXISTS lifecycle_event;
