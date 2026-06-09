# AEGIS Wealth OS — Phase 3A Database Schema

PostgreSQL / Supabase schema plan to persist the current localStorage MVP.

**Scope:** Planning only. No application code, Supabase client, or migrations are included in this phase.

**Sources:**

- `docs/MASTER_PROMPT.md` — platform modules and data domains
- `docs/scoring-engine.md` — scoring outputs and snapshot semantics
- `lib/aegis/localProfile.ts` — localStorage keys, form shapes, computed page results
- `src/lib/scoring/types.ts` — canonical TypeScript types

---

## 1. Design Principles

1. **Discover is source of truth.** Raw onboarding data lives in `discover_profiles`. All scoring inputs are derived from Discover form data via `buildClientFinancialProfile()`.
2. **Persist user-owned state.** Roadmap item status (`aegis-roadmap-status-v1`) is the only user-mutated scoring artifact in the MVP besides Discover completion.
3. **Snapshot computed outputs.** Shield, pillar, stress, AWRI, benchmark, and projected scores are stored as versioned snapshots so dashboards, annual reviews, and blueprints can show history without recomputing every page load.
4. **Recompute on read (initially).** Phase 3B+ may choose to recompute from Discover on each request; the schema supports both cached snapshots and on-demand regeneration.
5. **One user, one client (MVP).** Phase 3B implementation targets a single authenticated user mapped to a single `clients` row and `client_profiles` record. `advisor_user_id` remains on the schema for future Advisor OS™ but is not required at signup.
6. **Advisor multi-tenancy (future).** When Advisor OS ships, advisors see only clients they own or are assigned to. Clients see only their own records.
7. **Scoring engine versioning.** All persisted scoring outputs carry `score_version` (default `'v1'`) so snapshot rows remain interpretable when the TypeScript engine changes.
8. **Singapore context.** Currency defaults to SGD; CPF and ISP fields are first-class in Discover JSON.

---

## 2. Entity Relationship Overview

```txt
auth.users
    └── users (1:1 profile extension)
            ├── clients.advisor_user_id  (advisor owns/manages)
            └── clients.user_id          (client self-service owner)

clients (1)
    ├── client_profiles          (1:1 current derived summary)
    ├── discover_profiles        (1:n versions, 1 current)
    ├── financial_profiles       (1:n snapshots per discover version)
    ├── shield_scores            (1:n snapshots)
    │       ├── pillar_scores    (1:7 per shield snapshot)
    │       └── stress_tests     (1:10 per shield snapshot)
    ├── roadmap_items            (1:n generated actions)
    ├── annual_reviews           (1:n yearly snapshots)
    ├── wealth_blueprints        (1:n report snapshots)
    ├── documents                (1:n vault files)
    └── advisor_notes            (1:n advisor annotations)
```

---

## 3. Enums

```sql
-- Roles
CREATE TYPE user_role AS ENUM ('client', 'advisor', 'admin');

-- Client lifecycle
CREATE TYPE client_status AS ENUM ('prospect', 'onboarding', 'active', 'review_due', 'archived');

-- Shield domain (mirrors src/lib/scoring/types.ts)
CREATE TYPE shield_pillar AS ENUM (
  'foundation', 'protect', 'grow', 'optimise', 'transition', 'preserve', 'legacy'
);

CREATE TYPE shield_rating AS ENUM ('AAA', 'AA', 'A', 'BBB', 'BB', 'B');

CREATE TYPE stress_scenario AS ENUM (
  'income_loss', 'critical_illness', 'death_event', 'disability', 'market_crash',
  'inflation_shock', 'longevity', 'business_failure', 'parent_care', 'estate_delay'
);

CREATE TYPE stress_severity AS ENUM ('mild', 'moderate', 'severe', 'extreme');

CREATE TYPE roadmap_priority AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE roadmap_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TYPE roadmap_difficulty AS ENUM ('low', 'medium', 'high');

CREATE TYPE benchmark_classification AS ENUM (
  'Leading', 'Above Average', 'In Line', 'Below Average', 'Materially Behind'
);

CREATE TYPE document_category AS ENUM (
  'insurance_policy', 'will', 'trust', 'cpf', 'financial_statement',
  'estate', 'investment_statement', 'business_ownership', 'other'
);

CREATE TYPE marital_status AS ENUM (
  'single', 'married', 'partnered', 'divorced', 'widowed'
);
```

