-- Phase 9A hardening: publication concurrency integrity
-- Additive only. Apply after 202606200001_phase9a_compliance_access_architecture.sql

-- Prevent two simultaneously current published outputs per client/type/audience
CREATE UNIQUE INDEX IF NOT EXISTS idx_published_outputs_one_current_published
  ON published_outputs (client_id, output_type, output_audience)
  WHERE publication_status = 'published'
    AND withdrawn_at IS NULL
    AND superseded_at IS NULL;

COMMENT ON INDEX idx_published_outputs_one_current_published IS
  'Ensures at most one current published output per client, type and audience.';
