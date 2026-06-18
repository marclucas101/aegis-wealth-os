-- Phase 8B: adviser-created and external-import appointments

ALTER TABLE adviser_appointments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'client_booking',
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS private_adviser_note TEXT,
  ADD COLUMN IF NOT EXISTS phone_instructions TEXT,
  ADD COLUMN IF NOT EXISTS custom_meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS location_text TEXT,
  ADD COLUMN IF NOT EXISTS notification_status TEXT,
  ADD COLUMN IF NOT EXISTS notification_error TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_error TEXT;

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_source_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_source_check CHECK (
    source IN ('client_booking', 'adviser_created', 'external_import')
  );

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_notification_status_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_notification_status_check CHECK (
    notification_status IS NULL
    OR notification_status IN ('pending', 'sent', 'failed', 'retrying')
  );

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_calendar_sync_status_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_calendar_sync_status_check CHECK (
    calendar_sync_status IS NULL
    OR calendar_sync_status IN ('not_synced', 'synced', 'failed', 'skipped')
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_adviser_appointments_creator_idempotency
  ON adviser_appointments (created_by_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND created_by_user_id IS NOT NULL;

COMMENT ON COLUMN adviser_appointments.source IS
  'client_booking | adviser_created | external_import';
COMMENT ON COLUMN adviser_appointments.private_adviser_note IS
  'Adviser-only note; never exposed to client APIs.';
COMMENT ON COLUMN adviser_appointments.notification_status IS
  'Client email notification lifecycle: pending, sent, failed, retrying.';
COMMENT ON COLUMN adviser_appointments.calendar_sync_status IS
  'Google Calendar sync state for adviser-created appointments.';
