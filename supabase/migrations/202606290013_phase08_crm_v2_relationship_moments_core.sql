-- Phase 08 — CRM V2 relationship moments, review rhythm, and client profile extensions
-- Additive only. Rerunnable policies/triggers. No destructive changes.

-- ---------------------------------------------------------------------------
-- Client ethnicity (optional — festive suggestions only)
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ethnicity TEXT;

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_ethnicity_check;

ALTER TABLE clients
  ADD CONSTRAINT clients_ethnicity_check CHECK (
    ethnicity IS NULL OR ethnicity IN (
      'chinese', 'malay', 'indian', 'eurasian', 'mixed', 'other', 'prefer_not_to_say'
    )
  );

-- ---------------------------------------------------------------------------
-- Festive holiday mappings (read-only reference config)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS festive_holiday_mappings (
  holiday_key         TEXT PRIMARY KEY,
  display_name        TEXT NOT NULL,
  ethnicity_keys      TEXT[] NOT NULL DEFAULT '{}',
  typical_month       INTEGER,
  typical_day         INTEGER,
  lunar_calendar      BOOLEAN NOT NULL DEFAULT false,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT festive_holiday_mappings_month_check CHECK (
    typical_month IS NULL OR (typical_month >= 1 AND typical_month <= 12)
  ),
  CONSTRAINT festive_holiday_mappings_day_check CHECK (
    typical_day IS NULL OR (typical_day >= 1 AND typical_day <= 31)
  ),
  CONSTRAINT festive_holiday_mappings_name_len CHECK (char_length(display_name) <= 120)
);

INSERT INTO festive_holiday_mappings (holiday_key, display_name, ethnicity_keys, typical_month, typical_day, lunar_calendar)
VALUES
  ('cny', 'Chinese New Year', ARRAY['chinese'], 1, 1, true),
  ('hari_raya', 'Hari Raya Aidilfitri', ARRAY['malay'], NULL, NULL, true),
  ('deepavali', 'Deepavali', ARRAY['indian'], NULL, NULL, true),
  ('christmas', 'Christmas', ARRAY['eurasian', 'mixed', 'other'], 12, 25, false)