---

## 4. Shared Utilities

```sql
-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Table Definitions

### 5.1 `users`

Extends `auth.users` with application profile and role.

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT,
  role            user_role NOT NULL DEFAULT 'client',
  avatar_url      TEXT,
  organisation    TEXT,          -- advisory firm name (advisors)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_email ON users (email);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 5.2 `clients`

The wealth-architecture subject (household / individual client record).

```sql
CREATE TABLE clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,  -- client portal owner
  advisor_user_id   UUID REFERENCES users(id) ON DELETE SET NULL, -- assigned advisor
  status            client_status NOT NULL DEFAULT 'prospect',
  display_name      TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  currency_code     CHAR(3) NOT NULL DEFAULT 'SGD',
  onboarding_step   TEXT,                -- last incomplete Discover section (optional)
  last_review_at    TIMESTAMPTZ,
  next_review_due   DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- MVP: user_id set on client self-registration. advisor_user_id optional until Advisor OS.
  CONSTRAINT clients_has_owner CHECK (
    user_id IS NOT NULL OR advisor_user_id IS NOT NULL
  )
);

CREATE INDEX idx_clients_user_id ON clients (user_id);
CREATE INDEX idx_clients_advisor_user_id ON clients (advisor_user_id);
CREATE INDEX idx_clients_status ON clients (status);
CREATE INDEX idx_clients_next_review_due ON clients (next_review_due)
  WHERE next_review_due IS NOT NULL;

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**MVP identity rule:** On first authenticated session, create exactly one `clients` row with `user_id = auth.uid()` and `advisor_user_id = NULL`. Application code should resolve the current client via `clients.user_id` — not by listing multiple clients. `advisor_user_id` is future-ready for advisor-assigned clients but unused in the initial client-only flow.

---

### 5.3 `client_profiles`

Derived summary from Discover (`ClientProfile` in scoring types). One **current** row per client; historical rows optional via `is_current`.

```sql
CREATE TABLE client_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  discover_profile_id         UUID,  -- FK added after discover_profiles exists
  is_current                  BOOLEAN NOT NULL DEFAULT true,

  -- ClientProfile scalar fields
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
```

---

### 5.4 `discover_profiles`

Persists `DiscoverStoredProfile` — the primary localStorage payload (`aegis-discover-profile-v1`).

```sql
CREATE TABLE discover_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version                 SMALLINT NOT NULL DEFAULT 1 CHECK (version = 1),
  is_current              BOOLEAN NOT NULL DEFAULT true,
  completed_at            TIMESTAMPTZ NOT NULL,

  -- Raw onboarding form (DiscoverFormData)
  form_data               JSONB NOT NULL,

  -- DiscoverCompleteness (11 section scores 0–100)
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

-- Deferred FK from client_profiles
ALTER TABLE client_profiles
  ADD CONSTRAINT client_profiles_discover_profile_id_fkey
  FOREIGN KEY (discover_profile_id) REFERENCES discover_profiles(id) ON DELETE SET NULL;
```

**`form_data` JSON shape** (matches `DiscoverFormData`):

| Key | Fields |
|-----|--------|
| `personal` | firstName, lastName, dateOfBirth, nationality, maritalStatus, occupation, residency |
| `family` | hasPartner, partnerName, numberOfChildren, dependantDetails, caregivingResponsibilities |
| `income` | primaryIncome, secondaryIncome, incomeType, employer, bonusIncome |
| `expenses` | monthlyEssential, monthlyDiscretionary, monthlyHousing, monthlyInsurance, monthlyOther |
| `assets` | cashAssets, cpfBalance, propertyValue, investmentProperty, otherAssets |
| `liabilities` | mortgageBalance, personalLoans, creditCardDebt, otherLiabilities, totalDebt |
| `policies` | lifeInsurance, healthInsurance, ciCoverage, disabilityCoverage, hasPolicyReview |
| `investments` | investmentAccounts, totalInvestments, assetAllocation, riskProfile, monthlyContribution |
| `retirement` | targetRetirementAge, desiredRetirementIncome, currentRetirementSavings, retirementPriority, cpfLifePlan |
| `estate` | hasWill, hasCpfNomination, hasTrust, beneficiaryDocumented, estatePlanReviewed |
| `business` | isBusinessOwner, businessName, successionPlan, familyGovernance, familyMeetings |

