-- Adviser public presentation profiles and photo storage (Phase 6C)
-- Canonical contact fields remain on public.users (full_name, phone, organisation).

-- ---------------------------------------------------------------------------
-- adviser_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE adviser_profiles (
  adviser_user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name          TEXT,
  photo_storage_path    TEXT,
  professional_title    TEXT,
  representing_insurer  TEXT,
  short_bio             TEXT,
  years_experience      INTEGER,
  calendar_connected    BOOLEAN NOT NULL DEFAULT false,
  booking_enabled       BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT adviser_profiles_years_experience_check
    CHECK (years_experience IS NULL OR years_experience >= 0)
);

CREATE TRIGGER adviser_profiles_set_updated_at
  BEFORE UPDATE ON adviser_profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE adviser_profiles IS
  'Adviser-facing public presentation fields; contact basics stay on users.';

COMMENT ON COLUMN adviser_profiles.photo_storage_path IS
  'Private storage path in adviser-photos bucket; served via signed URLs.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE adviser_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY adviser_profiles_select_own_assigned_or_admin
  ON adviser_profiles FOR SELECT
  TO authenticated
  USING (
    adviser_user_id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.user_id = auth.uid()
        AND c.advisor_user_id = adviser_profiles.adviser_user_id
    )
  );

CREATE POLICY adviser_profiles_insert_own_or_admin
  ON adviser_profiles FOR INSERT
  TO authenticated
  WITH CHECK (adviser_user_id = auth.uid() OR is_admin());

CREATE POLICY adviser_profiles_update_own_or_admin
  ON adviser_profiles FOR UPDATE
  TO authenticated
  USING (adviser_user_id = auth.uid() OR is_admin())
  WITH CHECK (adviser_user_id = auth.uid() OR is_admin());

CREATE POLICY adviser_profiles_delete_admin
  ON adviser_profiles FOR DELETE
  TO authenticated
  USING (is_admin());

-- ---------------------------------------------------------------------------
-- adviser-photos storage bucket
-- Path convention: {adviser_user_id}/profile/{filename}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'adviser-photos',
  'adviser-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION adviser_id_from_storage_path(p_path TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(p_path, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(p_path, '/', 1)::uuid
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION adviser_id_from_storage_path(TEXT) IS
  'Parses adviser_user_id from adviser-photos path prefix.';

GRANT EXECUTE ON FUNCTION adviser_id_from_storage_path(TEXT) TO authenticated, service_role;

CREATE POLICY adviser_photos_select_own_or_admin
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'adviser-photos'
    AND adviser_id_from_storage_path(name) = auth.uid()
  );

CREATE POLICY adviser_photos_insert_own
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'adviser-photos'
    AND is_advisor()
    AND adviser_id_from_storage_path(name) = auth.uid()
  );

CREATE POLICY adviser_photos_update_own
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'adviser-photos'
    AND is_advisor()
    AND adviser_id_from_storage_path(name) = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'adviser-photos'
    AND is_advisor()
    AND adviser_id_from_storage_path(name) = auth.uid()
  );

CREATE POLICY adviser_photos_delete_own
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'adviser-photos'
    AND is_advisor()
    AND adviser_id_from_storage_path(name) = auth.uid()
  );
