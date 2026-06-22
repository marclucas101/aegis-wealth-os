-- Read-only verification for 202606100019_adviser_profiles.sql
-- Safe when adviser_profiles, storage tables, function, trigger, or policies are absent.
-- No writes. No DDL.

-- =============================================================================
-- 1) Expected-object matrix (absence returns rows, never exceptions)
-- =============================================================================
WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('table','public','adviser_profiles',NULL),
    ('column','public','adviser_profiles','adviser_user_id'),
    ('column','public','adviser_profiles','display_name'),
    ('column','public','adviser_profiles','photo_storage_path'),
    ('column','public','adviser_profiles','professional_title'),
    ('column','public','adviser_profiles','representing_insurer'),
    ('column','public','adviser_profiles','short_bio'),
    ('column','public','adviser_profiles','years_experience'),
    ('column','public','adviser_profiles','calendar_connected'),
    ('column','public','adviser_profiles','booking_enabled'),
    ('column','public','adviser_profiles','created_at'),
    ('column','public','adviser_profiles','updated_at'),
    ('constraint','public','adviser_profiles','adviser_profiles_years_experience_check'),
    ('trigger','public','adviser_profiles','adviser_profiles_set_updated_at'),
    ('policy','public','adviser_profiles','adviser_profiles_select_own_assigned_or_admin'),
    ('policy','public','adviser_profiles','adviser_profiles_insert_own_or_admin'),
    ('policy','public','adviser_profiles','adviser_profiles_update_own_or_admin'),
    ('policy','public','adviser_profiles','adviser_profiles_delete_admin'),
    ('function','public',NULL,'adviser_id_from_storage_path'),
    ('table','storage','buckets',NULL),
    ('table','storage','objects',NULL),
    ('policy','storage','objects','adviser_photos_select_own_or_admin'),
    ('policy','storage','objects','adviser_photos_insert_own'),
    ('policy','storage','objects','adviser_photos_update_own'),
    ('policy','storage','objects','adviser_photos_delete_own'),
    ('seed_row','storage','buckets','adviser-photos'),
    ('grant','public',NULL,'adviser_id_from_storage_path')
  ) AS expected(
    expected_check_kind,
    expected_schema_name,
    expected_relation_name,
    expected_object_name
  )
),
table_presence AS (
  SELECT
    n.nspname AS actual_schema_name,
    c.relname AS actual_relation_name,
    true AS is_present
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
),
column_presence AS (
  SELECT
    cols.table_schema AS actual_schema_name,
    cols.table_name AS actual_relation_name,
    cols.column_name AS actual_object_name,
    true AS is_present
  FROM information_schema.columns cols
),
constraint_presence AS (
  SELECT
    n.nspname AS actual_schema_name,
    rel.relname AS actual_relation_name,
    con.conname AS actual_object_name,
    true AS is_present
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
),
trigger_presence AS (
  SELECT
    n.nspname AS actual_schema_name,
    rel.relname AS actual_relation_name,
    tg.tgname AS actual_object_name,
    true AS is_present
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE NOT tg.tgisinternal
),
policy_presence AS (
  SELECT
    pol.schemaname AS actual_schema_name,
    pol.tablename AS actual_relation_name,
    pol.policyname AS actual_object_name,
    true AS is_present
  FROM pg_policies pol
),
function_presence AS (
  SELECT
    n.nspname AS actual_schema_name,
    p.proname AS actual_object_name,
    true AS is_present
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
),
grant_presence AS (
  SELECT
    priv.routine_schema AS actual_schema_name,
    priv.routine_name AS actual_object_name,
    true AS is_present
  FROM information_schema.routine_privileges priv
  GROUP BY priv.routine_schema, priv.routine_name
),
resolved AS (
  SELECT
    e.expected_check_kind,
    e.expected_schema_name,
    e.expected_relation_name,
    e.expected_object_name,
    COALESCE(e.expected_schema_name || '.', '')
      || COALESCE(e.expected_relation_name, e.expected_object_name) AS expected_object,
    CASE
      WHEN e.expected_check_kind = 'seed_row' THEN NULL::boolean
      WHEN e.expected_check_kind = 'table' THEN tp.is_present
      WHEN e.expected_check_kind = 'column' THEN cp.is_present
      WHEN e.expected_check_kind = 'constraint' THEN csp.is_present
      WHEN e.expected_check_kind = 'trigger' THEN trp.is_present
      WHEN e.expected_check_kind = 'policy' THEN pp.is_present
      WHEN e.expected_check_kind = 'function' THEN fp.is_present
      WHEN e.expected_check_kind = 'grant' THEN gp.is_present
      ELSE NULL::boolean
    END AS is_present
  FROM expected_checks e
  LEFT JOIN table_presence tp
    ON e.expected_check_kind = 'table'
   AND tp.actual_schema_name = e.expected_schema_name
   AND tp.actual_relation_name = e.expected_relation_name
  LEFT JOIN column_presence cp
    ON e.expected_check_kind = 'column'
   AND cp.actual_schema_name = e.expected_schema_name
   AND cp.actual_relation_name = e.expected_relation_name
   AND cp.actual_object_name = e.expected_object_name
  LEFT JOIN constraint_presence csp
    ON e.expected_check_kind = 'constraint'
   AND csp.actual_schema_name = e.expected_schema_name
   AND csp.actual_relation_name = e.expected_relation_name
   AND csp.actual_object_name = e.expected_object_name
  LEFT JOIN trigger_presence trp
    ON e.expected_check_kind = 'trigger'
   AND trp.actual_schema_name = e.expected_schema_name
   AND trp.actual_relation_name = e.expected_relation_name
   AND trp.actual_object_name = e.expected_object_name
  LEFT JOIN policy_presence pp
    ON e.expected_check_kind = 'policy'
   AND pp.actual_schema_name = e.expected_schema_name
   AND pp.actual_relation_name = e.expected_relation_name
   AND pp.actual_object_name = e.expected_object_name
  LEFT JOIN function_presence fp
    ON e.expected_check_kind = 'function'
   AND fp.actual_schema_name = e.expected_schema_name
   AND fp.actual_object_name = e.expected_object_name
  LEFT JOIN grant_presence gp
    ON e.expected_check_kind = 'grant'
   AND gp.actual_schema_name = e.expected_schema_name
   AND gp.actual_object_name = e.expected_object_name
)
SELECT
  r.expected_check_kind AS check_kind,
  r.expected_schema_name,
  r.expected_relation_name,
  r.expected_object_name,
  r.expected_object,
  r.is_present AS present,
  CASE
    WHEN r.expected_check_kind = 'seed_row' THEN 'unknown'
    WHEN COALESCE(r.is_present, false) THEN 'present'
    ELSE 'absent'
  END AS state,
  CASE
    WHEN r.expected_check_kind = 'seed_row' THEN 'Run Section 2 probe only if storage.buckets exists.'
    ELSE 'Catalog check'
  END AS detail
