-- Phase 3A: documents and advisor_notes
-- Source: docs/database-schema.md §5.12, §5.13

-- ---------------------------------------------------------------------------
-- documents — Document Vault metadata (files in Supabase Storage)
-- ---------------------------------------------------------------------------
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
  storage_path        TEXT NOT NULL,
  checksum_sha256     TEXT,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  reviewed_at         TIMESTAMPTZ,
  expires_at          DATE,
  is_archived         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

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

-- ---------------------------------------------------------------------------
-- advisor_notes — advisor annotations (Advisor OS placeholder)
-- ---------------------------------------------------------------------------
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

COMMENT ON TABLE documents IS 'Document vault metadata; blobs stored in client-documents bucket.';
COMMENT ON TABLE advisor_notes IS 'Advisor annotations for assigned clients.';
