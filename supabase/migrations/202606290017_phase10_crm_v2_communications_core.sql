-- Phase 10 — CRM V2 communications threads, records, templates, domain events
-- Additive only. Rerunnable policies/triggers. No destructive changes.
-- No Promotions Stage 6. No campaign automation. No external send automation.
-- Draft or log only — no automatic external send.

-- ---------------------------------------------------------------------------
-- Extend Phase 9E communication_preferences (consent extensions)
-- ---------------------------------------------------------------------------
ALTER TABLE communication_preferences
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT NOT NULL DEFAULT 'in_app',
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS festive_acknowledgement_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_message_visibility TEXT NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'communication_preferences_channel_check'
  ) THEN
    ALTER TABLE communication_preferences
      ADD CONSTRAINT communication_preferences_channel_check CHECK (
        preferred_channel IN (
          'in_app', 'email_draft', 'phone_call_log', 'internal_client_message'
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'communication_preferences_visibility_check'
  ) THEN
    ALTER TABLE communication_preferences
      ADD CONSTRAINT communication_preferences_visibility_check CHECK (
        client_message_visibility IN ('visible', 'archived_local')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'communication_preferences_version_check'
  ) THEN
    ALTER TABLE communication_preferences
      ADD CONSTRAINT communication_preferences_version_check CHECK (version >= 1);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Communication templates (governed reusable wording)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_communication_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key        TEXT NOT NULL,
  category            TEXT NOT NULL,
  audience            TEXT NOT NULL DEFAULT 'client',
  channel             TEXT NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  variable_schema     JSONB NOT NULL DEFAULT '[]'::jsonb,
  compliance_status   TEXT NOT NULL DEFAULT 'draft',
  version             INTEGER NOT NULL DEFAULT 1,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  active              BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_communication_templates_key_version_unique UNIQUE (template_key, version),
  CONSTRAINT crm_communication_templates_category_check CHECK (
    category IN (
      'appointment_preparation', 'appointment_follow_up', 'service_request_update',
      'document_request', 'protection_correction_request', 'annual_review',
      'relationship_moment_acknowledgement', 'advocacy_consent_acknowledgement',
      'general_client_service_update'
    )
  ),
  CONSTRAINT crm_communication_templates_audience_check CHECK (
    audience IN ('client', 'adviser', 'internal')
  ),
  CONSTRAINT crm_communication_templates_channel_check CHECK (
    channel IN (
      'internal_client_message', 'in_app_notification', 'email_draft',
      'phone_call_log', 'meeting_note_reference', 'whatsapp_draft',
      'sms_draft', 'external_message_log'
    )
  ),
  CONSTRAINT crm_communication_templates_compliance_check CHECK (
    compliance_status IN ('draft', 'pending_review', 'approved', 'restricted', 'inactive')
  ),
  CONSTRAINT crm_communication_templates_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT crm_communication_templates_body_len CHECK (char_length(body) <= 8000),
  CONSTRAINT crm_communication_templates_version_check CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_crm_communication_templates_active
  ON crm_communication_templates (category, active)
  WHERE active = true;

DROP TRIGGER IF EXISTS crm_communication_templates_set_updated_at ON crm_communication_templates;
CREATE TRIGGER crm_communication_templates_set_updated_at
  BEFORE UPDATE ON crm_communication_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Communication threads (relationship or source context grouping)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_communication_threads (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  thread_type             TEXT NOT NULL DEFAULT 'relationship',
  source_type             TEXT,
  source_id               UUID,
  subject                 TEXT NOT NULL,
  channel                 TEXT NOT NULL,
  visibility              TEXT NOT NULL DEFAULT 'adviser_only',
  status                  TEXT NOT NULL DEFAULT 'open',
  assigned_adviser_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_activity_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_communication_threads_type_check CHECK (
    thread_type IN ('relationship', 'source_linked', 'client_inbox')
  ),
  CONSTRAINT crm_communication_threads_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'relationship', 'appointment', 'service_commitment', 'client_service_request',
      'protection_policy', 'protection_correction_request', 'relationship_moment',
      'review_rhythm', 'advocacy_event', 'document_request'
    )
  ),
  CONSTRAINT crm_communication_threads_channel_check CHECK (
    channel IN (
      'internal_client_message', 'in_app_notification', 'email_draft',
      'phone_call_log', 'meeting_note_reference', 'whatsapp_draft',
      'sms_draft', 'external_message_log'
    )
  ),
  CONSTRAINT crm_communication_threads_visibility_check CHECK (
    visibility IN ('adviser_only', 'client_visible', 'both')
  ),
  CONSTRAINT crm_communication_threads_status_check CHECK (
    status IN ('open', 'closed', 'archived')
  ),
  CONSTRAINT crm_communication_threads_subject_len CHECK (char_length(subject) <= 200),
  CONSTRAINT crm_communication_threads_version_check CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_crm_communication_threads_adviser_activity
  ON crm_communication_threads (assigned_adviser_user_id, last_activity_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_crm_communication_threads_client
  ON crm_communication_threads (client_id, last_activity_at DESC);

DROP TRIGGER IF EXISTS crm_communication_threads_set_updated_at ON crm_communication_threads;
CREATE TRIGGER crm_communication_threads_set_updated_at
  BEFORE UPDATE ON crm_communication_threads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Communication records (drafts, logs, sent/received events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_communication_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  thread_id               UUID NOT NULL REFERENCES crm_communication_threads(id) ON DELETE CASCADE,
  source_type             TEXT,
  source_id               UUID,
  channel                 TEXT NOT NULL,
  direction               TEXT NOT NULL DEFAULT 'outbound',
  lifecycle_status        TEXT NOT NULL DEFAULT 'draft',
  safe_subject            TEXT NOT NULL,
  safe_body               TEXT,
  template_id             UUID REFERENCES crm_communication_templates(id) ON DELETE SET NULL,
  template_version        INTEGER,
  created_by_user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  delivery_state          TEXT,
  client_visibility       TEXT NOT NULL DEFAULT 'adviser_only',
  consent_basis           TEXT NOT NULL DEFAULT 'operational',
  follow_up_status        TEXT NOT NULL DEFAULT 'none',
  next_follow_up_date     DATE,
  governed_content_id     UUID REFERENCES governed_content(id) ON DELETE SET NULL,
  idempotency_key         TEXT,
  active                  BOOLEAN NOT NULL DEFAULT true,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_communication_records_source_type_check CHECK (
    source_type IS NULL OR source_type IN (
      'relationship', 'appointment', 'service_commitment', 'client_service_request',
      'protection_policy', 'protection_correction_request', 'relationship_moment',
      'review_rhythm', 'advocacy_event', 'document_request'
    )
  ),
  CONSTRAINT crm_communication_records_channel_check CHECK (
    channel IN (
      'internal_client_message', 'in_app_notification', 'email_draft',
      'phone_call_log', 'meeting_note_reference', 'whatsapp_draft',
      'sms_draft', 'external_message_log'
    )
  ),
  CONSTRAINT crm_communication_records_direction_check CHECK (
    direction IN ('outbound', 'inbound', 'internal')
  ),
  CONSTRAINT crm_communication_records_lifecycle_check CHECK (
    lifecycle_status IN (
      'draft', 'pending_review', 'approved', 'sent', 'logged',
      'received', 'failed', 'cancelled', 'archived'
    )
  ),
  CONSTRAINT crm_communication_records_visibility_check CHECK (
    client_visibility IN ('adviser_only', 'client_visible', 'both')
  ),
  CONSTRAINT crm_communication_records_consent_check CHECK (
    consent_basis IN (
      'operational', 'client_request', 'appointment', 'service',
      'explicit_consent', 'preference_conflict'
    )
  ),
  CONSTRAINT crm_communication_records_follow_up_check CHECK (
    follow_up_status IN ('none', 'pending', 'completed', 'overdue')
  ),
  CONSTRAINT crm_communication_records_delivery_check CHECK (
    delivery_state IS NULL OR delivery_state IN (
      'not_applicable', 'pending', 'delivered', 'failed', 'logged_only'
    )
  ),
  CONSTRAINT crm_communication_records_subject_len CHECK (char_length(safe_subject) <= 200),
  CONSTRAINT crm_communication_records_body_len CHECK (
    safe_body IS NULL OR char_length(safe_body) <= 8000
  ),
  CONSTRAINT crm_communication_records_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_communication_records_idempotency
  ON crm_communication_records (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND active = true;

CREATE INDEX IF NOT EXISTS idx_crm_communication_records_adviser_status
  ON crm_communication_records (created_by_user_id, lifecycle_status, updated_at DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_crm_communication_records_client_visible
  ON crm_communication_records (client_id, client_visibility, updated_at DESC)
  WHERE active = true AND client_visibility IN ('client_visible', 'both');

CREATE INDEX IF NOT EXISTS idx_crm_communication_records_follow_up
  ON crm_communication_records (created_by_user_id, next_follow_up_date)
  WHERE active = true AND follow_up_status IN ('pending', 'overdue');

CREATE INDEX IF NOT EXISTS idx_crm_communication_records_thread
  ON crm_communication_records (thread_id, created_at DESC);

DROP TRIGGER IF EXISTS crm_communication_records_set_updated_at ON crm_communication_records;
CREATE TRIGGER crm_communication_records_set_updated_at
  BEFORE UPDATE ON crm_communication_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable communication domain events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_communication_domain_events (
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
  CONSTRAINT crm_communication_domain_events_entity_check CHECK (
    entity_type IN ('communication_thread', 'communication_record', 'communication_template', 'communication_preference')
  ),
  CONSTRAINT crm_communication_domain_events_actor_check CHECK (
    actor_role IN ('adviser', 'client', 'system')
  ),
  CONSTRAINT crm_communication_domain_events_type_check CHECK (
    event_type IN (
      'draft_created', 'template_rendered', 'draft_updated', 'review_requested',
      'approved', 'sent_or_logged', 'failed', 'archived', 'client_replied',
      'preference_conflict_recorded', 'follow_up_scheduled', 'follow_up_completed',
      'cancelled', 'received'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_communication_domain_events_client
  ON crm_communication_domain_events (client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_communication_domain_events_entity
  ON crm_communication_domain_events (entity_type, entity_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Seed governed templates (inactive until operator approves)
-- ---------------------------------------------------------------------------
INSERT INTO crm_communication_templates (
  template_key, category, audience, channel, title, body, variable_schema,
  compliance_status, active
)
VALUES
  (
    'appointment_preparation_v1', 'appointment_preparation', 'client', 'email_draft',
    'Appointment preparation',
    'Dear {{client_name}},\n\nThis is a reminder to prepare for your upcoming appointment on {{appointment_date}}.\n\nKind regards,\n{{adviser_name}}',
    '["client_name", "appointment_date", "adviser_name"]'::jsonb,
    'approved', true
  ),
  (
    'service_request_update_v1', 'service_request_update', 'client', 'internal_client_message',
    'Service request update',
    'Dear {{client_name}},\n\nYour service request {{request_reference}} has been updated.\n\n{{update_summary}}\n\nKind regards,\n{{adviser_name}}',
    '["client_name", "request_reference", "update_summary", "adviser_name"]'::jsonb,
    'approved', true
  ),
  (
    'general_service_update_v1', 'general_client_service_update', 'client', 'internal_client_message',
    'Client service update',
    'Dear {{client_name}},\n\n{{update_summary}}\n\nKind regards,\n{{adviser_name}}',
    '["client_name", "update_summary", "adviser_name"]'::jsonb,
    'approved', true
  )
ON CONFLICT (template_key, version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS — assignment-scoped; work queue and timeline are projections only
-- ---------------------------------------------------------------------------
ALTER TABLE crm_communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communication_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_communication_domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_communication_threads_assignment ON crm_communication_threads;
CREATE POLICY crm_communication_threads_assignment ON crm_communication_threads
  FOR ALL TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_communication_records_assignment ON crm_communication_records;
CREATE POLICY crm_communication_records_assignment ON crm_communication_records
  FOR ALL TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS crm_communication_records_client_visible ON crm_communication_records;
CREATE POLICY crm_communication_records_client_visible ON crm_communication_records
  FOR SELECT TO authenticated
  USING (
    client_visibility IN ('client_visible', 'both')
    AND lifecycle_status IN ('sent', 'logged', 'received')
    AND client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

DROP POLICY IF EXISTS crm_communication_templates_read ON crm_communication_templates;
CREATE POLICY crm_communication_templates_read ON crm_communication_templates
  FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('advisor', 'admin')
  ));

DROP POLICY IF EXISTS crm_communication_domain_events_assignment ON crm_communication_domain_events;
CREATE POLICY crm_communication_domain_events_assignment ON crm_communication_domain_events
  FOR SELECT TO authenticated
  USING (is_assigned_advisor(client_id) OR is_admin());