**`completeness` JSON keys:** personalInfo, familyInfo, income, expenses, assets, liabilities, policies, investments, retirementGoals, estate, businessGovernance.

---

### 5.5 `financial_profiles`

Persisted output of `buildClientFinancialProfile()` — scoring-engine input bundle (`ClientFinancialProfile`).

```sql
CREATE TABLE financial_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  discover_profile_id     UUID NOT NULL REFERENCES discover_profiles(id) ON DELETE CASCADE,
  is_current              BOOLEAN NOT NULL DEFAULT true,

  -- Full scoring input object (FoundationInputs … LegacyInputs + optional derived blocks)
  profile_data            JSONB NOT NULL,

  -- Denormalised query fields (extracted on insert for indexing)
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
```

**`profile_data` top-level keys:** foundation, protect, grow, optimise, transition, preserve, legacy, discover, profile, resilience, behaviour, governance, continuity, mitigation.

---

### 5.6 `shield_scores`

Persisted `ShieldScoreResult` plus AWRI and benchmark outputs from `computeDashboardFromProfile()`.

```sql
CREATE TABLE shield_scores (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  discover_profile_id         UUID NOT NULL REFERENCES discover_profiles(id) ON DELETE CASCADE,
  financial_profile_id        UUID NOT NULL REFERENCES financial_profiles(id) ON DELETE CASCADE,
  is_current                  BOOLEAN NOT NULL DEFAULT true,
  score_version               TEXT NOT NULL DEFAULT 'v1',
  snapshot_reason             TEXT NOT NULL DEFAULT 'discover_save',
  -- e.g. discover_save | manual_refresh | annual_review | roadmap_update

  -- ShieldScoreResult
  raw_shield_score            NUMERIC(5, 2) NOT NULL CHECK (raw_shield_score BETWEEN 0 AND 100),
  adjusted_shield_score       NUMERIC(5, 2) NOT NULL CHECK (adjusted_shield_score BETWEEN 0 AND 100),
  data_confidence_factor      NUMERIC(4, 3) NOT NULL,
  discover_score              NUMERIC(5, 2) NOT NULL,
  rating                      shield_rating NOT NULL,

  -- AWRIResult (calculateAWRI)
  awri                        NUMERIC(5, 2) CHECK (awri BETWEEN 0 AND 100),
  awri_rating                 shield_rating,
  resilience_score            NUMERIC(5, 2),
  behaviour_score             NUMERIC(5, 2),
  governance_score            NUMERIC(5, 2),
  continuity_score            NUMERIC(5, 2),

  -- BenchmarkResult (calculateBenchmark)
  benchmark_cohort            TEXT,
  benchmark_cohort_average    NUMERIC(5, 2),
  benchmark_top_25            NUMERIC(5, 2),
  benchmark_top_10            NUMERIC(5, 2),
  benchmark_delta             NUMERIC(6, 2),
  benchmark_classification    benchmark_classification,

  -- Dashboard insights
  weakest_pillar              shield_pillar,
  strongest_pillar            shield_pillar,

  -- Projected shield (optional, from roadmap at snapshot time)
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
```

---

### 5.7 `pillar_scores`

Normalised pillar breakdown for a shield snapshot (from `ShieldScoreResult.pillarScores`).

```sql
CREATE TABLE pillar_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shield_score_id   UUID NOT NULL REFERENCES shield_scores(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  pillar            shield_pillar NOT NULL,
  score_version     TEXT NOT NULL DEFAULT 'v1',
  score             NUMERIC(5, 2) NOT NULL CHECK (score BETWEEN 0 AND 100),
  weight            NUMERIC(4, 3) NOT NULL,  -- pillar weight in shield formula
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
```

