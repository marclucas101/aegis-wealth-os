-- Adviser feedback and client prompt tracking
-- Server writes use service role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Prompt tracking on clients (one client row per user in MVP)
-- ---------------------------------------------------------------------------
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS feedback_prompted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS feedback_prompt_dismissed_at TIMESTAMPTZ;

COMMENT ON COLUMN clients.feedback_prompted_at IS
  'When the adviser feedback prompt was last shown to the client.';
COMMENT ON COLUMN clients.feedback_submitted_at IS
  'When the client submitted adviser feedback; suppresses future prompts.';
COMMENT ON COLUMN clients.feedback_prompt_dismissed_at IS
  'When the client dismissed the feedback prompt (Maybe later).';

-- ---------------------------------------------------------------------------
-- adviser_feedback
-- ---------------------------------------------------------------------------
CREATE TABLE adviser_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  adviser_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating_overall INTEGER NOT NULL,
  rating_clarity INTEGER,
  rating_responsiveness INTEGER,
  rating_trust INTEGER,
  rating_professionalism INTEGER,
  feedback_text TEXT,
  what_went_well TEXT,
  what_could_improve TEXT,
  permission_to_use_as_testimonial BOOLEAN NOT NULL DEFAULT false,
  testimonial_display_name TEXT,
  testimonial_anonymous BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'submitted',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adviser_feedback_rating_overall_check
    CHECK (rating_overall BETWEEN 1 AND 5),
  CONSTRAINT adviser_feedback_rating_clarity_check
    CHECK (rating_clarity IS NULL OR rating_clarity BETWEEN 1 AND 5),
  CONSTRAINT adviser_feedback_rating_responsiveness_check
    CHECK (rating_responsiveness IS NULL OR rating_responsiveness BETWEEN 1 AND 5),
  CONSTRAINT adviser_feedback_rating_trust_check
    CHECK (rating_trust IS NULL OR rating_trust BETWEEN 1 AND 5),
  CONSTRAINT adviser_feedback_rating_professionalism_check
    CHECK (rating_professionalism IS NULL OR rating_professionalism BETWEEN 1 AND 5),
  CONSTRAINT adviser_feedback_status_check
    CHECK (status IN ('submitted', 'reviewed', 'approved_testimonial', 'archived'))
);

CREATE INDEX adviser_feedback_adviser_user_id_idx
  ON adviser_feedback (adviser_user_id, created_at DESC);

CREATE INDEX adviser_feedback_client_user_id_idx
  ON adviser_feedback (client_user_id);

CREATE INDEX adviser_feedback_status_idx
  ON adviser_feedback (status, created_at DESC);

CREATE TRIGGER adviser_feedback_set_updated_at
  BEFORE UPDATE ON adviser_feedback
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE adviser_feedback IS
  'Client feedback on assigned adviser relationships; testimonial use requires explicit consent.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE adviser_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY adviser_feedback_select_own
  ON adviser_feedback FOR SELECT
  TO authenticated
  USING (client_user_id = auth.uid());

CREATE POLICY adviser_feedback_select_adviser_or_admin
  ON adviser_feedback FOR SELECT
  TO authenticated
  USING (adviser_user_id = auth.uid() OR is_admin());

CREATE POLICY adviser_feedback_insert_own
  ON adviser_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    client_user_id = auth.uid()
    AND client_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = client_id
        AND c.user_id = auth.uid()
        AND c.advisor_user_id IS NOT DISTINCT FROM adviser_user_id
    )
  );

CREATE POLICY adviser_feedback_update_admin
  ON adviser_feedback FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY adviser_feedback_delete_admin
  ON adviser_feedback FOR DELETE
  TO authenticated
  USING (is_admin());
