-- Phase 9F.1: Scheduled publishing automation — job runs, item evidence, feature control
-- Do not apply to production without staging validation.
-- Rollback: see docs/PHASE_9F1_MIGRATION_AND_ROLLBACK.md

-- ---------------------------------------------------------------------------
-- Automation job runs (operational records — no content bodies or PII)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_job_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name          TEXT NOT NULL,
  trigger_source    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'running',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  items_examined    INTEGER NOT NULL DEFAULT 0,
  items_succeeded   INTEGER NOT NULL DEFAULT 0,
  items_skipped     INTEGER NOT NULL DEFAULT 0,
  items_failed      INTEGER NOT NULL DEFAULT 0,
  sanitized_error   TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_job_runs_job_name_check CHECK (
    job_name IN ('scheduled_publishing')
  ),
  CONSTRAINT automation_job_runs_trigger_source_check CHECK (
    trigger_source IN ('scheduler', 'admin_manual')
  ),
  CONSTRAINT automation_job_runs_status_check CHECK (
    status IN ('running', 'success', 'partial', 'failed', 'skipped')
  )
);

-- One active run per job name (stale runs cleared by application before new run)
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_job_runs_single_active
  ON automation_job_runs (job_name)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_automation_job_runs_job_started
  ON automation_job_runs (job_name, started_at DESC);

ALTER TABLE automation_job_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE automation_job_runs IS
  'Phase 9F.1 automation job operational records. RLS enabled with no client/adviser policies — service-role writes; admin reads via sanitized server API only.';

-- ---------------------------------------------------------------------------
-- Per-item operational evidence (reference IDs only — no content bodies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_job_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_run_id        UUID NOT NULL REFERENCES automation_job_runs(id) ON DELETE CASCADE,
  reference_type    TEXT NOT NULL,
  reference_id      UUID NOT NULL,
  outcome           TEXT NOT NULL,
  sanitized_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT automation_job_items_reference_type_check CHECK (
    reference_type IN ('governed_content')
  ),
  CONSTRAINT automation_job_items_outcome_check CHECK (
    outcome IN ('succeeded', 'skipped', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_automation_job_items_run
  ON automation_job_items (job_run_id);

ALTER TABLE automation_job_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE automation_job_items IS
  'Phase 9F.1 per-item job outcomes. Sanitized reasons only — no emails, bodies, or financial data.';

-- ---------------------------------------------------------------------------
-- Phase 9F.1 feature control
-- ---------------------------------------------------------------------------
INSERT INTO platform_feature_controls (feature_key, enabled, client_visible, adviser_visible, description)
VALUES
  ('scheduled_content_automation', false, false, true, 'Automated scheduled governed-content publication — default disabled (Phase 9F.1)')
ON CONFLICT (feature_key) DO NOTHING;