ON CONFLICT (holiday_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Relationship moments (canonical authority)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relationship_moments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  moment_type             TEXT NOT NULL,
  title                   TEXT NOT NULL,
  moment_date             DATE,
  recurrence_rule         TEXT,
  timezone                TEXT NOT NULL DEFAULT 'Asia/Singapore',
  visibility              TEXT NOT NULL DEFAULT 'adviser_only',
  source_type             TEXT NOT NULL DEFAULT 'manual',
  source_id               UUID,
  sensitivity_class       TEXT NOT NULL DEFAULT 'standard',
  confirmation_state      TEXT NOT NULL DEFAULT 'confirmed',
  reminder_preference     TEXT NOT NULL DEFAULT 'in_app',
  last_acknowledged_at    TIMESTAMPTZ,
  next_occurrence_date    DATE,
  holiday_key             TEXT REFERENCES festive_holiday_mappings(holiday_key) ON DELETE SET NULL,
  linked_appointment_id   UUID REFERENCES adviser_appointments(id) ON DELETE SET NULL,
  linked_commitment_id    UUID REFERENCES service_commitments(id) ON DELETE SET NULL,
  active                  BOOLEAN NOT NULL DEFAULT true,
  deactivated_at          TIMESTAMPTZ,
  idempotency_key         TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT relationship_moments_type_check CHECK (
    moment_type IN (
      'birthday', 'wedding_anniversary', 'child_birthday', 'policy_anniversary',
      'review_anniversary', 'festive_greeting', 'client_preference',
      'life_event_follow_up', 'custom_adviser_reminder'
    )
  ),
  CONSTRAINT relationship_moments_visibility_check CHECK (
    visibility IN ('adviser_only', 'client_visible', 'both')
  ),
  CONSTRAINT relationship_moments_source_type_check CHECK (
    source_type IN (
      'manual', 'client_profile_dob', 'client_preference', 'festive_suggestion',
      'review_rhythm', 'policy', 'appointment', 'service_commitment'
    )
  ),
  CONSTRAINT relationship_moments_sensitivity_check CHECK (
    sensitivity_class IN ('standard', 'cultural_preference', 'life_event')
  ),
  CONSTRAINT relationship_moments_confirmation_check CHECK (
    confirmation_state IN ('confirmed', 'suggested', 'rejected', 'pending_client')
  ),
  CONSTRAINT relationship_moments_reminder_check CHECK (
    reminder_preference IN ('none', 'in_app', 'adviser_only')
  ),
  CONSTRAINT relationship_moments_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT relationship_moments_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_moments_idempotency
  ON relationship_moments (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND active = true;

CREATE INDEX IF NOT EXISTS idx_relationship_moments_adviser_date
  ON relationship_moments (adviser_user_id, next_occurrence_date)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_relationship_moments_client_active
  ON relationship_moments (client_id, active, next_occurrence_date DESC)
  WHERE active = true;

DROP TRIGGER IF EXISTS relationship_moments_set_updated_at ON relationship_moments;
CREATE TRIGGER relationship_moments_set_updated_at
  BEFORE UPDATE ON relationship_moments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Adviser moment overrides (festive include/exclude)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS adviser_moment_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  holiday_key       TEXT NOT NULL REFERENCES festive_holiday_mappings(holiday_key) ON DELETE CASCADE,
  override_action   TEXT NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adviser_moment_overrides_action_check CHECK (
    override_action IN ('include', 'exclude')
  ),
  CONSTRAINT adviser_moment_overrides_version_check CHECK (version >= 1),
  CONSTRAINT adviser_moment_overrides_unique UNIQUE (adviser_user_id, client_id, holiday_key)
);

DROP TRIGGER IF EXISTS adviser_moment_overrides_set_updated_at ON adviser_moment_overrides;
CREATE TRIGGER adviser_moment_overrides_set_updated_at
  BEFORE UPDATE ON adviser_moment_overrides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Review rhythm (CRM V2 projection — extends clients.next_review_due authority)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_review_rhythm (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  review_type             TEXT NOT NULL,
  cadence                 TEXT NOT NULL,
  next_due_date           DATE,
  last_completed_date     DATE,
  assigned_adviser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_type             TEXT NOT NULL DEFAULT 'client_record',
  source_id               UUID,
  status                  TEXT NOT NULL DEFAULT 'scheduled',
  client_visibility       BOOLEAN NOT NULL DEFAULT false,
  linked_appointment_id   UUID REFERENCES adviser_appointments(id) ON DELETE SET NULL,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_review_rhythm_type_check CHECK (
    review_type IN (
      'annual_review', 'semi_annual_review', 'quarterly_review', 'ad_hoc_review',
      'protection_review', 'service_review', 'planning_review'
    )
  ),
  CONSTRAINT crm_review_rhythm_cadence_check CHECK (
    cadence IN ('annual', 'semi_annual', 'quarterly', 'ad_hoc')
  ),
  CONSTRAINT crm_review_rhythm_status_check CHECK (
    status IN ('scheduled', 'overdue', 'completed', 'paused')
  ),
  CONSTRAINT crm_review_rhythm_source_check CHECK (
    source_type IN ('client_record', 'manual', 'moment', 'service_request')
  ),
  CONSTRAINT crm_review_rhythm_version_check CHECK (version >= 1),
  CONSTRAINT crm_review_rhythm_unique_type UNIQUE (client_id, review_type)
);

CREATE INDEX IF NOT EXISTS idx_crm_review_rhythm_adviser_due
  ON crm_review_rhythm (assigned_adviser_user_id, next_due_date)
  WHERE status IN ('scheduled', 'overdue');

CREATE INDEX IF NOT EXISTS idx_crm_review_rhythm_client
  ON crm_review_rhythm (client_id, review_type);

DROP TRIGGER IF EXISTS crm_review_rhythm_set_updated_at ON crm_review_rhythm;
CREATE TRIGGER crm_review_rhythm_set_updated_at
  BEFORE UPDATE ON crm_review_rhythm
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Client preference updates (pending adviser review)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_client_preference_updates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  preference_type   TEXT NOT NULL,
  proposed_value    JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_value    JSONB,
  status            TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  idempotency_key   TEXT,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_client_preference_updates_type_check CHECK (
    preference_type IN (
      'important_date', 'birthday_acknowledgement_opt_out', 'festive_acknowledgement_opt_out',
      'greeting_preference', 'communication_preference', 'ethnicity_correction', 'review_request'
    )
  ),
  CONSTRAINT crm_client_preference_updates_status_check CHECK (
    status IN ('pending_review', 'approved', 'rejected')
  ),
  CONSTRAINT crm_client_preference_updates_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_client_preference_updates_idempotency
  ON crm_client_preference_updates (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_crm_client_preference_updates_pending
  ON crm_client_preference_updates (adviser_user_id, status, created_at DESC)
  WHERE status = 'pending_review';

DROP TRIGGER IF EXISTS crm_client_preference_updates_set_updated_at ON crm_client_preference_updates;
CREATE TRIGGER crm_client_preference_updates_set_updated_at
  BEFORE UPDATE ON crm_client_preference_updates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Extend Phase 06 service request categories for preference/review
ALTER TABLE client_service_requests
  DROP CONSTRAINT IF EXISTS client_service_requests_category_check;

ALTER TABLE client_service_requests
  ADD CONSTRAINT client_service_requests_category_check CHECK (
    request_category IN (
      'general_enquiry',
      'document_help',
      'appointment_scheduling',
      'account_update',
      'plan_question',
      'protection_correction',
      'protection_review',
      'preference_update',
      'review_request',
      'other'
    )
  );

-- ---------------------------------------------------------------------------
-- Immutable relationship moment domain events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relationship_moment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type        TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID NOT NULL,
  actor_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role        TEXT NOT NULL,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  safe_metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id        TEXT,
  CONSTRAINT relationship_moment_events_entity_check CHECK (
    entity_type IN ('moment', 'review_rhythm', 'preference_update', 'override')
  ),
  CONSTRAINT relationship_moment_events_actor_check CHECK (
    actor_role IN ('adviser', 'client', 'system')
  ),
  CONSTRAINT relationship_moment_events_type_check CHECK (
    event_type IN (
      'moment_created', 'moment_updated', 'moment_deactivated', 'moment_acknowledged',
      'suggestion_confirmed', 'suggestion_rejected', 'review_rhythm_updated',
      'client_preference_submitted', 'client_preference_approved', 'review_requested'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_relationship_moment_events_client
  ON relationship_moment_events (client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationship_moment_events_entity
  ON relationship_moment_events (entity_type, entity_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — assignment-scoped; work queue and timeline are projections only
-- ---------------------------------------------------------------------------
ALTER TABLE relationship_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adviser_moment_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_review_rhythm ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_client_preference_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_moment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS relationship_moments_assignment ON relationship_moments;
CREATE POLICY relationship_moments_assignment ON relationship_moments
  FOR ALL
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS adviser_moment_overrides_assignment ON adviser_moment_overrides;
CREATE POLICY adviser_moment_overrides_assignment ON adviser_moment_overrides
  FOR ALL
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_review_rhythm_assignment ON crm_review_rhythm;
CREATE POLICY crm_review_rhythm_assignment ON crm_review_rhythm
  FOR ALL
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_client_preference_updates_assignment ON crm_client_preference_updates;
CREATE POLICY crm_client_preference_updates_assignment ON crm_client_preference_updates
  FOR ALL
  USING (
    is_assigned_advisor(client_id)
    OR is_admin()
    OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  )
  WITH CHECK (
    is_assigned_advisor(client_id)
    OR is_admin()
    OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS relationship_moment_events_assignment ON relationship_moment_events;
CREATE POLICY relationship_moment_events_assignment ON relationship_moment_events
  FOR SELECT
  USING (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS relationship_moment_events_insert ON relationship_moment_events;
CREATE POLICY relationship_moment_events_insert ON relationship_moment_events
  FOR INSERT
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin() OR actor_user_id = auth.uid());

-- festive_holiday_mappings is read-only reference — no RLS writes for advisers
ALTER TABLE festive_holiday_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS festive_holiday_mappings_read ON festive_holiday_mappings;
CREATE POLICY festive_holiday_mappings_read ON festive_holiday_mappings
  FOR SELECT
  USING (true);
