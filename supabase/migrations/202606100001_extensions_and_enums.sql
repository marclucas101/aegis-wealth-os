-- Phase 3A: extensions and enum types
-- Source: docs/database-schema.md §3

-- gen_random_uuid() (also available via pgcrypto)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
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
