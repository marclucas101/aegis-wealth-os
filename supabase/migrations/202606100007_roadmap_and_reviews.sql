-- Phase 3A: roadmap_items, annual_reviews, wealth_blueprints
-- Source: docs/database-schema.md §5.9, §5.10, §5.11

-- ---------------------------------------------------------------------------
-- roadmap_items — generated actions with persisted user status
-- ---------------------------------------------------------------------------
CREATE TABLE roadmap_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shield_score_id     UUID REFERENCES shield_scores(id) ON DELETE SET NULL,
  item_key            TEXT NOT NULL,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  score_version       TEXT NOT NULL DEFAULT 'v1',

  title               TEXT NOT NULL,
  pillar              shield_pillar NOT NULL,
  current_score       NUMERIC(5, 2) NOT NULL,
  target_score        NUMERIC(5, 2) NOT NULL DEFAULT 80,
  estimated_impact    NUMERIC(5, 2) NOT NULL,
  timeline_months     SMALLINT NOT NULL CHECK (timeline_months > 0),
  difficulty          roadmap_difficulty NOT NULL,
  priority            roadmap_priority NOT NULL DEFAULT 'medium',
  status              roadmap_status NOT NULL DEFAULT 'not_started',

  gap_severity        NUMERIC(5, 2),
  stress_exposure     NUMERIC(5, 2),
  impact_potential    NUMERIC(5, 2),
  urgency             NUMERIC(5, 2),

  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_roadmap_items_active_unique
  ON roadmap_items (client_id, item_key)
  WHERE is_active = true;

CREATE INDEX idx_roadmap_items_client_id ON roadmap_items (client_id);
CREATE INDEX idx_roadmap_items_status ON roadmap_items (client_id, status);
CREATE INDEX idx_roadmap_items_pillar ON roadmap_items (client_id, pillar);
CREATE INDEX idx_roadmap_items_priority ON roadmap_items (priority, urgency DESC NULLS LAST);
CREATE INDEX idx_roadmap_items_shield_score_id ON roadmap_items (shield_score_id);

CREATE TRIGGER roadmap_items_set_updated_at
  BEFORE UPDATE ON roadmap_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- annual_reviews — yearly review snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE annual_reviews (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shield_score_id             UUID REFERENCES shield_scores(id) ON DELETE SET NULL,
  review_year                 SMALLINT NOT NULL CHECK (review_year >= 2000),
  review_label                TEXT,
  score_version               TEXT NOT NULL DEFAULT 'v1',

  adjusted_shield_score       NUMERIC(5, 2) NOT NULL,
  rating                      shield_rating NOT NULL,
  discover_score              NUMERIC(5, 2) NOT NULL,
  data_confidence_factor      NUMERIC(4, 3) NOT NULL,
  awri                        NUMERIC(5, 2),
  projected_adjusted_score    NUMERIC(5, 2),
  total_improvement           NUMERIC(6, 2),

  timeline                    JSONB NOT NULL DEFAULT '[]',
  top_stress_exposures        JSONB NOT NULL DEFAULT '[]',
  weakest_pillars             JSONB NOT NULL DEFAULT '[]',

  actions_completed           SMALLINT NOT NULL DEFAULT 0,
  actions_total               SMALLINT NOT NULL DEFAULT 0,

  generated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT annual_reviews_client_year_unique UNIQUE (client_id, review_year)
);

CREATE INDEX idx_annual_reviews_client_id ON annual_reviews (client_id);
CREATE INDEX idx_annual_reviews_review_year ON annual_reviews (review_year DESC);
CREATE INDEX idx_annual_reviews_generated_at ON annual_reviews (generated_at DESC);

CREATE TRIGGER annual_reviews_set_updated_at
  BEFORE UPDATE ON annual_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- wealth_blueprints — institutional report snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE wealth_blueprints (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shield_score_id         UUID REFERENCES shield_scores(id) ON DELETE SET NULL,
  annual_review_id        UUID REFERENCES annual_reviews(id) ON DELETE SET NULL,
  report_type             TEXT NOT NULL DEFAULT 'wealth_architecture_blueprint',
  score_version           TEXT NOT NULL DEFAULT 'v1',

  title                   TEXT NOT NULL,
  executive_summary       TEXT,

  report_data             JSONB NOT NULL,

  adjusted_shield_score   NUMERIC(5, 2),
  awri                    NUMERIC(5, 2),
  rating                  shield_rating,

  generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wealth_blueprints_client_id ON wealth_blueprints (client_id);
CREATE INDEX idx_wealth_blueprints_generated_at ON wealth_blueprints (generated_at DESC);
CREATE INDEX idx_wealth_blueprints_report_type ON wealth_blueprints (report_type);
CREATE INDEX idx_wealth_blueprints_report_data_gin ON wealth_blueprints USING GIN (report_data);

CREATE TRIGGER wealth_blueprints_set_updated_at
  BEFORE UPDATE ON wealth_blueprints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE roadmap_items IS 'Generated roadmap actions; score_version tracks engine generation.';
COMMENT ON TABLE annual_reviews IS 'Yearly review snapshots; score_version tracks engine generation.';
COMMENT ON TABLE wealth_blueprints IS 'Report snapshots for PDF/re-render; score_version tracks engine generation.';
