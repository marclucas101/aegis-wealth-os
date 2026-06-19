-- Phase 9D: Converted client portal — goals, review submissions, roadmap presentation
-- Do not apply to production without staging validation.

-- ---------------------------------------------------------------------------
-- Extend published_outputs output types
-- ---------------------------------------------------------------------------
ALTER TABLE published_outputs DROP CONSTRAINT IF EXISTS published_outputs_output_type_check;

ALTER TABLE published_outputs ADD CONSTRAINT published_outputs_output_type_check CHECK (
  output_type IN (
    'financial_readiness_snapshot',
    'financial_overview',
    'client_plan_summary',
    'roadmap_summary',
    'annual_review_summary',
    'goal_plan_summary',
    'wealth_blueprint_summary',
    'stress_test_summary',
    'shield_diagnostic_summary',
    'meeting_summary',
    'meeting_presentation',
    'insights_update'
  )
);

-- ---------------------------------------------------------------------------
-- Roadmap presentation fields (client-safe task separation)
-- ---------------------------------------------------------------------------
ALTER TABLE roadmap_items
  ADD COLUMN IF NOT EXISTS task_owner TEXT NOT NULL DEFAULT 'adviser';

ALTER TABLE roadmap_items
  ADD COLUMN IF NOT EXISTS client_visible BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE roadmap_items
  ADD COLUMN IF NOT EXISTS client_status_label TEXT;

ALTER TABLE roadmap_items
  ADD COLUMN IF NOT EXISTS display_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roadmap_items_task_owner_check'
  ) THEN
    ALTER TABLE roadmap_items
      ADD CONSTRAINT roadmap_items_task_owner_check
      CHECK (task_owner IN ('client', 'adviser'));
  END IF;
END $$;

COMMENT ON COLUMN roadmap_items.task_owner IS
  'client = actionable by client; adviser = visible status only (Phase 9D).';
COMMENT ON COLUMN roadmap_items.client_visible IS
  'When false, item is excluded from client portal APIs.';

-- ---------------------------------------------------------------------------
-- Client-managed goals (separate from internal analysis)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  target_amount   NUMERIC(14, 2),
  target_date     DATE,
  priority        TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'achieved', 'paused', 'archived')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_goals_client_id ON client_goals (client_id);
CREATE INDEX IF NOT EXISTS idx_client_goals_status ON client_goals (client_id, status);

CREATE TRIGGER client_goals_set_updated_at
  BEFORE UPDATE ON client_goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE client_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_goals_select_owner
  ON client_goals FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id OR c.advisor_user_id = u.id
    )
  );

CREATE POLICY client_goals_insert_owner
  ON client_goals FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

CREATE POLICY client_goals_update_owner
  ON client_goals FOR UPDATE
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

-- ---------------------------------------------------------------------------
-- Client review submissions (history preserved; idempotent adviser tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_review_submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  submission_type   TEXT NOT NULL
    CHECK (submission_type IN ('annual_review', 'life_change', 'goals_update')),
  payload           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'reviewed', 'superseded')),
  source_key        TEXT NOT NULL,
  submitted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_review_submissions_source_key_unique UNIQUE (source_key)
);

CREATE INDEX IF NOT EXISTS idx_client_review_submissions_client
  ON client_review_submissions (client_id, submitted_at DESC);

CREATE TRIGGER client_review_submissions_set_updated_at
  BEFORE UPDATE ON client_review_submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE client_review_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_review_submissions_select_owner
  ON client_review_submissions FOR SELECT
  USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id OR c.advisor_user_id = u.id
    )
  );

CREATE POLICY client_review_submissions_insert_client
  ON client_review_submissions FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN users u ON u.id = auth.uid()
      WHERE c.user_id = u.id
    )
  );

COMMENT ON TABLE client_goals IS 'Client-entered goals — not adviser recommendations (Phase 9D).';
COMMENT ON TABLE client_review_submissions IS
  'Client-submitted review information with history; distinct from published summaries.';