FROM resolved r
ORDER BY r.expected_check_kind, r.expected_object;

-- =============================================================================
-- 2) Seed-row probe SQL text (not executed automatically)
-- =============================================================================
SELECT
  'seed_row:storage.buckets/adviser-photos' AS check_id,
  EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'buckets' AND c.relkind IN ('r', 'p')
  ) AS relation_exists,
  $$SELECT id, name, public, file_size_limit, allowed_mime_types
    FROM storage.buckets
    WHERE id = 'adviser-photos';$$ AS probe_sql;

-- =============================================================================
-- 3) Rollup
-- =============================================================================
WITH rollup_checks AS (
  SELECT * FROM (VALUES
    ('table', EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'adviser_profiles'
    )),
    ('trigger', EXISTS (
      SELECT 1 FROM pg_trigger tg
      JOIN pg_class rel ON rel.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'adviser_profiles'
        AND tg.tgname = 'adviser_profiles_set_updated_at'
        AND NOT tg.tgisinternal
    )),
    ('function', EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'adviser_id_from_storage_path'
    )),
    ('policy_group', (
      SELECT COUNT(*) = 4 FROM pg_policies pol
      WHERE pol.schemaname = 'public' AND pol.tablename = 'adviser_profiles'
        AND pol.policyname IN (
          'adviser_profiles_select_own_assigned_or_admin',
          'adviser_profiles_insert_own_or_admin',
          'adviser_profiles_update_own_or_admin',
          'adviser_profiles_delete_admin'
        )
    )),
    ('storage_policy_group', (
      SELECT COUNT(*) = 4 FROM pg_policies pol
      WHERE pol.schemaname = 'storage' AND pol.tablename = 'objects'
        AND pol.policyname LIKE 'adviser_photos_%'
    )),
    ('grant', EXISTS (
      SELECT 1 FROM information_schema.routine_privileges priv
      WHERE priv.routine_schema = 'public'
        AND priv.routine_name = 'adviser_id_from_storage_path'
    ))
  ) AS rollup(check_group, is_present)
)
SELECT
  rc.check_group,
  rc.is_present AS present,
  CASE WHEN rc.is_present THEN 'present' ELSE 'absent' END AS state
FROM rollup_checks rc
ORDER BY rc.check_group;
