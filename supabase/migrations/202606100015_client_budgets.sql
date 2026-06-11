-- client_budgets — Budget Allocation Optimiser account persistence
-- One current row per client; prior rows retained as history (is_current = false).

CREATE TABLE client_budgets (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id               UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_current              BOOLEAN NOT NULL DEFAULT true,
  archetype               TEXT NOT NULL,
  age                     INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  monthly_income          NUMERIC(18, 2),
  currency                TEXT NOT NULL DEFAULT 'SGD',
  entries                 JSONB NOT NULL,
  analysis                JSONB NOT NULL,
  total_monthly_expense   NUMERIC(18, 2) NOT NULL,
  annual_expense          NUMERIC(18, 2) NOT NULL,
  expense_to_income_ratio NUMERIC(8, 4),
  savings_capacity        NUMERIC(18, 2),
  source_feature          TEXT NOT NULL DEFAULT 'budget_optimiser',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_client_budgets_current
  ON client_budgets (client_id)
  WHERE is_current = true;

CREATE INDEX idx_client_budgets_client_id ON client_budgets (client_id);
CREATE INDEX idx_client_budgets_owner_user_id ON client_budgets (owner_user_id);
CREATE INDEX idx_client_budgets_created_at ON client_budgets (created_at DESC);
CREATE INDEX idx_client_budgets_entries_gin ON client_budgets USING GIN (entries);

CREATE TRIGGER client_budgets_set_updated_at
  BEFORE UPDATE ON client_budgets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE client_budgets IS 'Budget Allocation Optimiser profiles and analysis snapshots per client.';

-- ===========================================================================
-- RLS (mirrors discover_profiles)
-- ===========================================================================
ALTER TABLE client_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY client_budgets_select_owner
  ON client_budgets FOR SELECT
  TO authenticated
  USING (owns_client(client_id) OR is_admin());

CREATE POLICY client_budgets_insert_owner_or_advisor
  ON client_budgets FOR INSERT
  TO authenticated
  WITH CHECK (owns_client(client_id) OR is_assigned_advisor(client_id));

CREATE POLICY client_budgets_update_owner_or_advisor
  ON client_budgets FOR UPDATE
  TO authenticated
  USING (owns_client(client_id) OR is_assigned_advisor(client_id))
  WITH CHECK (owns_client(client_id) OR is_assigned_advisor(client_id));

CREATE POLICY client_budgets_delete_admin
  ON client_budgets FOR DELETE
  TO authenticated
  USING (is_admin());
