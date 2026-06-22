-- Read-only verification for migration 202606100019_adviser_profiles.sql
-- Run against the linked remote (SQL Editor or psql read-only role).
-- Performs NO writes. Does NOT modify supabase_migrations.schema_migrations.

-- =============================================================================
-- 1. Migration history row (informational only — not a schema object)
-- =============================================================================
SELECT
  'migration_history' AS check_category,
  '202606100019_adviser_profiles.sql' AS expected_name,
  EXISTS (
    SELECT 1
    FROM supabase_migrations.schema_migrations sm
    WHERE sm.version = '202606100019'
       OR sm.name ILIKE '%adviser_profiles%'
  ) AS present_in_history,
  (
    SELECT sm.version
    FROM supabase_migrations.schema_migrations sm
    WHERE sm.version = '202606100019'
    LIMIT 1
  ) AS history_version,
  'INFO' AS severity;

-- =============================================================================
-- 2. adviser_profiles table — columns, types, nullability, defaults
-- =============================================================================
WITH expected_columns AS (
  SELECT * FROM (VALUES
    ('adviser_user_id',       'uuid',        'NO',  NULL),
    ('display_name',          'text',        'YES', NULL),
    ('photo_storage_path',    'text',        'YES', NULL),
    ('professional_title',    'text',        'YES', NULL),
    ('representing_insurer',  'text',        'YES', NULL),
    ('short_bio',             'text',        'YES', NULL),
    ('years_experience',      'integer',     'YES', NULL),
    ('calendar_connected',    'boolean',     'NO',  'false'),
    ('booking_enabled',       'boolean',     'NO',  'false'),
    ('created_at',            'timestamptz', 'NO',  'now()'),
    ('updated_at',            'timestamptz', 'NO',  'now()')
  ) AS t(column_name, expected_type, expected_nullable, expected_default_fragment)
),
actual_columns AS (
  SELECT
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'adviser_profiles'
)
SELECT
  'column' AS check_category,
  e.column_name AS object_name,
  (a.column_name IS NOT NULL) AS present,
  CASE
    WHEN a.column_name IS NULL THEN 'ABSENT'
    WHEN a.is_nullable <> e.expected_nullable THEN 'CONFLICTING'
    WHEN a.udt_name <> e.expected_type AND a.data_type <> e.expected_type THEN 'CONFLICTING'
  ELSE 'MATCH'
  END AS match_status,
  e.expected_type AS expected,
  COALESCE(a.udt_name, a.data_type, 'MISSING') AS actual,
  a.is_nullable AS actual_nullable,
  a.column_default AS actual_default
FROM expected_columns e
LEFT JOIN actual_columns a ON a.column_name = e.column_name
ORDER BY e.column_name;

-- =============================================================================
-- 3. Primary key and foreign keys
-- =============================================================================
SELECT
  'primary_key' AS check_category,
  'adviser_profiles_pkey' AS object_name,
  EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'adviser_profiles'
      AND con.contype = 'p'
  ) AS present,
  (
    SELECT string_agg(a.attname, ', ' ORDER BY u.ord)
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) WITH ORDINALITY u(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = u.attnum
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'adviser_profiles'
      AND con.contype = 'p'
  ) AS actual_pk_columns;

SELECT
  'foreign_key' AS check_category,
  con.conname AS object_name,
  true AS present,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'adviser_profiles'
  AND con.contype = 'f';

-- =============================================================================
-- 4. Check constraints
-- =============================================================================
SELECT
  'check_constraint' AS check_category,
  con.conname AS object_name,
  true AS present,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'adviser_profiles'
  AND con.contype = 'c'
  AND con.conname = 'adviser_profiles_years_experience_check';

-- =============================================================================
-- 5. Triggers
-- =============================================================================
SELECT
  'trigger' AS check_category,
  tg.tgname AS object_name,
  true AS present,
  pg_get_triggerdef(tg.oid) AS definition
FROM pg_trigger tg
JOIN pg_class rel ON rel.oid = tg.tgrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND rel.relname = 'adviser_profiles'
  AND NOT tg.tgisinternal
  AND tg.tgname = 'adviser_profiles_set_updated_at';

