-- Phase 9C: Adviser Meeting Studio
-- Additive only — no changes to appointments, notes, or financial tables.
-- Rollback: see docs/PHASE_9C_MIGRATION_AND_ROLLBACK.md

-- ---------------------------------------------------------------------------
-- Meeting session enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_session_status') THEN
    CREATE TYPE meeting_session_status AS ENUM (
      'draft',
      'prepared',
      'in_progress',
      'completed',
      'cancelled',
      'archived'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_summary_status') THEN
    CREATE TYPE meeting_summary_status AS ENUM (
      'draft',
      'adviser_reviewed',
      'ready_for_publication',
      'published',
      'archived'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Meeting sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  appointment_id              UUID REFERENCES adviser_appointments(id) ON DELETE SET NULL,
  meeting_type                TEXT NOT NULL DEFAULT 'review',
  status                      meeting_session_status NOT NULL DEFAULT 'draft',
  scheduled_start             TIMESTAMPTZ,
  started_at                  TIMESTAMPTZ,
  ended_at                    TIMESTAMPTZ,
  completed_at                TIMESTAMPTZ,
  title                       TEXT,
  purpose                     TEXT,
  selected_sections           JSONB NOT NULL DEFAULT '[]'::jsonb,
  section_order               JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections_shown              JSONB NOT NULL DEFAULT '[]'::jsonb,
  skipped_sections            JSONB NOT NULL DEFAULT '[]'::jsonb,
  preparation_state           JSONB NOT NULL DEFAULT '{}'::jsonb,
  close_state                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  fact_confirmations          JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenario_selections         JSONB NOT NULL DEFAULT '[]'::jsonb,
  acknowledgements            JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_snapshot_version       TEXT,
  algorithm_version           TEXT,
  relationship_stage_at_start relationship_stage,
  relationship_stage_at_end   relationship_stage,
  summary_status              meeting_summary_status NOT NULL DEFAULT 'draft',
  summary_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_output_id         UUID REFERENCES published_outputs(id) ON DELETE SET NULL,
  requires_analysis_refresh   BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT meeting_sessions_meeting_type_check CHECK (
    meeting_type IN ('initial', 'review', 'follow_up', 'planning', 'other')
  ),
  CONSTRAINT meeting_sessions_selected_sections_is_array CHECK (
    jsonb_typeof(selected_sections) = 'array'
  ),
  CONSTRAINT meeting_sessions_preparation_state_is_object CHECK (
    jsonb_typeof(preparation_state) = 'object'
  ),
  CONSTRAINT meeting_sessions_close_state_is_object CHECK (
    jsonb_typeof(close_state) = 'object'
  ),
  CONSTRAINT meeting_sessions_summary_payload_is_object CHECK (
    jsonb_typeof(summary_payload) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_client_id
  ON meeting_sessions (client_id);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_adviser_status
  ON meeting_sessions (adviser_user_id, status);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_client_status
  ON meeting_sessions (client_id, status);

CREATE INDEX IF NOT EXISTS idx_meeting_sessions_appointment_id
  ON meeting_sessions (appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE TRIGGER meeting_sessions_set_updated_at
  BEFORE UPDATE ON meeting_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE meeting_sessions IS
  'Adviser-controlled meeting sessions. No client access — API layer only.';

-- ---------------------------------------------------------------------------
-- Meeting session events (privacy-conscious audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_session_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type        TEXT NOT NULL,
  section_type      TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT meeting_session_events_metadata_is_object CHECK (
    jsonb_typeof(metadata) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_meeting_session_events_session_id
  ON meeting_session_events (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_meeting_session_events_client_id
  ON meeting_session_events (client_id, created_at DESC);

COMMENT ON TABLE meeting_session_events IS
  'Privacy-conscious meeting audit events. References only — no financial payloads.';

-- ---------------------------------------------------------------------------
-- RLS — adviser/admin via service role; no client policies
-- ---------------------------------------------------------------------------
ALTER TABLE meeting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY meeting_sessions_select_adviser ON meeting_sessions
  FOR SELECT
  USING (is_assigned_advisor(client_id) OR is_admin());

CREATE POLICY meeting_session_events_select_adviser ON meeting_session_events
  FOR SELECT
  USING (is_assigned_advisor(client_id) OR is_admin());

-- ---------------------------------------------------------------------------
-- Phase 9C feature controls (fail-closed defaults)
-- ---------------------------------------------------------------------------
INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  ('adviser_meeting_studio', true, false, true,
   'Adviser Meeting Studio — prepare, present, close workflow'),
  ('meeting_presentation_mode', true, false, true,
   'Full-screen adviser-led presentation mode'),
  ('meeting_exact_amount_presentations', false, false, true,
   'Allow exact coverage amounts in meeting presentation — default off'),
  ('meeting_client_acknowledgements', true, false, true,
   'Optional on-screen client acknowledgement capture during meetings'),
  ('meeting_summary_publication', true, false, true,
   'Prepare client-safe meeting summary via publication workflow')
ON CONFLICT (feature_key) DO NOTHING;
