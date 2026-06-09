-- Phase 3A: pillar_scores and stress_tests
-- Source: docs/database-schema.md §5.7, §5.8

-- RLS helper for child tables keyed by shield_score_id
CREATE OR REPLACE FUNCTION owns_shield_score(p_shield_score_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shield_scores ss
    WHERE ss.id = p_shield_score_id
      AND owns_client(ss.client_id)
  );
$$;

COMMENT ON FUNCTION owns_shield_score(UUID) IS 'True when auth.uid() owns the client linked to a shield snapshot.';

-- ---------------------------------------------------------------------------
-- pillar_scores — normalised pillar breakdown per shield snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE pillar_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shield_score_id   UUID NOT NULL REFERENCES shield_scores(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  pillar            shield_pillar NOT NULL,
  score_version     TEXT NOT NULL DEFAULT 'v1',
  score             NUMERIC(5, 2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  weight            NUMERIC(4, 3) NOT NULL,
  weighted_contribution NUMERIC(6, 3) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pillar_scores_unique_per_snapshot UNIQUE (shield_score_id, pillar)
);

CREATE INDEX idx_pillar_scores_shield_score_id ON pillar_scores (shield_score_id);
CREATE INDEX idx_pillar_scores_client_pillar ON pillar_scores (client_id, pillar);
CREATE INDEX idx_pillar_scores_score ON pillar_scores (score);

CREATE TRIGGER pillar_scores_set_updated_at
  BEFORE UPDATE ON pillar_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- stress_tests — one row per scenario per shield snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE stress_tests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shield_score_id     UUID NOT NULL REFERENCES shield_scores(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  scenario            stress_scenario NOT NULL,
  severity            stress_severity NOT NULL DEFAULT 'moderate',
  score_version       TEXT NOT NULL DEFAULT 'v1',
  pre_stress_score    NUMERIC(5, 2) NOT NULL,
  post_stress_score   NUMERIC(5, 2) NOT NULL,
  stress_penalty      NUMERIC(6, 2) NOT NULL,
  mitigation_credit   NUMERIC(6, 2) NOT NULL DEFAULT 0,
  affected_pillars    JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT stress_tests_unique_per_snapshot UNIQUE (shield_score_id, scenario, severity)
);

CREATE INDEX idx_stress_tests_shield_score_id ON stress_tests (shield_score_id);
CREATE INDEX idx_stress_tests_client_id ON stress_tests (client_id);
CREATE INDEX idx_stress_tests_scenario ON stress_tests (scenario);
CREATE INDEX idx_stress_tests_post_score ON stress_tests (post_stress_score ASC);

CREATE TRIGGER stress_tests_set_updated_at
  BEFORE UPDATE ON stress_tests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE pillar_scores IS 'Pillar breakdown for a shield snapshot; score_version tracks engine generation.';
COMMENT ON TABLE stress_tests IS 'Stress scenario results per shield snapshot; score_version tracks engine generation.';