**Default weights** (from scoring-engine.md):

| pillar | weight |
|--------|-------:|
| foundation | 0.30 |
| protect | 0.15 |
| grow | 0.15 |
| optimise | 0.10 |
| transition | 0.10 |
| preserve | 0.10 |
| legacy | 0.10 |

---

### 5.8 `stress_tests`

One row per scenario per shield snapshot (`StressTestResult` from `runAllStressTests()`).

```sql
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
  affected_pillars    JSONB NOT NULL DEFAULT '{}',  -- Partial<PillarScores>
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
```

---

### 5.9 `roadmap_items`

Generated actions from `buildRoadmapFromPillars()` with persisted status from `aegis-roadmap-status-v1`.

```sql
CREATE TABLE roadmap_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shield_score_id     UUID REFERENCES shield_scores(id) ON DELETE SET NULL,
  item_key            TEXT NOT NULL,  -- engine id e.g. "foundation-emergency-fund"
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
```

**Status persistence:** On roadmap status change, upsert by `(client_id, item_key)` where `is_active = true` and set `status`, `started_at`, `completed_at`.

When Discover is re-saved, set prior matching rows to `is_active = false`, insert fresh rows, and **preserve status** for matching `item_key` values (same behaviour as `applyRoadmapStatuses()`). The partial unique index allows historical inactive rows with the same `item_key`.

---

### 5.10 `annual_reviews`

Yearly review snapshots from `computeAnnualReviewFromProfile()`.

```sql
CREATE TABLE annual_reviews (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shield_score_id             UUID REFERENCES shield_scores(id) ON DELETE SET NULL,
  review_year                 SMALLINT NOT NULL CHECK (review_year >= 2000),
  review_label                TEXT,  -- e.g. "2026 Annual Shield Review"
  score_version               TEXT NOT NULL DEFAULT 'v1',

  -- Summary metrics
  adjusted_shield_score       NUMERIC(5, 2) NOT NULL,
  rating                      shield_rating NOT NULL,
  discover_score              NUMERIC(5, 2) NOT NULL,
  data_confidence_factor      NUMERIC(4, 3) NOT NULL,
  awri                        NUMERIC(5, 2),
  projected_adjusted_score    NUMERIC(5, 2),
  total_improvement           NUMERIC(6, 2),

  -- 4-year timeline (AnnualReviewTimelineYear[])
  timeline                    JSONB NOT NULL DEFAULT '[]',

  -- Top exposures (StressTestResult[], top 3 by post_stress_score)
  top_stress_exposures        JSONB NOT NULL DEFAULT '[]',

  -- Weakest pillars snapshot
  weakest_pillars             JSONB NOT NULL DEFAULT '[]',

  -- Completed roadmap count at review time
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
```

**`timeline` JSON element shape:**

```json
{
  "calendarYear": 2026,
  "yearOffset": 0,
  "label": "Current Year",
  "adjustedShieldScore": 62,
  "rating": "BBB",
  "progressPercent": 0,
  "actionsCompleted": 1
}
```

---

### 5.11 `wealth_blueprints`

Institutional report snapshots from `computeBlueprintFromProfile()`.

```sql
CREATE TABLE wealth_blueprints (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shield_score_id         UUID REFERENCES shield_scores(id) ON DELETE SET NULL,
  annual_review_id        UUID REFERENCES annual_reviews(id) ON DELETE SET NULL,
  report_type             TEXT NOT NULL DEFAULT 'wealth_architecture_blueprint',
  -- wealth_architecture_blueprint | shield_diagnostic | annual_shield_review | family_office_readiness
  score_version           TEXT NOT NULL DEFAULT 'v1',

  title                   TEXT NOT NULL,
  executive_summary       TEXT,

  -- Full BlueprintPageResults payload for PDF/re-render
  report_data             JSONB NOT NULL,

  -- Denormalised header fields for listing
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
```

**`report_data` includes:** shield, awri, stressTests, topStressExposures, roadmap, projected, weakestPillars, client, formData, completedAt.

---

### 5.12 `documents`

Document Vault metadata (files stored in Supabase Storage).

