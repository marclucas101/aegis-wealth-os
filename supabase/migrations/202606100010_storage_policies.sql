-- Phase 3A: client-documents storage bucket and RLS policies
-- Source: docs/database-schema.md §9.3
-- Path convention: {client_id}/{uuid}/{file_name}

-- ---------------------------------------------------------------------------
-- Extract client_id from storage object path (first path segment)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION client_id_from_storage_path(p_path TEXT)
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

COMMENT ON FUNCTION client_id_from_storage_path(TEXT) IS
  'Parses client_id from storage path prefix {client_id}/….';

GRANT EXECUTE ON FUNCTION client_id_from_storage_path(TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bucket (private — access via RLS only)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  52428800,  -- 50 MiB per file
  NULL       -- allow all mime types; tighten in Phase 3B if needed
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- ---------------------------------------------------------------------------
-- storage.objects policies
-- ---------------------------------------------------------------------------

-- SELECT: client owner or assigned advisor may read files under their client prefix
CREATE POLICY client_documents_select_owner
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND client_id_from_storage_path(name) IS NOT NULL
    AND owns_client(client_id_from_storage_path(name))
  );

-- INSERT: upload into own client folder
CREATE POLICY client_documents_insert_owner
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND client_id_from_storage_path(name) IS NOT NULL
    AND owns_client(client_id_from_storage_path(name))
  );

-- UPDATE: replace metadata or overwrite within own client folder
CREATE POLICY client_documents_update_owner
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND client_id_from_storage_path(name) IS NOT NULL
    AND owns_client(client_id_from_storage_path(name))
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND client_id_from_storage_path(name) IS NOT NULL
    AND owns_client(client_id_from_storage_path(name))
  );

-- DELETE: assigned advisor or admin only
CREATE POLICY client_documents_delete_advisor_or_admin
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND client_id_from_storage_path(name) IS NOT NULL
    AND (
      is_assigned_advisor(client_id_from_storage_path(name))
      OR is_admin()
    )
  );
