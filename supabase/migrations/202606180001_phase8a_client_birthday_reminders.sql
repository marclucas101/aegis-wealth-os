-- Phase 8A: client birthday reminders
-- Canonical date_of_birth on clients; advisor_tasks extensions for idempotent reminders.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE clients
  ADD CONSTRAINT clients_date_of_birth_not_future
  CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE);

COMMENT ON COLUMN clients.date_of_birth IS
  'Client date of birth (calendar date, no timezone). Canonical source for birthday reminders.';

-- advisor_tasks: birthday task type, idempotency, lifecycle metadata
ALTER TABLE advisor_tasks
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE advisor_tasks
  DROP CONSTRAINT IF EXISTS advisor_tasks_task_type_check;

ALTER TABLE advisor_tasks
  ADD CONSTRAINT advisor_tasks_task_type_check CHECK (
    task_type IN (
      'general',
      'review',
      'follow_up',
      'document',
      'roadmap',
      'risk',
      'client_birthday'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_advisor_tasks_source_key_unique
  ON advisor_tasks (source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_advisor_tasks_birthday_open
  ON advisor_tasks (client_id, due_date)
  WHERE task_type = 'client_birthday' AND status IN ('open', 'in_progress');

COMMENT ON COLUMN advisor_tasks.source_key IS
  'Stable idempotency key, e.g. birthday:<client_id>:<birthday_year>.';
COMMENT ON COLUMN advisor_tasks.dismissed_at IS
  'When an adviser dismissed/cancelled a system-generated reminder.';
COMMENT ON COLUMN advisor_tasks.metadata IS
  'Structured task metadata (birthday_date, days_until, etc.).';
