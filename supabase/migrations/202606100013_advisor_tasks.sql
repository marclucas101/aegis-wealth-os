-- Phase 4I: advisor task system
-- Server API manages writes via service role; RLS restricts direct client access.

CREATE TABLE advisor_tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  task_type           TEXT NOT NULL DEFAULT 'general',
  priority            TEXT NOT NULL DEFAULT 'medium',
  status              TEXT NOT NULL DEFAULT 'open',
  due_date            DATE,
  completed_at        TIMESTAMPTZ,
  related_entity_type TEXT,
  related_entity_id   UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT advisor_tasks_task_type_check CHECK (
    task_type IN ('general', 'review', 'follow_up', 'document', 'roadmap', 'risk')
  ),
  CONSTRAINT advisor_tasks_priority_check CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  CONSTRAINT advisor_tasks_status_check CHECK (
    status IN ('open', 'in_progress', 'completed', 'cancelled')
  )
);

CREATE INDEX idx_advisor_tasks_client_id ON advisor_tasks (client_id)
  WHERE client_id IS NOT NULL;
CREATE INDEX idx_advisor_tasks_assigned_to ON advisor_tasks (assigned_to_user_id);
CREATE INDEX idx_advisor_tasks_created_by ON advisor_tasks (created_by_user_id);
CREATE INDEX idx_advisor_tasks_status ON advisor_tasks (status);
CREATE INDEX idx_advisor_tasks_due_date ON advisor_tasks (due_date)
  WHERE due_date IS NOT NULL;
CREATE INDEX idx_advisor_tasks_open_due ON advisor_tasks (due_date, priority)
  WHERE status IN ('open', 'in_progress');

CREATE TRIGGER advisor_tasks_set_updated_at
  BEFORE UPDATE ON advisor_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE advisor_tasks IS 'Advisor/admin tasks linked to clients, reviews, documents, or general follow-ups.';

ALTER TABLE advisor_tasks ENABLE ROW LEVEL SECURITY;

-- Read-only policies for authenticated roles. Writes go through server API (service role).
CREATE POLICY advisor_tasks_select_visible
  ON advisor_tasks FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR assigned_to_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
    OR (
      client_id IS NOT NULL
      AND is_assigned_advisor(client_id)
    )
  );
