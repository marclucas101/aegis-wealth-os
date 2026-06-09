-- Phase 3A: discover_profiles and client_profiles
-- Source: docs/database-schema.md §5.3, §5.4

-- ---------------------------------------------------------------------------
-- client_profiles — derived ClientProfile summary (discover FK added below)
-- ---------------------------------------------------------------------------
CREATE TABLE client_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  discover_profile_id         UUID,
  is_current                  BOOLEAN NOT NULL DEFAULT true,

  age                         SMALLINT NOT NULL CHECK (age >= 0),
  annual_income               NUMERIC(18, 2) NOT NULL DEFAULT 0,
  net_worth                   NUMERIC(18, 2) NOT NULL DEFAULT 0,
  marital_status              marital_status NOT NULL DEFAULT 'single',
  has_children                BOOLEAN NOT NULL DEFAULT false,
  has_partner                 BOOLEAN NOT NULL DEFAULT false,
  occupation                  TEXT,
  is_business_owner           BOOLEAN NOT NULL DEFAULT false,
  is_retired                  BOOLEAN NOT NULL DEFAULT false,
  has_multiple_properties     BOOLEAN NOT NULL DEFAULT false,
  has_cross_border_assets     BOOLEAN NOT NULL DEFAULT false,
  has_trust_structure         BOOLEAN NOT NULL DEFAULT false,
  has_multi_generation_dependants BOOLEAN NOT NULL DEFAULT false,
  has_philanthropic_goals     BOOLEAN NOT NULL DEFAULT false,

  -- Denormalised dashboard fields (from latest shield snapshot)
  current_adjusted_shield_score NUMERIC(5, 2),
  current_shield_rating       shield_rating,
  weakest_pillar              shield_pillar,
  strongest_pillar            shield_pillar,

  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_client_profiles_current
  ON client_profiles (client_id)
  WHERE is_current = true;

CREATE INDEX idx_client_profiles_client_id ON client_profiles (client_id);
CREATE INDEX idx_client_profiles_shield_score
  ON client_profiles (current_adjusted_shield_score DESC NULLS LAST);

CREATE TRIGGER client_profiles_set_updated_at
  BEFORE UPDATE ON client_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- discover_profiles — primary onboarding source of truth
-- ---------------------------------------------------------------------------
CREATE TABLE discover_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version                 SMALLINT NOT NULL DEFAULT 1 CHECK (version = 1),
  is_current              BOOLEAN NOT NULL DEFAULT true,
  completed_at            TIMESTAMPTZ NOT NULL,

  form_data               JSONB NOT NULL,
  completeness            JSONB NOT NULL,

  discover_score          NUMERIC(5, 2) NOT NULL CHECK (discover_score BETWEEN 0 AND 100),
  data_confidence_factor  NUMERIC(4, 3) NOT NULL CHECK (data_confidence_factor BETWEEN 0.70 AND 1.00),

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_discover_profiles_current
  ON discover_profiles (client_id)
  WHERE is_current = true;

CREATE INDEX idx_discover_profiles_client_id ON discover_profiles (client_id);
CREATE INDEX idx_discover_profiles_completed_at ON discover_profiles (completed_at DESC);
CREATE INDEX idx_discover_profiles_form_data_gin ON discover_profiles USING GIN (form_data);

CREATE TRIGGER discover_profiles_set_updated_at
  BEFORE UPDATE ON discover_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Deferred FK: client_profiles → discover_profiles
ALTER TABLE client_profiles
  ADD CONSTRAINT client_profiles_discover_profile_id_fkey
  FOREIGN KEY (discover_profile_id) REFERENCES discover_profiles(id) ON DELETE SET NULL;

COMMENT ON TABLE discover_profiles IS 'Raw Discover onboarding data; source of truth for scoring inputs.';
COMMENT ON TABLE client_profiles IS 'Derived ClientProfile summary; one current row per client.';