```sql
CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category            document_category NOT NULL DEFAULT 'other',
  title               TEXT NOT NULL,
  description         TEXT,
  file_name           TEXT NOT NULL,
  mime_type           TEXT,
  file_size_bytes     BIGINT CHECK (file_size_bytes >= 0),
  storage_bucket      TEXT NOT NULL DEFAULT 'client-documents',
  storage_path        TEXT NOT NULL,  -- {client_id}/{uuid}/{file_name}
  checksum_sha256     TEXT,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  reviewed_at           TIMESTAMPTZ,
  expires_at            DATE,
  is_archived           BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT documents_storage_path_unique UNIQUE (storage_path)
);

CREATE INDEX idx_documents_client_id ON documents (client_id);
CREATE INDEX idx_documents_category ON documents (client_id, category);
CREATE INDEX idx_documents_uploaded_by ON documents (uploaded_by_user_id);
CREATE INDEX idx_documents_tags_gin ON documents USING GIN (tags);
CREATE INDEX idx_documents_not_archived ON documents (client_id, created_at DESC)
  WHERE is_archived = false;

CREATE TRIGGER documents_set_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 5.13 `advisor_notes`

Advisor annotations for the Advisor OS (Phase 7 placeholder in MVP; schema ready).

```sql
CREATE TABLE advisor_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  advisor_user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT,
  body                TEXT NOT NULL,
  is_pinned           BOOLEAN NOT NULL DEFAULT false,
  related_pillar      shield_pillar,
  related_roadmap_item_id UUID REFERENCES roadmap_items(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_advisor_notes_client_id ON advisor_notes (client_id, created_at DESC);
CREATE INDEX idx_advisor_notes_advisor_user_id ON advisor_notes (advisor_user_id);
CREATE INDEX idx_advisor_notes_pinned ON advisor_notes (client_id, is_pinned)
  WHERE is_pinned = true;

CREATE TRIGGER advisor_notes_set_updated_at
  BEFORE UPDATE ON advisor_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

### 5.14 `audit_logs` *(Phase 3C / pre-beta — not in initial migration)*

Append-only activity log for compliance, advisor oversight, and debugging. Planned before beta; **excluded from Phase 3B initial migration set.**

```sql
CREATE TABLE audit_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  actor_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action              TEXT NOT NULL,       -- e.g. discover_save | roadmap_status_update | document_upload
  entity_type         TEXT NOT NULL,       -- e.g. discover_profiles | roadmap_items | documents
  entity_id           UUID,
  score_version       TEXT,                -- scoring engine version at time of action, if applicable
  metadata            JSONB NOT NULL DEFAULT '{}',
  ip_address          INET,
  user_agent          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_client_id ON audit_logs (client_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
```

**RLS (when implemented):** INSERT via service role only; SELECT restricted to admin and assigned advisor for the related client. No UPDATE or DELETE policies (immutable log).

**Migration timing:** Add in Phase 3C alongside server-side write paths that emit audit events. Do not block MVP persistence on this table.

---

## 6. localStorage → Database Mapping

### 6.1 Primary key: `aegis-discover-profile-v1`

| localStorage field | Database destination |
|--------------------|---------------------|
| `version` | `discover_profiles.version` |
| `completedAt` | `discover_profiles.completed_at` |
| `formData` | `discover_profiles.form_data` |
| `completeness` | `discover_profiles.completeness` |
| `discoverScore` | `discover_profiles.discover_score` |
| `dataConfidenceFactor` | `discover_profiles.data_confidence_factor` |

**Downstream (computed on save, not in localStorage):**

| Computed object | Tables |
|-----------------|--------|
| `buildClientFinancialProfile()` | `financial_profiles.profile_data` + denormalised columns |
| `ClientProfile` (from financial.profile) | `client_profiles` row |
| `calculateShieldScore()` | `shield_scores` + `pillar_scores` |
| `calculateAWRI()` | `shield_scores.awri*` columns |
| `calculateBenchmark()` | `shield_scores.benchmark_*` columns |
| `runAllStressTests()` | `stress_tests` (10 rows per snapshot) |
| `buildRoadmapFromPillars()` | `roadmap_items` (upsert by `item_key`) |
| `calculateProjectedShield()` | `shield_scores.projected_*` columns |
| `computeBlueprintFromProfile()` | `wealth_blueprints.report_data` |
| `computeAnnualReviewFromProfile()` | `annual_reviews` row |

### 6.2 Secondary key: `aegis-roadmap-status-v1`

| localStorage shape | Database destination |
|--------------------|---------------------|
| `Record<itemId, status>` | `roadmap_items.status` where `item_key = itemId` |
| `"in_progress"` status | `roadmap_items.status = 'in_progress'`, `started_at = now()` |
| `"completed"` status | `roadmap_items.status = 'completed'`, `completed_at = now()` |

### 6.3 Implicit client identity (MVP)

The MVP has no auth — localStorage is device-scoped. On migration:

1. Create `users` + exactly one `clients` row (`user_id = auth.uid()`, `advisor_user_id = NULL`) on first authenticated session.
2. Import single-device Discover profile into `discover_profiles`.
3. Import roadmap status map into matching active `roadmap_items`.
4. Run scoring pipeline once to populate snapshots with `score_version = 'v1'`.

---

## 7. Snapshot & Versioning Rules

| Event | Action |
|-------|--------|
| Discover saved (new or update) | Set prior `discover_profiles.is_current = false`; insert new row; recompute financial → shield → stress → roadmap |
| Roadmap status changed | Update `roadmap_items` only; optionally create new `shield_scores` with `snapshot_reason = 'roadmap_update'` and refresh projected columns |
| Manual refresh | New `shield_scores` snapshot; mark prior `is_current = false` |
| Annual review generated | Insert `annual_reviews`; optionally insert `wealth_blueprints` |
| Blueprint exported | Insert `wealth_blueprints` with full `report_data` |

**Current-record pattern:** Tables with `is_current` use a partial unique index so only one active row exists per client for discover, financial, and shield data.

**Scoring version pattern:** All scoring output tables (`shield_scores`, `pillar_scores`, `stress_tests`, `roadmap_items`, `annual_reviews`, `wealth_blueprints`) store `score_version` at write time. When the TypeScript engine ships a breaking change, bump the version string in application code; historical rows remain queryable by version.

---

## 8. Recommended Indexes Summary

| Table | Index | Purpose |
|-------|-------|---------|
| `clients` | `(advisor_user_id)`, `(status)`, `(next_review_due)` | Advisor dashboard, review queue |
| `client_profiles` | `(client_id) WHERE is_current` | Fast client summary |
| `discover_profiles` | `(client_id) WHERE is_current`, GIN on `form_data` | Current onboarding, search |
| `financial_profiles` | `(client_id) WHERE is_current` | Scoring input lookup |
| `shield_scores` | `(client_id) WHERE is_current`, `(adjusted_shield_score DESC)` | Dashboard, leaderboards |
| `pillar_scores` | `(shield_score_id)`, `(client_id, pillar)` | Gap analysis, weakest pillar |
| `stress_tests` | `(shield_score_id)`, `(post_stress_score ASC)` | Top exposures |
| `roadmap_items` | `(client_id, item_key) WHERE is_active`, `(client_id, status)`, `(priority, urgency DESC)` | Active item uniqueness, action queue |
| `annual_reviews` | `(client_id, review_year)` | Review history |
| `wealth_blueprints` | `(client_id, generated_at DESC)` | Report library |
| `documents` | `(client_id, category)`, GIN on `tags` | Vault browsing |
| `advisor_notes` | `(client_id, created_at DESC)` | Advisor timeline |

---

## 9. Row Level Security (RLS)

Enable RLS on all public tables. Service role bypasses RLS for server-side scoring jobs.

### 9.1 Helper functions

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_advisor()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('advisor', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION owns_client(p_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clients
    WHERE id = p_client_id
      AND (user_id = auth.uid() OR advisor_user_id = auth.uid())
  );
$$;
```

### 9.2 Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `users` | Own row; advisors see self | Own row on signup trigger | Own row | Admin only |
| `clients` | `owns_client(id)` or admin | Advisor creates; client self-register | Advisor or owning client | Admin |
| `client_profiles` | `owns_client(client_id)` | Server / advisor | Server / advisor | Admin |
| `discover_profiles` | `owns_client(client_id)` | Client or advisor for owned client | Client or advisor | Admin |
| `financial_profiles` | `owns_client(client_id)` | Server-side only (scoring job) | Server-side only | Admin |
| `shield_scores` | `owns_client(client_id)` | Server-side only | Server-side only | Admin |
| `pillar_scores` | via shield → client ownership | Server-side only | Server-side only | Admin |
| `stress_tests` | via shield → client ownership | Server-side only | Server-side only | Admin |
| `roadmap_items` | `owns_client(client_id)` | Server on generate; status update by client/advisor | Client/advisor for status fields | Admin |
| `annual_reviews` | `owns_client(client_id)` | Server / advisor | Server / advisor | Admin |
| `wealth_blueprints` | `owns_client(client_id)` | Server / advisor | Admin | Admin |
| `documents` | `owns_client(client_id)` | Client or advisor upload | Uploader or advisor | Admin |
| `advisor_notes` | Advisor assigned to client | Assigned advisor | Note author | Author or admin |

### 9.3 Storage bucket policies

Bucket: `client-documents`

- Path prefix must match `{client_id}/…`
- SELECT/INSERT/UPDATE: user passes `owns_client(client_id)` extracted from path
- DELETE: advisor or admin only

### 9.4 Notes

- **Server-side scoring writes** should use the Supabase service role in API routes / Edge Functions, not client-side inserts into `shield_scores`, `financial_profiles`, or `stress_tests`.
- **Client roadmap status updates** may use a narrow RLS policy allowing UPDATE on `roadmap_items.status`, `started_at`, `completed_at` only.
- **`users.role`** should be set via admin trigger or invite flow, not client-writable.

---

## 10. Migration Order

Apply migrations in this order to satisfy foreign-key dependencies:

| Step | Migration | Depends on |
|------|-----------|------------|
| 1 | Extensions (`pgcrypto` for `gen_random_uuid`) | — |
| 2 | Enums | — |
| 3 | `set_updated_at()` function | — |
| 4 | RLS helper functions | — |
| 5 | `users` | `auth.users` |
| 6 | `clients` | `users` |
| 7 | `discover_profiles` | `clients` |
| 8 | `client_profiles` + deferred FK to discover | `clients`, `discover_profiles` |
| 9 | `financial_profiles` | `clients`, `discover_profiles` |
| 10 | `shield_scores` | `clients`, `discover_profiles`, `financial_profiles` |
| 11 | `pillar_scores` | `shield_scores`, `clients` |
| 12 | `stress_tests` | `shield_scores`, `clients` |
| 13 | `roadmap_items` | `clients`, `shield_scores` |
| 14 | `annual_reviews` | `clients`, `shield_scores` |
| 15 | `wealth_blueprints` | `clients`, `shield_scores`, `annual_reviews` |
| 16 | `documents` | `clients`, `users` |
| 17 | `advisor_notes` | `clients`, `users`, `roadmap_items` |
| 18 | Enable RLS + policies (all tables) | all tables |
| 19 | Storage bucket + policies | `clients` |
| 20 | Auth trigger: `on_auth_user_created` → insert `users` row | `users` |
| — | `audit_logs` *(Phase 3C / pre-beta)* | `clients`, `users` — **not in initial migration** |

Suggested Supabase migration filenames:

```txt
202606100001_extensions_and_enums.sql
202606100002_core_functions.sql
202606100003_users_and_clients.sql
202606100004_discover_and_profiles.sql
202606100005_financial_and_shield.sql
202606100006_pillar_and_stress.sql
202606100007_roadmap_and_reviews.sql
202606100008_documents_and_notes.sql
202606100009_rls_policies.sql
202606100010_storage_policies.sql
202606100011_audit_logs.sql          -- Phase 3C / pre-beta only
```

---

## 11. Write Path (Phase 3B Reference)

Not implemented in Phase 3A; documented for alignment.

```txt
saveDiscoverProfile(input)
  → INSERT discover_profiles (is_current = true, demote prior)
  → buildClientFinancialProfile()
  → INSERT financial_profiles
  → calculateShieldScore() + calculateAWRI() + calculateBenchmark()
  → INSERT shield_scores + pillar_scores (score_version = 'v1')
  → runAllStressTests() → INSERT stress_tests (score_version = 'v1')
  → buildRoadmapFromPillars() + applyRoadmapStatuses()
  → deactivate prior roadmap_items (is_active = false); INSERT new active rows (preserve status by item_key)
  → UPSERT client_profiles (is_current)

updateRoadmapStatus(item_key, status)
  → UPDATE roadmap_items
  → OPTIONAL: refresh projected columns on current shield_scores

generateAnnualReview(client_id, review_year)
  → computeAnnualReviewFromProfile()
  → INSERT annual_reviews
  → INSERT wealth_blueprints (optional)

generateBlueprint(client_id)
  → computeBlueprintFromProfile()
  → INSERT wealth_blueprints
```

---

## 12. Implementation Assumptions

1. **Auth provider:** Supabase Auth (email/password or magic link). Clerk mentioned in MASTER_PROMPT is deferred; schema uses `auth.users` as canonical identity.
2. **One authenticated user = one client (MVP):** Phase 3B creates exactly one `clients` row per signing-in user (`user_id = auth.uid()`). Application resolves the current client with a single-row lookup — no client picker. Multi-client household / family office is a future extension.
3. **`advisor_user_id` is future-ready:** Column exists on `clients` but remains `NULL` in the client-only MVP flow. Advisor assignment and Advisor OS dashboards are deferred; RLS already supports the column for when it is populated.
4. **Scoring engine version:** All scoring output rows default to `score_version = 'v1'`, matching the current TypeScript engine. Application code sets this explicitly on insert; bump the string when scoring logic changes materially.
5. **Roadmap item history:** Only one active row per `(client_id, item_key)` via partial unique index. Regeneration on Discover save deactivates prior rows rather than overwriting them.
6. **Advisor assignment (future):** A client has at most one primary `advisor_user_id`. Team access requires a future `client_advisors` junction table.
7. **Currency:** All monetary JSON strings from Discover are normalised to `NUMERIC(18,2)` on write. Display formatting stays in the UI layer.
8. **Scoring remains in TypeScript:** PostgreSQL stores outputs only; no scoring logic is duplicated in SQL functions for Phase 3.
9. **JSONB for complex inputs:** `form_data`, `profile_data`, and `report_data` use JSONB for fidelity with existing types. Normalisation of individual form fields into columns is deferred until reporting queries require it.
10. **Snapshot frequency:** Every Discover save creates a full scoring snapshot chain. Roadmap status-only changes do not require full re-snapshot unless projected shield must refresh.
11. **Audit logs deferred:** `audit_logs` is designed (§5.14) but excluded from the initial migration set. Implement in Phase 3C / pre-beta when server-side write paths can emit events.
12. **Documents:** MVP localStorage has no document vault; `documents` table is forward-looking for Phase 7 / Document Vault™.
13. **Advisor notes:** MVP has no notes UI; `advisor_notes` is forward-looking for Advisor OS™.
14. **No soft-delete on clients:** Use `client_status = 'archived'` instead of hard delete for compliance retention.
15. **Timestamps:** All `created_at` / `updated_at` are `TIMESTAMPTZ` (UTC). Discover `completedAt` maps to `completed_at`.
16. **RLS helper hardening:** All `SECURITY DEFINER` helpers use `SET search_path = public` to prevent search-path injection.
17. **Prisma optional:** MASTER_PROMPT mentions Prisma; Phase 3A is raw SQL compatible with Supabase migrations. ORM choice is deferred to Phase 3B.

---

## 13. Out of Scope

**Phase 3A (this document):**

- Supabase client SDK integration
- API routes / server actions
- Auth UI wiring
- Storage upload handlers
- Real-time subscriptions
- Data backfill scripts
- Prisma schema file
- Automated tests
- SQL migration files

**Phase 3C / pre-beta (designed but not in initial migration):**

- `audit_logs` table and audit event emission from write paths
