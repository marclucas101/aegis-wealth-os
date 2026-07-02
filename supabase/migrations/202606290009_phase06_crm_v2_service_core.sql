-- Phase 06 — CRM V2 Service core authority
-- Additive only. Rerunnable policies/triggers. No destructive changes.

-- ---------------------------------------------------------------------------
-- Canonical service commitments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_commitments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  commitment_type       TEXT NOT NULL,
  owner                 TEXT NOT NULL,
  visibility            TEXT NOT NULL DEFAULT 'adviser_only',
  title                 TEXT NOT NULL,
  description           TEXT,
  lifecycle_status      TEXT NOT NULL DEFAULT 'open',
  due_at                TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  completion_note       TEXT,
  completion_evidence   TEXT,
  source_type           TEXT,
  source_id             UUID,
  appointment_id        UUID REFERENCES adviser_appointments(id) ON DELETE SET NULL,
  client_visible        BOOLEAN NOT NULL DEFAULT false,
  internal_note         TEXT,
  created_by_user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  completed_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  idempotency_key       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_commitments_type_check CHECK (
    commitment_type IN (
      'adviser_commitment',
      'client_commitment',
      'shared_commitment',
      'document_request',
      'appointment_follow_up_item'
    )
  ),
  CONSTRAINT service_commitments_owner_check CHECK (
    owner IN ('adviser', 'client', 'shared')
  ),
  CONSTRAINT service_commitments_visibility_check CHECK (
    visibility IN ('adviser_only', 'client_visible', 'shared')
  ),
  CONSTRAINT service_commitments_lifecycle_check CHECK (
    lifecycle_status IN (
      'open',
      'in_progress',
      'waiting_on_client',
      'waiting_on_adviser',
      'blocked',
      'completed',
      'cancelled'
    )
  ),
  CONSTRAINT service_commitments_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT service_commitments_description_len CHECK (
    description IS NULL OR char_length(description) <= 2000
  ),
  CONSTRAINT service_commitments_completion_note_len CHECK (
    completion_note IS NULL OR char_length(completion_note) <= 1000
  ),
  CONSTRAINT service_commitments_internal_note_len CHECK (
    internal_note IS NULL OR char_length(internal_note) <= 2000
  ),
  CONSTRAINT service_commitments_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_commitments_idempotency
  ON service_commitments (adviser_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_commitments_source_dedup
  ON service_commitments (source_type, source_id, commitment_type)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_commitments_adviser_open
  ON service_commitments (adviser_user_id, due_at)
  WHERE lifecycle_status NOT IN ('completed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_service_commitments_client_visible
  ON service_commitments (client_id, lifecycle_status, updated_at DESC)
  WHERE client_visible = true;

CREATE INDEX IF NOT EXISTS idx_service_commitments_appointment
  ON service_commitments (appointment_id)
  WHERE appointment_id IS NOT NULL;

DROP TRIGGER IF EXISTS service_commitments_set_updated_at ON service_commitments;
CREATE TRIGGER service_commitments_set_updated_at
  BEFORE UPDATE ON service_commitments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Client service requests (separate authority)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_service_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_category        TEXT NOT NULL,
  summary                 TEXT NOT NULL,
  details                 TEXT,
  lifecycle_status        TEXT NOT NULL DEFAULT 'submitted',
  urgency                 TEXT NOT NULL DEFAULT 'normal',
  acknowledged_at         TIMESTAMPTZ,
  acknowledged_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_summary      TEXT,
  resolved_at             TIMESTAMPTZ,
  resolved_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  client_visible_status   TEXT NOT NULL DEFAULT 'Submitted',
  version                 INTEGER NOT NULL DEFAULT 1,
  idempotency_key         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_service_requests_category_check CHECK (
    request_category IN (
      'general_enquiry',
      'document_help',
      'appointment_scheduling',
      'account_update',
      'plan_question',
      'other'
    )
  ),
  CONSTRAINT client_service_requests_lifecycle_check CHECK (
    lifecycle_status IN (
      'submitted',
      'acknowledged',
      'in_progress',
      'waiting_on_client',
      'resolved',
      'closed',
      'cancelled'
    )
  ),
  CONSTRAINT client_service_requests_urgency_check CHECK (
    urgency IN ('low', 'normal', 'high')
  ),
  CONSTRAINT client_service_requests_summary_len CHECK (char_length(summary) <= 200),
  CONSTRAINT client_service_requests_details_len CHECK (
    details IS NULL OR char_length(details) <= 2000
  ),
  CONSTRAINT client_service_requests_resolution_len CHECK (
    resolution_summary IS NULL OR char_length(resolution_summary) <= 1000
  ),
  CONSTRAINT client_service_requests_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_service_requests_idempotency
  ON client_service_requests (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_client_service_requests_adviser_open
  ON client_service_requests (adviser_user_id, lifecycle_status, created_at DESC)
  WHERE lifecycle_status NOT IN ('resolved', 'closed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_client_service_requests_client
  ON client_service_requests (client_id, created_at DESC);

DROP TRIGGER IF EXISTS client_service_requests_set_updated_at ON client_service_requests;
CREATE TRIGGER client_service_requests_set_updated_at
  BEFORE UPDATE ON client_service_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable service domain events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_commitment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id     UUID NOT NULL REFERENCES service_commitments(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type        TEXT NOT NULL,
  from_status       TEXT,
  to_status         TEXT,
  actor_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role        TEXT NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_code       TEXT,
  safe_metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_commitment_events_type_check CHECK (
    event_type IN (
      'created',
      'updated',
      'status_changed',
      'due_date_changed',
      'ownership_changed',
      'completed',
      'cancelled',
      'reopened'
    )
  ),
  CONSTRAINT service_commitment_events_actor_role_check CHECK (
    actor_role IN ('adviser', 'client', 'system')
  )
);

CREATE INDEX IF NOT EXISTS idx_service_commitment_events_commitment
  ON service_commitment_events (commitment_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS client_service_request_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES client_service_requests(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type        TEXT NOT NULL,
  from_status       TEXT,
  to_status         TEXT,
  actor_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_role        TEXT NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_code       TEXT,
  safe_metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_trace_id  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_service_request_events_type_check CHECK (
    event_type IN (
      'created',
      'acknowledged',
      'status_changed',
      'information_requested',
      'client_responded',
      'resolved',
      'closed',
      'cancelled'
    )
  ),
  CONSTRAINT client_service_request_events_actor_role_check CHECK (
    actor_role IN ('adviser', 'client', 'system')
  )
);

CREATE INDEX IF NOT EXISTS idx_client_service_request_events_request
  ON client_service_request_events (request_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE service_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_commitment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_service_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_commitments_adviser_access ON service_commitments;
CREATE POLICY service_commitments_adviser_access
  ON service_commitments FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS client_service_requests_adviser_access ON client_service_requests;
CREATE POLICY client_service_requests_adviser_access
  ON client_service_requests FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS service_commitment_events_adviser_access ON service_commitment_events;
CREATE POLICY service_commitment_events_adviser_access
  ON service_commitment_events FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS client_service_request_events_adviser_access ON client_service_request_events;
CREATE POLICY client_service_request_events_adviser_access
  ON client_service_request_events FOR ALL
  TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

COMMENT ON TABLE service_commitments IS
  'Canonical CRM V2 service commitments. Work queue and timeline are projections only.';
COMMENT ON TABLE client_service_requests IS
  'Client-initiated service requests. Original submission retained via event history.';
