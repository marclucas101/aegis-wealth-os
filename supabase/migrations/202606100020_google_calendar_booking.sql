-- Phase 6D: Google Calendar booking — connections, settings, appointments
-- Tokens are server-only; RLS blocks client SELECT on adviser_calendar_connections.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- adviser_calendar_connections (encrypted OAuth tokens — server access only)
-- ---------------------------------------------------------------------------
CREATE TABLE adviser_calendar_connections (
  adviser_user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider                 TEXT NOT NULL DEFAULT 'google',
  encrypted_refresh_token  TEXT NOT NULL,
  encrypted_access_token   TEXT,
  access_token_expires_at  TIMESTAMPTZ,
  calendar_id              TEXT,
  calendar_email           TEXT,
  scopes                   TEXT[] NOT NULL DEFAULT '{}',
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at               TIMESTAMPTZ,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adviser_calendar_connections_provider_check
    CHECK (provider = 'google')
);

CREATE TRIGGER adviser_calendar_connections_set_updated_at
  BEFORE UPDATE ON adviser_calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE adviser_calendar_connections IS
  'Server-only Google OAuth tokens for adviser calendars. Never expose via API to browsers.';

-- ---------------------------------------------------------------------------
-- adviser_calendar_settings
-- ---------------------------------------------------------------------------
CREATE TABLE adviser_calendar_settings (
  adviser_user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  timezone                     TEXT NOT NULL DEFAULT 'Asia/Singapore',
  appointment_duration_minutes INTEGER NOT NULL DEFAULT 60,
  buffer_before_minutes        INTEGER NOT NULL DEFAULT 15,
  buffer_after_minutes         INTEGER NOT NULL DEFAULT 15,
  minimum_notice_hours         INTEGER NOT NULL DEFAULT 24,
  booking_horizon_days         INTEGER NOT NULL DEFAULT 60,
  location_type                TEXT NOT NULL DEFAULT 'google_meet',
  meeting_location_text        TEXT,
  appointment_types            JSONB NOT NULL DEFAULT
    '[{"id":"review","label":"60-minute review","durationMinutes":60}]'::jsonb,
  working_hours                JSONB NOT NULL DEFAULT
    '{"monday":{"enabled":true,"start":"09:00","end":"17:00"},"tuesday":{"enabled":true,"start":"09:00","end":"17:00"},"wednesday":{"enabled":true,"start":"09:00","end":"17:00"},"thursday":{"enabled":true,"start":"09:00","end":"17:00"},"friday":{"enabled":true,"start":"09:00","end":"17:00"},"saturday":{"enabled":false,"start":"09:00","end":"12:00"},"sunday":{"enabled":false,"start":"09:00","end":"12:00"}}'::jsonb,
  blackout_dates               JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adviser_calendar_settings_duration_check
    CHECK (appointment_duration_minutes > 0 AND appointment_duration_minutes <= 480),
  CONSTRAINT adviser_calendar_settings_buffer_check
    CHECK (buffer_before_minutes >= 0 AND buffer_after_minutes >= 0),
  CONSTRAINT adviser_calendar_settings_notice_check
    CHECK (minimum_notice_hours >= 0),
  CONSTRAINT adviser_calendar_settings_horizon_check
    CHECK (booking_horizon_days > 0 AND booking_horizon_days <= 365),
  CONSTRAINT adviser_calendar_settings_location_check
    CHECK (location_type IN ('physical', 'phone', 'google_meet'))
);

CREATE TRIGGER adviser_calendar_settings_set_updated_at
  BEFORE UPDATE ON adviser_calendar_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- adviser_appointments
-- ---------------------------------------------------------------------------
CREATE TYPE adviser_appointment_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'failed'
);

CREATE TABLE adviser_appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adviser_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  appointment_type    TEXT NOT NULL,
  starts_at           TIMESTAMPTZ NOT NULL,
  ends_at             TIMESTAMPTZ NOT NULL,
  timezone            TEXT NOT NULL,
  status              adviser_appointment_status NOT NULL DEFAULT 'pending',
  google_event_id     TEXT,
  google_calendar_id  TEXT,
  google_event_url    TEXT,
  client_notes        TEXT,
  location_type       TEXT NOT NULL DEFAULT 'google_meet',
  meeting_url         TEXT,
  idempotency_key     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at        TIMESTAMPTZ,
  CONSTRAINT adviser_appointments_time_check CHECK (ends_at > starts_at),
  CONSTRAINT adviser_appointments_location_check
    CHECK (location_type IN ('physical', 'phone', 'google_meet'))
);

CREATE INDEX idx_adviser_appointments_adviser_starts
  ON adviser_appointments (adviser_user_id, starts_at);

CREATE INDEX idx_adviser_appointments_client_starts
  ON adviser_appointments (client_user_id, starts_at);

CREATE INDEX idx_adviser_appointments_status
  ON adviser_appointments (status)
  WHERE status IN ('pending', 'confirmed');

CREATE UNIQUE INDEX idx_adviser_appointments_idempotency
  ON adviser_appointments (client_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_no_overlap
  EXCLUDE USING gist (
    adviser_user_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status IN ('pending', 'confirmed'));

CREATE TRIGGER adviser_appointments_set_updated_at
  BEFORE UPDATE ON adviser_appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: adviser_calendar_connections — no authenticated SELECT (service role only)
-- ---------------------------------------------------------------------------
ALTER TABLE adviser_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY adviser_calendar_connections_no_client_access
  ON adviser_calendar_connections FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- RLS: adviser_calendar_settings
-- ---------------------------------------------------------------------------
ALTER TABLE adviser_calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY adviser_calendar_settings_select_own_or_admin
  ON adviser_calendar_settings FOR SELECT
  TO authenticated
  USING (adviser_user_id = auth.uid() OR is_admin());

CREATE POLICY adviser_calendar_settings_insert_own_or_admin
  ON adviser_calendar_settings FOR INSERT
  TO authenticated
  WITH CHECK (adviser_user_id = auth.uid() OR is_admin());

CREATE POLICY adviser_calendar_settings_update_own_or_admin
  ON adviser_calendar_settings FOR UPDATE
  TO authenticated
  USING (adviser_user_id = auth.uid() OR is_admin())
  WITH CHECK (adviser_user_id = auth.uid() OR is_admin());

CREATE POLICY adviser_calendar_settings_delete_admin
  ON adviser_calendar_settings FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- RLS: adviser_appointments
-- ---------------------------------------------------------------------------
ALTER TABLE adviser_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY adviser_appointments_select_own_client_or_admin
  ON adviser_appointments FOR SELECT
  TO authenticated
  USING (
    adviser_user_id = auth.uid()
    OR client_user_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY adviser_appointments_insert_client_assigned
  ON adviser_appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    client_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = adviser_appointments.client_id
        AND c.user_id = auth.uid()
        AND c.advisor_user_id = adviser_appointments.adviser_user_id
    )
  );

CREATE POLICY adviser_appointments_update_adviser_client_or_admin
  ON adviser_appointments FOR UPDATE
  TO authenticated
  USING (
    adviser_user_id = auth.uid()
    OR client_user_id = auth.uid()
    OR is_admin()
  )
  WITH CHECK (
    adviser_user_id = auth.uid()
    OR client_user_id = auth.uid()
    OR is_admin()
  );

CREATE POLICY adviser_appointments_delete_admin
  ON adviser_appointments FOR DELETE
  TO authenticated
  USING (is_admin());
