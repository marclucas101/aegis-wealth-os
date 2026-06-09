-- Phase 3A: financial_profiles and shield_scores
-- Source: docs/database-schema.md §5.5, §5.6

-- ---------------------------------------------------------------------------
-- financial_profiles — buildClientFinancialProfile() output
-- ---------------------------------------------------------------------------
CREATE TABLE financial_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  discover_profile_id     UUID NOT NULL REFERENCES discover_profiles(id) ON DELETE CASCADE,
  is_current              BOOLEAN NOT NULL DEFAULT true,

  profile_data            JSONB NOT NULL,

  annual_income           NUMERIC(18, 2),
  net_worth               NUMERIC(18, 2),
  total_debt              NUMERIC(18, 2),
  monthly_surplus         NUMERIC(18, 2),
  savings_rate            NUMERIC(6, 4),
  is_business_owner       BOOLEAN NOT NULL DEFAULT false,

  computed_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_financial_profiles_current
  ON financial_profiles (client_id)
  WHERE is_current = true;

CREATE INDEX idx_financial_profiles_client_id ON financial_profiles (client_id);
CREATE INDEX idx_financial_profiles_discover_profile_id ON financial_profiles (discover_profile_id);
CREATE INDEX idx_financial_profiles_profile_data_gin ON financial_profiles USING GIN (profile_data);

CREATE TRIGGER financial_profiles_set_updated_at
  BEFORE UPDATE ON financial_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- shield_scores — ShieldScoreResult + AWRI + benchmark snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE shield_scores (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  discover_profile_id         UUID NOT NULL REFERENCES discover_profiles(id) ON DELETE CASCADE,
  financial_profile_id        UUID NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  is_current                  BOOLEAN NOT NULL DEFAULT true,
  score_version               TEXT NOT NULL DEFAULT 'v1',
  snapshot_reason             TEXT NOT NULL DEFAULT 'discover_save',

  raw_shield_score            NUMERIC(5, 2) NOT NULL CHECK (raw_shield_score BETWEEN 0 AND 100),
  adjusted_shield_score       NUMERIC(5, 2) NOT NULL CHECK (adjusted_shield_score BETWEEN 0 AND 100),
  data_confidence_factor      NUMERIC(4, 3) NOT NULL,
  discover_score              NUMERIC(5, 2) NOT NULL,
  rating                      shield_rating NOT NULL,

  awri                        NUMERIC(5, 2) CHECK (awri BETWEEN 0 AND 100),
  awri_rating                 shield_rating,
  resilience_score            NUMERIC(5, 2),
  behaviour_score             NUMERIC(5, 2),
  governance_score            NUMERIC(5, 2),
  continuity_score            NUMERIC(5, 2),

  benchmark_cohort            TEXT,
  benchmark_cohort_average    NUMERIC(5, 2),
  benchmark_top_25            NUMERIC(5, 2),
  benchmark_top_10            NUMERIC(5, 2),
  benchmark_delta             NUMERIC(6, 2),
  benchmark_classification    benchmark_classification,

  weakest_pillar              shield_pillar,
  strongest_pillar            shield_pillar,

  projected_raw_shield_score      NUMERIC(5, 2),
  projected_adjusted_shield_score NUMERIC(5, 2),
  projected_rating                shield_rating,

  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shield_scores_current
  ON shield_scores (client_id)
  WHERE is_current = true;

CREATE INDEX idx_shield_scores_client_id ON shield_scores (client_id);
CREATE INDEX idx_shield_scores_computed_at ON shield_scores (computed_at DESC);
CREATE INDEX idx_shield_scores_adjusted ON shield_scores (adjusted_shield_score DESC);
CREATE INDEX idx_shield_scores_rating ON shield_scores (rating);
CREATE INDEX idx_shield_scores_score_version ON shield_scores (score_version);

CREATE TRIGGER shield_scores_set_updated_at
  BEFORE UPDATE ON shield_scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE financial_profiles IS 'Scoring-engine input bundle from Discover; server-written snapshots.';
COMMENT ON TABLE shield_scores IS 'Versioned shield/AWRI/benchmark snapshot; score_version tracks engine generation.';
