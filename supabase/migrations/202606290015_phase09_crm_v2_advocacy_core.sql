-- Phase 09 — CRM V2 advocacy events, consent preferences, score config, domain events
-- Additive only. Rerunnable policies/triggers. No destructive changes.
-- No Promotions Stage 6. No sales-opportunity or ranking priority schema.

-- ---------------------------------------------------------------------------
-- Advocacy score config (operator-configurable weights — read-only for advisers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advocacy_score_config (
  config_key        TEXT PRIMARY KEY,
  event_type        TEXT NOT NULL,
  points            INTEGER NOT NULL DEFAULT 0,
  category_cap      INTEGER,
  max_yearly_score  INTEGER,
  active            BOOLEAN NOT NULL DEFAULT true,
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT advocacy_score_config_points_check CHECK (points >= 0),
  CONSTRAINT advocacy_score_config_cap_check CHECK (category_cap IS NULL OR category_cap >= 0),
  CONSTRAINT advocacy_score_config_max_check CHECK (max_yearly_score IS NULL OR max_yearly_score >= 0),
  CONSTRAINT advocacy_score_config_version_check CHECK (version >= 1)
);

INSERT INTO advocacy_score_config (config_key, event_type, points, category_cap, max_yearly_score)
VALUES
  ('intro_made', 'introduction_made', 2, 10, 50),
  ('referral_received', 'referral_received', 3, 15, 50),
  ('testimonial_consented', 'testimonial_consented', 2, 6, 50),
  ('review_completed', 'review_completed', 1, 5, 50),
  ('thank_you_sent', 'thank_you_sent', 1, 10, 50)
ON CONFLICT (config_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Client advocacy preferences (consent and do-not-ask)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_client_advocacy_preferences (
  client_id                   UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  testimonial_consent         TEXT NOT NULL DEFAULT 'unknown',
  referral_ask_opt_out        BOOLEAN NOT NULL DEFAULT false,
  permission_to_mention       BOOLEAN NOT NULL DEFAULT false,
  do_not_ask                  BOOLEAN NOT NULL DEFAULT false,
  version                     INTEGER NOT NULL DEFAULT 1,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_client_advocacy_preferences_consent_check CHECK (
    testimonial_consent IN (
      'not_required', 'pending', 'granted', 'limited', 'withdrawn', 'declined', 'unknown'
    )
  ),
  CONSTRAINT crm_client_advocacy_preferences_version_check CHECK (version >= 1)
);

DROP TRIGGER IF EXISTS crm_client_advocacy_preferences_set_updated_at ON crm_client_advocacy_preferences;
CREATE TRIGGER crm_client_advocacy_preferences_set_updated_at
  BEFORE UPDATE ON crm_client_advocacy_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Advocacy events (canonical authority)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advocacy_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_type                  TEXT NOT NULL,
  event_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type                 TEXT NOT NULL DEFAULT 'manual',
  source_id                   UUID,
  initiated_by                TEXT NOT NULL DEFAULT 'adviser',
  recorded_by                 UUID REFERENCES users(id) ON DELETE SET NULL,
  consent_state               TEXT NOT NULL DEFAULT 'unknown',
  visibility                  TEXT NOT NULL DEFAULT 'adviser_only',
  safe_title                  TEXT NOT NULL,
  notes                       TEXT,
  referred_person_label       TEXT,
  has_contact_details         BOOLEAN NOT NULL DEFAULT false,
  follow_up_status            TEXT NOT NULL DEFAULT 'none',
  next_follow_up_date         DATE,
  linked_appointment_id       UUID REFERENCES adviser_appointments(id) ON DELETE SET NULL,
  linked_service_request_id   UUID REFERENCES client_service_requests(id) ON DELETE SET NULL,
  linked_relationship_moment_id UUID REFERENCES relationship_moments(id) ON DELETE SET NULL,
  points                      INTEGER NOT NULL DEFAULT 0,
  score_eligible              BOOLEAN NOT NULL DEFAULT true,
  active                      BOOLEAN NOT NULL DEFAULT true,
  deactivated_at              TIMESTAMPTZ,
  idempotency_key             TEXT,
  version                     INTEGER NOT NULL DEFAULT 1,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT advocacy_events_type_check CHECK (
    event_type IN (
      'introduction_offered', 'introduction_made', 'referral_received', 'referral_contacted',
      'referral_declined', 'testimonial_offered', 'testimonial_consented', 'testimonial_withdrawn',
      'review_requested', 'review_completed', 'client_feedback_received',
      'permission_to_mention_granted', 'permission_withdrawn', 'thank_you_sent', 'do_not_ask_recorded'
    )
  ),
  CONSTRAINT advocacy_events_source_type_check CHECK (
    source_type IN (
      'manual', 'adviser_feedback', 'service_request', 'appointment', 'relationship_moment', 'client_preference'
    )
  ),
  CONSTRAINT advocacy_events_initiated_by_check CHECK (
    initiated_by IN ('adviser', 'client', 'system')
  ),
  CONSTRAINT advocacy_events_consent_check CHECK (
    consent_state IN (
      'not_required', 'pending', 'granted', 'limited', 'withdrawn', 'declined', 'unknown'
    )
  ),
  CONSTRAINT advocacy_events_visibility_check CHECK (
    visibility IN ('adviser_only', 'client_visible', 'both')
  ),
  CONSTRAINT advocacy_events_follow_up_check CHECK (
    follow_up_status IN ('none', 'pending', 'completed', 'declined', 'overdue')
  ),
  CONSTRAINT advocacy_events_title_len CHECK (char_length(safe_title) <= 200),
  CONSTRAINT advocacy_events_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT advocacy_events_referred_label_len CHECK (
    referred_person_label IS NULL OR char_length(referred_person_label) <= 120
  ),
  CONSTRAINT advocacy_events_points_check CHECK (points >= 0),
  CONSTRAINT advocacy_events_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_advocacy_events_idempotency
  ON advocacy_events (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND active = true;

CREATE INDEX IF NOT EXISTS idx_advocacy_events_adviser_date
  ON advocacy_events (adviser_user_id, event_date DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_advocacy_events_client_active
  ON advocacy_events (client_id, active, event_date DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_advocacy_events_follow_up
  ON advocacy_events (adviser_user_id, next_follow_up_date)
  WHERE active = true AND follow_up_status IN ('pending', 'overdue');

DROP TRIGGER IF EXISTS advocacy_events_set_updated_at ON advocacy_events;
CREATE TRIGGER advocacy_events_set_updated_at
  BEFORE UPDATE ON advocacy_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable advocacy domain events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advocacy_domain_events (
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
  CONSTRAINT advocacy_domain_events_entity_check CHECK (
    entity_type IN ('advocacy_event', 'advocacy_preference')
  ),
  CONSTRAINT advocacy_domain_events_actor_check CHECK (
    actor_role IN ('adviser', 'client', 'system')
  ),
  CONSTRAINT advocacy_domain_events_type_check CHECK (
    event_type IN (
      'advocacy_event_created', 'advocacy_event_updated', 'consent_granted', 'consent_limited',
      'consent_withdrawn', 'referral_outcome_updated', 'testimonial_permission_updated',
      'thank_you_recorded', 'advocacy_event_deactivated', 'do_not_ask_recorded'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_advocacy_domain_events_client
  ON advocacy_domain_events (client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_advocacy_domain_events_entity
  ON advocacy_domain_events (entity_type, entity_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — assignment-scoped; work queue and timeline are projections only
-- ---------------------------------------------------------------------------
ALTER TABLE advocacy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE advocacy_score_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_client_advocacy_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE advocacy_domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advocacy_events_assignment ON advocacy_events;
CREATE POLICY advocacy_events_assignment ON advocacy_events
  FOR ALL TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS advocacy_score_config_read ON advocacy_score_config;
CREATE POLICY advocacy_score_config_read ON advocacy_score_config
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS crm_client_advocacy_preferences_assignment ON crm_client_advocacy_preferences;
CREATE POLICY crm_client_advocacy_preferences_assignment ON crm_client_advocacy_preferences
  FOR ALL TO authenticated
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

DROP POLICY IF EXISTS advocacy_domain_events_assignment ON advocacy_domain_events;
CREATE POLICY advocacy_domain_events_assignment ON advocacy_domain_events
  FOR SELECT TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS advocacy_domain_events_insert ON advocacy_domain_events;
CREATE POLICY advocacy_domain_events_insert ON advocacy_domain_events
  FOR INSERT TO authenticated
  WITH CHECK (
    is_assigned_advisor(client_id)
    OR is_admin()
    OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
  );
