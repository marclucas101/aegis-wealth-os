-- Phase 05 — CRM V2 Google Calendar authority and mapping core
-- Additive only. Rerunnable policies/triggers. No destructive changes.

ALTER TABLE adviser_calendar_connections
  ADD COLUMN IF NOT EXISTS google_account_id TEXT,
  ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS refresh_capable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_refresh_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;

ALTER TABLE adviser_calendar_connections
  DROP CONSTRAINT IF EXISTS adviser_calendar_connections_connection_status_check;

ALTER TABLE adviser_calendar_connections
  ADD CONSTRAINT adviser_calendar_connections_connection_status_check
  CHECK (connection_status IN ('active', 'action_required', 'revoked', 'disconnected'));

CREATE TABLE IF NOT EXISTS crm_google_oauth_states (
  state_hash TEXT PRIMARY KEY,
  adviser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_google_oauth_states_adviser
  ON crm_google_oauth_states (adviser_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS crm_google_calendar_event_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES adviser_appointments(id) ON DELETE CASCADE,
  adviser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_calendar_id TEXT NOT NULL,
  google_event_id TEXT NOT NULL,
  provider_event_etag TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_attempted_sync_at TIMESTAMPTZ,
  last_successful_sync_at TIMESTAMPTZ,
  last_aegis_version_synced INTEGER,
  last_provider_modified_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  safe_error_code TEXT,
  disconnected_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_google_calendar_event_mappings_sync_status_check
    CHECK (sync_status IN ('pending', 'synced', 'failed', 'action_required', 'cancelled')),
  CONSTRAINT crm_google_calendar_event_mappings_retry_count_check
    CHECK (retry_count >= 0),
  CONSTRAINT crm_google_calendar_event_mappings_unique
    UNIQUE (appointment_id, adviser_user_id, connection_calendar_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_google_calendar_event_mappings_event
  ON crm_google_calendar_event_mappings (adviser_user_id, connection_calendar_id, google_event_id);

CREATE INDEX IF NOT EXISTS idx_crm_google_calendar_event_mappings_sync_status
  ON crm_google_calendar_event_mappings (adviser_user_id, sync_status, updated_at DESC);

DROP TRIGGER IF EXISTS crm_google_calendar_event_mappings_set_updated_at
  ON crm_google_calendar_event_mappings;
CREATE TRIGGER crm_google_calendar_event_mappings_set_updated_at
  BEFORE UPDATE ON crm_google_calendar_event_mappings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE crm_google_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_google_calendar_event_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_google_oauth_states_no_client_access
  ON crm_google_oauth_states;
CREATE POLICY crm_google_oauth_states_no_client_access
  ON crm_google_oauth_states FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS crm_google_calendar_event_mappings_adviser_access
  ON crm_google_calendar_event_mappings;
CREATE POLICY crm_google_calendar_event_mappings_adviser_access
  ON crm_google_calendar_event_mappings FOR SELECT
  TO authenticated
  USING (adviser_user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS crm_google_calendar_event_mappings_admin_write
  ON crm_google_calendar_event_mappings;
CREATE POLICY crm_google_calendar_event_mappings_admin_write
  ON crm_google_calendar_event_mappings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
