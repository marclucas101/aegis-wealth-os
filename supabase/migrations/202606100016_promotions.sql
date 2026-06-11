-- Promotions: adviser-curated client opportunities
-- Server writes use service role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- promotions table
-- ---------------------------------------------------------------------------
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT NOT NULL,
  details TEXT,
  category TEXT NOT NULL,
  cta_label TEXT,
  cta_url TEXT,
  image_url TEXT,
  attachment_url TEXT,
  audience TEXT NOT NULL DEFAULT 'all_users',
  status TEXT NOT NULL DEFAULT 'draft',
  priority INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promotions_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT promotions_audience_check
    CHECK (audience IN ('all_users'))
);

CREATE INDEX promotions_status_priority_idx
  ON promotions (status, priority DESC, created_at DESC);

CREATE INDEX promotions_ends_at_idx
  ON promotions (ends_at)
  WHERE status = 'published';

COMMENT ON TABLE promotions IS
  'Adviser-curated client opportunities, campaigns, and planning highlights.';

COMMENT ON COLUMN promotions.details IS
  'Optional JSON: { "highlights": string[], "eligibility": string }';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE TRIGGER promotions_set_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Authenticated clients: published promotions within active date range
CREATE POLICY promotions_select_published_active
  ON promotions FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

-- Advisers and admins: read all promotions for management
CREATE POLICY promotions_select_advisor
  ON promotions FOR SELECT
  TO authenticated
  USING (is_advisor());

CREATE POLICY promotions_insert_advisor
  ON promotions FOR INSERT
  TO authenticated
  WITH CHECK (
    is_advisor()
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY promotions_update_advisor
  ON promotions FOR UPDATE
  TO authenticated
  USING (is_advisor())
  WITH CHECK (is_advisor());

CREATE POLICY promotions_delete_advisor
  ON promotions FOR DELETE
  TO authenticated
  USING (is_advisor());

-- ---------------------------------------------------------------------------
-- promotion-assets storage bucket (private — signed URLs via service role)
-- Path convention: {created_by}/promotions/{promotion_id}/{filename}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promotion-assets',
  'promotion-assets',
  false,
  10485760,  -- 10 MiB per file
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