-- =============================================================================
-- 6. RLS enabled and policies
-- =============================================================================
SELECT
  'rls_enabled' AS check_category,
  'adviser_profiles' AS object_name,
  c.relrowsecurity AS present,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
WHERE nsp.nspname = 'public'
  AND c.relname = 'adviser_profiles';

WITH expected_policies AS (
  SELECT unnest(ARRAY[
    'adviser_profiles_select_own_assigned_or_admin',
    'adviser_profiles_insert_own_or_admin',
    'adviser_profiles_update_own_or_admin',
    'adviser_profiles_delete_admin'
  ]) AS policy_name
)
SELECT
  'rls_policy' AS check_category,
  e.policy_name AS object_name,
  (p.policyname IS NOT NULL) AS present,
  p.cmd AS actual_cmd,
  p.roles::text AS actual_roles
FROM expected_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = 'adviser_profiles'
 AND p.policyname = e.policy_name
ORDER BY e.policy_name;

-- =============================================================================
-- 7. Storage bucket adviser-photos
-- =============================================================================
SELECT
  'storage_bucket' AS check_category,
  'adviser-photos' AS object_name,
  EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = 'adviser-photos') AS present,
  (SELECT b.public FROM storage.buckets b WHERE b.id = 'adviser-photos') AS is_public,
  (SELECT b.file_size_limit FROM storage.buckets b WHERE b.id = 'adviser-photos') AS file_size_limit,
  (SELECT b.allowed_mime_types FROM storage.buckets b WHERE b.id = 'adviser-photos') AS allowed_mime_types;

-- =============================================================================
-- 8. Helper function adviser_id_from_storage_path
-- =============================================================================
SELECT
  'function' AS check_category,
  'adviser_id_from_storage_path(text)' AS object_name,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'adviser_id_from_storage_path'
  ) AS present,
  (
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'adviser_id_from_storage_path'
    LIMIT 1
  ) AS definition;

-- =============================================================================
-- 9. Storage policies on storage.objects for adviser-photos
-- =============================================================================
WITH expected_storage_policies AS (
  SELECT unnest(ARRAY[
    'adviser_photos_select_own_or_admin',
    'adviser_photos_insert_own',
    'adviser_photos_update_own',
    'adviser_photos_delete_own'
  ]) AS policy_name
)
SELECT
  'storage_policy' AS check_category,
  e.policy_name AS object_name,
  (p.policyname IS NOT NULL) AS present,
  p.cmd AS actual_cmd
FROM expected_storage_policies e
LEFT JOIN pg_policies p
  ON p.schemaname = 'storage'
 AND p.tablename = 'objects'
 AND p.policyname = e.policy_name
ORDER BY e.policy_name;

-- =============================================================================
-- 10. Function grants (no secret values)
-- =============================================================================
SELECT
  'grant' AS check_category,
  routine_name AS object_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'adviser_id_from_storage_path'
ORDER BY grantee, privilege_type;

-- =============================================================================
-- 11. Summary rollup (comparison-friendly)
-- =============================================================================
SELECT
  check_category,
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE present) AS present_count,
  COUNT(*) FILTER (WHERE NOT present) AS absent_count
FROM (
  SELECT 'table' AS check_category, EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adviser_profiles'
  ) AS present
  UNION ALL
  SELECT 'rls_policy', (COUNT(*) = 4)
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'adviser_profiles'
    AND policyname IN (
      'adviser_profiles_select_own_assigned_or_admin',
      'adviser_profiles_insert_own_or_admin',
      'adviser_profiles_update_own_or_admin',
      'adviser_profiles_delete_admin'
    )
  UNION ALL
  SELECT 'storage_bucket', EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'adviser-photos')
  UNION ALL
  SELECT 'storage_policy', (COUNT(*) = 4)
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname LIKE 'adviser_photos_%'
  UNION ALL
  SELECT 'function', EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'adviser_id_from_storage_path'
  )
  UNION ALL
  SELECT 'trigger', EXISTS (
    SELECT 1 FROM pg_trigger tg
    JOIN pg_class rel ON rel.oid = tg.tgrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'adviser_profiles'
      AND tg.tgname = 'adviser_profiles_set_updated_at' AND NOT tg.tgisinternal
  )
) summary
GROUP BY check_category
ORDER BY check_category;
