-- Phase 03 — CRM V2 appointment core (additive extension to adviser_appointments + supporting tables)
-- Does not drop or rename existing columns. Does not backfill lifecycle history.

-- ---------------------------------------------------------------------------
-- adviser_appointments CRM lifecycle extension
-- ---------------------------------------------------------------------------
ALTER TABLE adviser_appointments
  ADD COLUMN IF NOT EXISTS crm_lifecycle_status TEXT,
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS preparation_state TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS follow_up_state TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_transition_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_transition_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS no_show_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_crm_lifecycle_status_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_crm_lifecycle_status_check CHECK (
    crm_lifecycle_status IS NULL
    OR crm_lifecycle_status IN (
      'requested',
      'proposed',
      'awaiting_confirmation',
      'confirmed',
      'rescheduled',
      'preparing',
      'ready',
      'in_progress',
      'follow_up_required',
      'closed',
      'cancelled_by_client',
      'cancelled_by_adviser',
      'no_show',
      'legacy_cancelled',
      'legacy_failed',
      'legacy_unknown'
    )
  );

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_preparation_state_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_preparation_state_check CHECK (
    preparation_state IN ('not_started', 'in_progress', 'complete')
  );

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_follow_up_state_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_follow_up_state_check CHECK (
    follow_up_state IN ('none', 'required', 'complete')
  );

ALTER TABLE adviser_appointments
  DROP CONSTRAINT IF EXISTS adviser_appointments_version_positive_check;

ALTER TABLE adviser_appointments
  ADD CONSTRAINT adviser_appointments_version_positive_check CHECK (version >= 1);

CREATE INDEX IF NOT EXISTS idx_adviser_appointments_adviser_lifecycle_starts
  ON adviser_appointments (adviser_user_id, crm_lifecycle_status, starts_at DESC);

COMMENT ON COLUMN adviser_appointments.crm_lifecycle_status IS
  'Canonical CRM V2 lifecycle status. NULL uses legacy status mapping on read.';
COMMENT ON COLUMN adviser_appointments.template_key IS
  'Code-defined CRM appointment template key (Phase 03).';
COMMENT ON COLUMN adviser_appointments.title IS
  'Safe appointment purpose/title — no private financial detail.';

-- ---------------------------------------------------------------------------
-- Supporting: participants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_appointment_participants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES adviser_appointments(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL,
  role              TEXT NOT NULL DEFAULT 'guest',
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_appointment_participants_role_check CHECK (
    role IN ('client', 'adviser', 'guest')
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_appointment_participants_appointment
  ON crm_appointment_participants (appointment_id, sort_order);

-- ---------------------------------------------------------------------------
-- Supporting: immutable state events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_appointment_state_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES adviser_appointments(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type        TEXT NOT NULL,
  from_state        TEXT,
  to_state          TEXT,
  actor_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_code       TEXT,
  request_id        TEXT,
  previous_starts_at TIMESTAMPTZ,
  previous_ends_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_appointment_state_events_event_type_check CHECK (
    event_type IN (
      'created',
      'updated',
      'transition',
      'rescheduled',
      'participant_added',
      'checklist_updated'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_appointment_state_events_appointment
  ON crm_appointment_state_events (appointment_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Supporting: client-requested topics (future client writer Phase 04)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_appointment_client_topics (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES adviser_appointments(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  topic_text        TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_appointment_client_topics_text_len CHECK (char_length(topic_text) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_crm_appointment_client_topics_appointment
  ON crm_appointment_client_topics (appointment_id, sort_order);

-- ---------------------------------------------------------------------------
-- Supporting: adviser agenda items (adviser-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_appointment_agenda_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES adviser_appointments(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_text         TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_appointment_agenda_items_text_len CHECK (char_length(item_text) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_crm_appointment_agenda_items_appointment
  ON crm_appointment_agenda_items (appointment_id, sort_order);

-- ---------------------------------------------------------------------------
-- Supporting: preparation checklist items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_appointment_checklist_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id    UUID NOT NULL REFERENCES adviser_appointments(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  item_key          TEXT NOT NULL,
  label             TEXT NOT NULL,
  required          BOOLEAN NOT NULL DEFAULT false,
  owner             TEXT NOT NULL DEFAULT 'adviser',
  visibility        TEXT NOT NULL DEFAULT 'adviser',
  completed         BOOLEAN NOT NULL DEFAULT false,
  due_date          DATE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_appointment_checklist_items_owner_check CHECK (
    owner IN ('adviser', 'client', 'shared')
  ),
  CONSTRAINT crm_appointment_checklist_items_visibility_check CHECK (
    visibility IN ('adviser', 'client', 'shared')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_appointment_checklist_items_unique_key
  ON crm_appointment_checklist_items (appointment_id, item_key);

CREATE INDEX IF NOT EXISTS idx_crm_appointment_checklist_items_appointment
  ON crm_appointment_checklist_items (appointment_id, sort_order);

DROP TRIGGER IF EXISTS crm_appointment_checklist_items_set_updated_at
  ON crm_appointment_checklist_items;

CREATE TRIGGER crm_appointment_checklist_items_set_updated_at
  BEFORE UPDATE ON crm_appointment_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: supporting tables — assignment-scoped
-- ---------------------------------------------------------------------------
ALTER TABLE crm_appointment_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_appointment_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_appointment_client_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_appointment_agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_appointment_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_appointment_participants_adviser_access
  ON crm_appointment_participants;

CREATE POLICY crm_appointment_participants_adviser_access
  ON crm_appointment_participants FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_appointment_state_events_adviser_access
  ON crm_appointment_state_events;

CREATE POLICY crm_appointment_state_events_adviser_access
  ON crm_appointment_state_events FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_appointment_client_topics_adviser_access
  ON crm_appointment_client_topics;

CREATE POLICY crm_appointment_client_topics_adviser_access
  ON crm_appointment_client_topics FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_appointment_agenda_items_adviser_access
  ON crm_appointment_agenda_items;

CREATE POLICY crm_appointment_agenda_items_adviser_access
  ON crm_appointment_agenda_items FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_appointment_checklist_items_adviser_access
  ON crm_appointment_checklist_items;

CREATE POLICY crm_appointment_checklist_items_adviser_access
  ON crm_appointment_checklist_items FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

COMMENT ON TABLE crm_appointment_state_events IS
  'Immutable CRM V2 appointment lifecycle and schedule events. No private notes or financial data.';
