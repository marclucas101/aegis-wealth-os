-- Phase 4C: advisor note type classification
-- Source: Advisor Notes and Review Workflow

ALTER TABLE advisor_notes
  ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'general'
  CHECK (note_type IN ('general', 'meeting', 'follow_up', 'risk', 'review'));

CREATE INDEX IF NOT EXISTS idx_advisor_notes_note_type
  ON advisor_notes (client_id, note_type, created_at DESC);

COMMENT ON COLUMN advisor_notes.note_type IS
  'Advisor note category: general | meeting | follow_up | risk | review';
