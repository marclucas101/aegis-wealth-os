-- Phase 07 — CRM V2 structured protection portfolio core authority
-- Additive only. Rerunnable policies/triggers. No destructive changes.

-- Extend Phase 06 service request categories for protection correction/review
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
      'other'
    )
  );

-- ---------------------------------------------------------------------------
-- Protection policy identity (stable logical policy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protection_policies (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  insurer                     TEXT NOT NULL,
  display_name                TEXT NOT NULL,
  policy_category             TEXT NOT NULL,
  policy_owner                TEXT NOT NULL,
  life_assured                TEXT NOT NULL,
  policy_status               TEXT NOT NULL DEFAULT 'unknown',
  policy_ref_masked           TEXT,
  policy_start_date           DATE,
  maturity_or_expiry_date     DATE,
  source_document_id          UUID REFERENCES documents(id) ON DELETE SET NULL,
  current_confirmed_version_id UUID,
  archived_at                 TIMESTAMPTZ,
  version                     INTEGER NOT NULL DEFAULT 1,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT protection_policies_category_check CHECK (
    policy_category IN (
      'term_life', 'whole_life', 'endowment', 'investment_linked',
      'health', 'accident', 'long_term_care', 'disability_income', 'other'
    )
  ),
  CONSTRAINT protection_policies_status_check CHECK (
    policy_status IN ('in_force', 'lapsed', 'surrendered', 'matured', 'pending', 'unknown')
  ),
  CONSTRAINT protection_policies_display_name_len CHECK (char_length(display_name) <= 200),
  CONSTRAINT protection_policies_insurer_len CHECK (char_length(insurer) <= 120),
  CONSTRAINT protection_policies_owner_len CHECK (char_length(policy_owner) <= 120),
  CONSTRAINT protection_policies_life_assured_len CHECK (char_length(life_assured) <= 120),
  CONSTRAINT protection_policies_ref_masked_len CHECK (
    policy_ref_masked IS NULL OR char_length(policy_ref_masked) <= 32
  ),
  CONSTRAINT protection_policies_version_check CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_protection_policies_client
  ON protection_policies (client_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_protection_policies_adviser
  ON protection_policies (adviser_user_id, updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_protection_policies_source_document
  ON protection_policies (source_document_id)
  WHERE source_document_id IS NOT NULL;

DROP TRIGGER IF EXISTS protection_policies_set_updated_at ON protection_policies;
CREATE TRIGGER protection_policies_set_updated_at
  BEFORE UPDATE ON protection_policies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Protection policy versions (confirmed and historical)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protection_policy_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id             UUID NOT NULL REFERENCES protection_policies(id) ON DELETE CASCADE,
  version_number        INTEGER NOT NULL,
  verification_state    TEXT NOT NULL DEFAULT 'provisional',
  effective_date        DATE,
  sum_assured           NUMERIC(18, 2),
  sum_assured_currency  TEXT NOT NULL DEFAULT 'SGD',
  premium               NUMERIC(18, 2),
  premium_frequency     TEXT,
  policy_term           TEXT,
  premium_term          TEXT,
  coverage_components   JSONB NOT NULL DEFAULT '[]'::jsonb,
  riders                JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_extraction_id  UUID,
  adviser_reviewer_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at          TIMESTAMPTZ,
  correction_reason     TEXT,
  superseded_at         TIMESTAMPTZ,
  structured_snapshot   JSONB NOT NULL DEFAULT '{}'::jsonb,
  version_hash          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT protection_policy_versions_state_check CHECK (
    verification_state IN (
      'provisional', 'awaiting_review', 'confirmed', 'corrected',
      'rejected', 'superseded', 'archived'
    )
  ),
  CONSTRAINT protection_policy_versions_number_check CHECK (version_number >= 1),
  CONSTRAINT protection_policy_versions_premium_freq_check CHECK (
    premium_frequency IS NULL OR premium_frequency IN (
      'monthly', 'quarterly', 'semi_annual', 'annual', 'single', 'unknown'
    )
  ),
  CONSTRAINT protection_policy_versions_correction_len CHECK (
    correction_reason IS NULL OR char_length(correction_reason) <= 500
  ),
  CONSTRAINT protection_policy_versions_unique_number UNIQUE (policy_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_protection_policy_versions_policy
  ON protection_policy_versions (policy_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_protection_policy_versions_confirmed
  ON protection_policy_versions (policy_id, confirmed_at DESC)
  WHERE verification_state IN ('confirmed', 'corrected');

ALTER TABLE protection_policies
  DROP CONSTRAINT IF EXISTS protection_policies_current_version_fk;

ALTER TABLE protection_policies
  ADD CONSTRAINT protection_policies_current_version_fk
  FOREIGN KEY (current_confirmed_version_id)
  REFERENCES protection_policy_versions(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS protection_policy_versions_set_updated_at ON protection_policy_versions;
CREATE TRIGGER protection_policy_versions_set_updated_at
  BEFORE UPDATE ON protection_policy_versions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Extraction review (provisional machine/report extracted data)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protection_extractions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  adviser_user_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_document_id      UUID REFERENCES documents(id) ON DELETE SET NULL,
  source_report_policy_key TEXT,
  extraction_method       TEXT NOT NULL,
  extraction_status       TEXT NOT NULL DEFAULT 'completed',
  extracted_fields        JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_warnings     JSONB NOT NULL DEFAULT '[]'::jsonb,
  adviser_review_status   TEXT NOT NULL DEFAULT 'provisional',
  reviewed_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  resulting_policy_id     UUID REFERENCES protection_policies(id) ON DELETE SET NULL,
  resulting_version_id    UUID REFERENCES protection_policy_versions(id) ON DELETE SET NULL,
  idempotency_key         TEXT,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT protection_extractions_method_check CHECK (
    extraction_method IN ('protection_report', 'document_vault', 'manual')
  ),
  CONSTRAINT protection_extractions_status_check CHECK (
    extraction_status IN ('pending', 'completed', 'failed')
  ),
  CONSTRAINT protection_extractions_review_check CHECK (
    adviser_review_status IN (
      'provisional', 'awaiting_review', 'confirmed', 'corrected',
      'rejected', 'superseded', 'archived'
    )
  ),
  CONSTRAINT protection_extractions_rejection_len CHECK (
    rejection_reason IS NULL OR char_length(rejection_reason) <= 500
  ),
  CONSTRAINT protection_extractions_version_check CHECK (version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_protection_extractions_idempotency
  ON protection_extractions (client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_protection_extractions_client_review
  ON protection_extractions (client_id, adviser_review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_protection_extractions_adviser_review
  ON protection_extractions (adviser_user_id, adviser_review_status, created_at DESC)
  WHERE adviser_review_status IN ('provisional', 'awaiting_review');

ALTER TABLE protection_policy_versions
  DROP CONSTRAINT IF EXISTS protection_policy_versions_extraction_fk;

ALTER TABLE protection_policy_versions
  ADD CONSTRAINT protection_policy_versions_extraction_fk
  FOREIGN KEY (source_extraction_id)
  REFERENCES protection_extractions(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS protection_extractions_set_updated_at ON protection_extractions;
CREATE TRIGGER protection_extractions_set_updated_at
  BEFORE UPDATE ON protection_extractions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Immutable protection domain events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS protection_domain_events (
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
  CONSTRAINT protection_domain_events_entity_type_check CHECK (
    entity_type IN ('policy', 'version', 'extraction')
  ),
  CONSTRAINT protection_domain_events_actor_role_check CHECK (
    actor_role IN ('adviser', 'client', 'system')
  )
);

CREATE INDEX IF NOT EXISTS idx_protection_domain_events_client
  ON protection_domain_events (client_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_protection_domain_events_entity
  ON protection_domain_events (entity_type, entity_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — assignment-scoped; work queue and timeline are projections only
-- ---------------------------------------------------------------------------
ALTER TABLE protection_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE protection_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE protection_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE protection_domain_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS protection_policies_assignment ON protection_policies;
CREATE POLICY protection_policies_assignment ON protection_policies
  FOR ALL
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS protection_policy_versions_assignment ON protection_policy_versions;
CREATE POLICY protection_policy_versions_assignment ON protection_policy_versions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM protection_policies p
      WHERE p.id = protection_policy_versions.policy_id
        AND (is_assigned_advisor(p.client_id) OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM protection_policies p
      WHERE p.id = protection_policy_versions.policy_id
        AND (is_assigned_advisor(p.client_id) OR is_admin())
    )
  );

DROP POLICY IF EXISTS protection_extractions_assignment ON protection_extractions;
CREATE POLICY protection_extractions_assignment ON protection_extractions
  FOR ALL
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

DROP POLICY IF EXISTS protection_domain_events_assignment ON protection_domain_events;
CREATE POLICY protection_domain_events_assignment ON protection_domain_events
  FOR ALL
  USING (is_assigned_advisor(client_id) OR is_admin())
  WITH CHECK (is_assigned_advisor(client_id) OR is_admin());

COMMENT ON TABLE protection_policies IS
  'CRM V2 canonical protection policy identity — confirmed versions are portfolio authority';
COMMENT ON TABLE protection_policy_versions IS
  'Versioned protection policy data — only confirmed/corrected versions are client-visible';
COMMENT ON TABLE protection_extractions IS
  'Provisional extraction review — never authoritative until adviser confirmation';
COMMENT ON TABLE protection_domain_events IS
  'Immutable protection-domain audit events with safe metadata only';
