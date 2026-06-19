-- Phase 9A: Compliance Access Architecture
-- Additive only — preserves existing client_status and financial tables.
-- Rollback notes: see docs/PHASE_9A_MIGRATION_AND_ROLLBACK.md

-- ---------------------------------------------------------------------------
-- Relationship stage (canonical workflow model)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_stage') THEN
    CREATE TYPE relationship_stage AS ENUM (
      'prospect',
      'fact_find_complete',
      'adviser_review',
      'meeting_scheduled',
      'recommendation_prepared',
      'active_client',
      'inactive_client'
    );
  END IF;
END $$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS relationship_stage relationship_stage;

-- Backfill from legacy client_status (idempotent)
UPDATE clients
SET relationship_stage = CASE status
  WHEN 'prospect' THEN 'prospect'::relationship_stage
  WHEN 'onboarding' THEN 'fact_find_complete'::relationship_stage
  WHEN 'active' THEN 'active_client'::relationship_stage
  WHEN 'review_due' THEN 'active_client'::relationship_stage
  WHEN 'archived' THEN 'inactive_client'::relationship_stage
  ELSE 'prospect'::relationship_stage
END
WHERE relationship_stage IS NULL;

ALTER TABLE clients
  ALTER COLUMN relationship_stage SET DEFAULT 'prospect'::relationship_stage;

UPDATE clients
SET relationship_stage = 'prospect'::relationship_stage
WHERE relationship_stage IS NULL;

ALTER TABLE clients
  ALTER COLUMN relationship_stage SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_relationship_stage
  ON clients (relationship_stage);

COMMENT ON COLUMN clients.relationship_stage IS
  'Phase 9A canonical workflow stage. Distinct from legacy client_status.';

-- ---------------------------------------------------------------------------
-- Output audience
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'output_audience') THEN
    CREATE TYPE output_audience AS ENUM (
      'adviser_internal',
      'meeting_presentation',
      'client_published',
      'public_education'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Publication lifecycle
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'publication_status') THEN
    CREATE TYPE publication_status AS ENUM (
      'draft',
      'adviser_reviewed',
      'published',
      'superseded',
      'expired',
      'withdrawn'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Published outputs (generic publication store — safe payloads only)
-- Decision: one generic table rather than altering shield_scores / snapshots.
-- Internal analysis remains in existing financial tables; only allowlisted
-- safe_payload JSON is stored here for client-facing publication.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS published_outputs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  output_type           TEXT NOT NULL,
  output_audience       output_audience NOT NULL DEFAULT 'client_published',
  publication_status    publication_status NOT NULL DEFAULT 'draft',
  safe_payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_input_version  TEXT,
  algorithm_version     TEXT,
  created_by_user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  published_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  superseded_at         TIMESTAMPTZ,
  superseded_by_id      UUID REFERENCES published_outputs(id) ON DELETE SET NULL,
  withdrawn_at          TIMESTAMPTZ,
  withdrawal_reason     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT published_outputs_output_type_check CHECK (
    output_type IN (
      'financial_readiness_snapshot',
      'financial_overview',
      'roadmap_summary',
      'annual_review_summary',
      'wealth_blueprint_summary',
      'stress_test_summary',
      'shield_diagnostic_summary',
      'meeting_presentation',
      'insights_update'
    )
  ),
  CONSTRAINT published_outputs_safe_payload_is_object CHECK (
    jsonb_typeof(safe_payload) = 'object'
  )
);

CREATE INDEX IF NOT EXISTS idx_published_outputs_client_id
  ON published_outputs (client_id);

CREATE INDEX IF NOT EXISTS idx_published_outputs_client_type_status
  ON published_outputs (client_id, output_type, publication_status);

CREATE INDEX IF NOT EXISTS idx_published_outputs_published_at
  ON published_outputs (published_at DESC)
  WHERE publication_status = 'published';

CREATE INDEX IF NOT EXISTS idx_published_outputs_audience
  ON published_outputs (output_audience);

CREATE TRIGGER published_outputs_set_updated_at
  BEFORE UPDATE ON published_outputs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE published_outputs IS
  'Adviser-approved client-safe outputs. Never stores unrestricted internal analysis payloads.';

-- ---------------------------------------------------------------------------
-- Platform feature controls (server-side kill switches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_feature_controls (
  feature_key     TEXT PRIMARY KEY,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  client_visible  BOOLEAN NOT NULL DEFAULT true,
  adviser_visible BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER platform_feature_controls_set_updated_at
  BEFORE UPDATE ON platform_feature_controls
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Production-safe defaults (idempotent seed)
INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  ('raw_client_financial_views', false, false, true,
   'Legacy raw financial payloads on client APIs — disabled in production'),
  ('prospect_readiness_snapshot', true, true, true,
   'Prospect Financial Readiness Snapshot'),
  ('client_published_financial_overview', true, true, true,
   'Adviser-published Financial Overview for active clients'),
  ('client_stress_test_visibility', false, false, true,
   'Client-facing stress test module'),
  ('adviser_publication_workflow', true, false, true,
   'Adviser prepare/review/publish workflow'),
  ('insights_and_updates', true, true, true,
   'Client Insights and Updates (promotions/education)')
ON CONFLICT (feature_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS — published_outputs
-- Clients: SELECT published client_published outputs only
-- Advisers: SELECT assigned client outputs (all audiences except via app layer)
-- Admins: full SELECT
-- Writes via service role only (API layer)
-- ---------------------------------------------------------------------------
ALTER TABLE published_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY published_outputs_select_client ON published_outputs
  FOR SELECT
  USING (
    output_audience = 'client_published'
    AND publication_status = 'published'
    AND (expires_at IS NULL OR expires_at > now())
    AND withdrawn_at IS NULL
    AND superseded_at IS NULL
    AND owns_client(client_id)
  );

CREATE POLICY published_outputs_select_adviser ON published_outputs
  FOR SELECT
  USING (
    is_assigned_advisor(client_id)
    OR is_admin()
  );

CREATE POLICY published_outputs_select_admin ON published_outputs
  FOR SELECT
  USING (is_admin());

-- platform_feature_controls: admin read only; writes via service role
ALTER TABLE platform_feature_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_feature_controls_select_admin ON platform_feature_controls
  FOR SELECT
  USING (is_admin());

COMMENT ON TABLE platform_feature_controls IS
  'Server-side feature kill switches. Defaults seeded; admin overrides via API.';
