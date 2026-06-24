-- Discrepancy checks for 202606200012 vs expected Phase 9F.4 idempotency contract.
-- Returns check_id, expected, observed, classification (match|conflicting|unknown).

WITH refs AS (
  SELECT
    to_regclass('public.platform_feature_controls') IS NOT NULL AS fc_exists,
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations'
    ) AS history_exists
),
expected AS (
  SELECT *
  FROM (VALUES
    ('202606200012', 'history', 'schema_migrations.202606200012', 'applied'),
    ('202606200012', 'routine', 'legacy_promotion_migration_destination_id', 'present'),
    ('202606200012', 'routine', 'execute_legacy_promotion_migration', 'present'),
    ('202606200012', 'routine_attr', 'execute_legacy_promotion_migration', 'security_definer|true'),
    ('202606200012', 'routine_attr', 'execute_legacy_promotion_migration', 'search_path|public'),
    ('202606200012', 'extension', 'extensions.uuid_generate_v5(uuid,text)', 'callable'),
    ('202606200012', 'routine_attr', 'legacy_promotion_migration_destination_id', 'uses_extensions_uuid_v5|true'),
    ('202606200012', 'grant', 'execute_legacy_promotion_migration.service_role', 'execute|true'),
    ('202606200012', 'grant', 'execute_legacy_promotion_migration.anon', 'execute|false'),
    ('202606200012', 'grant', 'execute_legacy_promotion_migration.authenticated', 'execute|false'),
    ('202606200012', 'seed_attr', 'platform_feature_controls.legacy_promotions_write', 'enabled|false')
  ) AS t(migration, check_kind, object_name, expected_value)
),
history_applied AS (
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200012'
  ) AS applied
  WHERE (SELECT history_exists FROM refs)
),
destination_fn AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'legacy_promotion_migration_destination_id'
        AND pg_get_function_identity_arguments(p.oid) = 'p_promotion_id uuid'
    ) AS present,
    (
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'legacy_promotion_migration_destination_id'
        AND pg_get_function_identity_arguments(p.oid) = 'p_promotion_id uuid'
      LIMIT 1
    ) AS definition
),
migration_rpc AS (
  SELECT
    p.oid,
    p.prosecdef,
    p.proconfig
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_legacy_promotion_migration'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_promotion_id uuid, p_classification text, p_reviewer_user_id uuid, p_notes text, p_title text, p_summary text, p_body text, p_category text, p_content_type text, p_audience_scope text, p_external_url text, p_expires_at timestamp with time zone, p_adviser_user_id uuid'
  LIMIT 1
),
grant_flags AS (
  SELECT
    COALESCE(bool_or(r.rolname = 'service_role'), false) AS service_role_execute,
    COALESCE(bool_or(r.rolname = 'anon'), false) AS anon_execute,
    COALESCE(bool_or(r.rolname = 'authenticated'), false) AS authenticated_execute
  FROM migration_rpc m
  JOIN pg_proc p ON p.oid = m.oid
  LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl ON true
  LEFT JOIN pg_roles r ON r.oid = acl.grantee
  WHERE acl.privilege_type = 'EXECUTE'
),
write_freeze AS (
  SELECT enabled
  FROM platform_feature_controls
  WHERE feature_key = 'legacy_promotions_write'
  LIMIT 1
),
evaluated AS (
  SELECT
    e.check_id,
    e.expected_value AS expected,
    CASE
      WHEN e.check_kind = 'history' AND e.object_name = 'schema_migrations.202606200012'
        THEN CASE WHEN (SELECT applied FROM history_applied) THEN 'applied' ELSE 'absent' END
      WHEN e.check_kind = 'routine' AND e.object_name = 'legacy_promotion_migration_destination_id'
        THEN CASE WHEN (SELECT present FROM destination_fn) THEN 'present' ELSE 'absent' END
      WHEN e.check_kind = 'routine' AND e.object_name = 'execute_legacy_promotion_migration'
        THEN CASE WHEN (SELECT oid FROM migration_rpc) IS NOT NULL THEN 'present' ELSE 'absent' END
      WHEN e.check_kind = 'routine_attr' AND e.expected_value = 'security_definer|true'
        THEN CASE WHEN (SELECT prosecdef FROM migration_rpc) IS TRUE THEN 'security_definer|true' ELSE 'security_definer|false' END
      WHEN e.check_kind = 'routine_attr' AND e.expected_value = 'search_path|public'
        THEN CASE
          WHEN EXISTS (
            SELECT 1
            FROM unnest(COALESCE((SELECT proconfig FROM migration_rpc), ARRAY[]::text[])) AS cfg
            WHERE cfg = 'search_path=public'
          ) THEN 'search_path|public'
          ELSE 'search_path|other'
        END
      WHEN e.check_kind = 'extension' AND e.object_name = 'extensions.uuid_generate_v5(uuid,text)'
        THEN CASE
          WHEN to_regprocedure('extensions.uuid_generate_v5(uuid,text)') IS NOT NULL THEN 'callable'
          ELSE 'absent'
        END
      WHEN e.check_kind = 'routine_attr' AND e.object_name = 'legacy_promotion_migration_destination_id'
        AND e.expected_value = 'uses_extensions_uuid_v5|true'
        THEN CASE
          WHEN (SELECT definition FROM destination_fn) ILIKE '%extensions.uuid_generate_v5%' THEN 'uses_extensions_uuid_v5|true'
          ELSE 'uses_extensions_uuid_v5|false'
        END
      WHEN e.check_kind = 'grant' AND e.object_name = 'execute_legacy_promotion_migration.service_role'
        THEN CASE WHEN (SELECT service_role_execute FROM grant_flags) THEN 'execute|true' ELSE 'execute|false' END
      WHEN e.check_kind = 'grant' AND e.object_name = 'execute_legacy_promotion_migration.anon'
        THEN CASE WHEN (SELECT anon_execute FROM grant_flags) THEN 'execute|true' ELSE 'execute|false' END
      WHEN e.check_kind = 'grant' AND e.object_name = 'execute_legacy_promotion_migration.authenticated'
        THEN CASE WHEN (SELECT authenticated_execute FROM grant_flags) THEN 'execute|true' ELSE 'execute|false' END
      WHEN e.check_kind = 'seed_attr' AND e.expected_value = 'enabled|false'
        THEN CASE WHEN (SELECT enabled FROM write_freeze) IS FALSE THEN 'enabled|false' ELSE 'enabled|true' END
      ELSE 'unknown'
    END AS observed,
    CASE
      WHEN e.check_kind = 'history' AND (SELECT history_exists FROM refs) IS NOT TRUE THEN 'unknown'
      WHEN e.check_kind = 'history' AND (SELECT applied FROM history_applied) THEN 'match'
      WHEN e.check_kind = 'history' THEN 'conflicting'
      WHEN e.check_kind = 'routine' AND e.object_name = 'legacy_promotion_migration_destination_id'
        AND (SELECT present FROM destination_fn) THEN 'match'
      WHEN e.check_kind = 'routine' AND e.object_name = 'execute_legacy_promotion_migration'
        AND (SELECT oid FROM migration_rpc) IS NOT NULL THEN 'match'
      WHEN e.check_kind = 'routine' THEN 'conflicting'
      WHEN e.check_kind = 'routine_attr' AND e.expected_value = 'security_definer|true'
        AND (SELECT prosecdef FROM migration_rpc) IS TRUE THEN 'match'
      WHEN e.check_kind = 'routine_attr' AND e.expected_value = 'search_path|public'
        AND EXISTS (
          SELECT 1
          FROM unnest(COALESCE((SELECT proconfig FROM migration_rpc), ARRAY[]::text[])) AS cfg
          WHERE cfg = 'search_path=public'
        ) THEN 'match'
      WHEN e.check_kind = 'routine_attr' THEN 'conflicting'
      WHEN e.check_kind = 'extension' AND e.object_name = 'extensions.uuid_generate_v5(uuid,text)'
        AND to_regprocedure('extensions.uuid_generate_v5(uuid,text)') IS NOT NULL THEN 'match'
      WHEN e.check_kind = 'extension' THEN 'conflicting'
      WHEN e.check_kind = 'routine_attr' AND e.object_name = 'legacy_promotion_migration_destination_id'
        AND e.expected_value = 'uses_extensions_uuid_v5|true'
        AND (SELECT definition FROM destination_fn) ILIKE '%extensions.uuid_generate_v5%' THEN 'match'
      WHEN e.check_kind = 'grant' AND e.object_name = 'execute_legacy_promotion_migration.service_role'
        AND (SELECT service_role_execute FROM grant_flags) THEN 'match'
      WHEN e.check_kind = 'grant' AND e.object_name = 'execute_legacy_promotion_migration.anon'
        AND NOT (SELECT anon_execute FROM grant_flags) THEN 'match'
      WHEN e.check_kind = 'grant' AND e.object_name = 'execute_legacy_promotion_migration.authenticated'
        AND NOT (SELECT authenticated_execute FROM grant_flags) THEN 'match'
      WHEN e.check_kind = 'grant' THEN 'conflicting'
      WHEN e.check_kind = 'seed_attr' AND (SELECT fc_exists FROM refs) IS NOT TRUE THEN 'unknown'
      WHEN e.check_kind = 'seed_attr' AND (SELECT enabled FROM write_freeze) IS FALSE THEN 'match'
      WHEN e.check_kind = 'seed_attr' THEN 'conflicting'
      ELSE 'unknown'
    END AS classification
  FROM (
    SELECT
      migration || '.' || check_kind || '.' || object_name AS check_id,
      migration,
      check_kind,
      object_name,
      expected_value
    FROM expected
  ) e
)
SELECT check_id, expected, observed, classification
FROM evaluated
WHERE COALESCE(classification, 'unknown') <> 'match'
ORDER BY check_id;
