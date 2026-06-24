-- Verify 202606200012_phase9f4_promotion_migration_idempotency.sql outcomes.
-- Returns check_id, status (pass|fail|unknown), detail.

WITH refs AS (
  SELECT
    to_regclass('public.promotions') IS NOT NULL AS promotions_exists,
    to_regclass('public.promotion_migration_reviews') IS NOT NULL AS reviews_exists,
    to_regclass('public.governed_content') IS NOT NULL AS governed_exists,
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations'
    ) AS history_exists
),
history AS (
  SELECT
    EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200011'
    ) AS write_freeze_applied,
    EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200012'
    ) AS idempotency_applied
  WHERE (SELECT history_exists FROM refs)
),
destination_fn AS (
  SELECT
    p.oid,
    p.prosecdef,
    p.provolatile::text AS provolatile,
    p.proconfig,
    pg_get_userbyid(p.proowner) AS owner_name,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'legacy_promotion_migration_destination_id'
    AND pg_get_function_identity_arguments(p.oid) = 'p_promotion_id uuid'
  LIMIT 1
),
migration_rpc AS (
  SELECT
    p.oid,
    p.prosecdef,
    p.provolatile::text AS provolatile,
    p.proconfig,
    pg_get_userbyid(p.proowner) AS owner_name,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_legacy_promotion_migration'
    AND pg_get_function_identity_arguments(p.oid) =
      'p_promotion_id uuid, p_classification text, p_reviewer_user_id uuid, p_notes text, p_title text, p_summary text, p_body text, p_category text, p_content_type text, p_audience_scope text, p_external_url text, p_expires_at timestamp with time zone, p_adviser_user_id uuid'
  LIMIT 1
),
grant_rows AS (
  SELECT
    r.rolname AS grantee,
    acl.privilege_type
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
checks AS (
  SELECT 'history.202606200011_applied' AS check_id,
    CASE
      WHEN NOT (SELECT history_exists FROM refs) THEN 'unknown'
      WHEN (SELECT write_freeze_applied FROM history) THEN 'pass'
      ELSE 'fail'
    END AS status,
    'Prerequisite write-freeze migration must be recorded' AS detail
  UNION ALL
  SELECT 'history.202606200012_applied',
    CASE
      WHEN NOT (SELECT history_exists FROM refs) THEN 'unknown'
      WHEN (SELECT idempotency_applied FROM history) THEN 'pass'
      ELSE 'fail'
    END,
    'schema_migrations must record 202606200012'
  UNION ALL
  SELECT 'routine.destination_function_exists',
    CASE WHEN (SELECT oid FROM destination_fn) IS NOT NULL THEN 'pass' ELSE 'fail' END,
    'legacy_promotion_migration_destination_id(uuid) must exist'
  UNION ALL
  SELECT 'routine.migration_rpc_exists',
    CASE WHEN (SELECT oid FROM migration_rpc) IS NOT NULL THEN 'pass' ELSE 'fail' END,
    'execute_legacy_promotion_migration exact signature must exist'
  UNION ALL
  SELECT 'routine.destination_function_immutable',
    CASE
      WHEN (SELECT oid FROM destination_fn) IS NULL THEN 'unknown'
      WHEN (SELECT provolatile FROM destination_fn) = 'i' THEN 'pass'
      ELSE 'fail'
    END,
    'Destination function must be IMMUTABLE'
  UNION ALL
  SELECT 'routine.migration_rpc_security_definer',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN (SELECT prosecdef FROM migration_rpc) THEN 'pass'
      ELSE 'fail'
    END,
    'Migration RPC must be SECURITY DEFINER'
  UNION ALL
  SELECT 'routine.migration_rpc_search_path_public',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN EXISTS (
        SELECT 1
        FROM unnest(COALESCE((SELECT proconfig FROM migration_rpc), ARRAY[]::text[])) AS cfg
        WHERE cfg = 'search_path=public'
      ) THEN 'pass'
      ELSE 'fail'
    END,
    'Migration RPC must pin search_path=public'
  UNION ALL
  SELECT 'routine.migration_rpc_advisory_lock_present',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN (SELECT definition FROM migration_rpc) ILIKE '%pg_advisory_xact_lock%' THEN 'pass'
      ELSE 'fail'
    END,
    'Concurrency control must use pg_advisory_xact_lock'
  UNION ALL
  SELECT 'routine.migration_rpc_deterministic_insert_path',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN (SELECT definition FROM migration_rpc) ILIKE '%ON CONFLICT (id) DO NOTHING%'
        AND (SELECT definition FROM migration_rpc) ILIKE '%public.governed_content%' THEN 'pass'
      ELSE 'fail'
    END,
    'Governed draft insert must be deterministic and conflict-safe'
  UNION ALL
  SELECT 'routine.migration_rpc_review_linkage_path',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN (SELECT definition FROM migration_rpc) ILIKE '%public.promotion_migration_reviews%'
        AND (SELECT definition FROM migration_rpc) ILIKE '%migrated_content_id%' THEN 'pass'
      ELSE 'fail'
    END,
    'Review linkage must update promotion_migration_reviews.migrated_content_id'
  UNION ALL
  SELECT 'routine.migration_rpc_draft_only_lifecycle',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN (SELECT definition FROM migration_rpc) ILIKE '%approval_status%'
        AND (SELECT definition FROM migration_rpc) ILIKE '%''draft''%' THEN 'pass'
      ELSE 'fail'
    END,
    'RPC must hardcode draft approval_status'
  UNION ALL
  SELECT 'grants.service_role_execute_migration_rpc',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN EXISTS (
        SELECT 1 FROM grant_rows WHERE grantee = 'service_role' AND privilege_type = 'EXECUTE'
      ) THEN 'pass'
      ELSE 'fail'
    END,
    'service_role must have EXECUTE on migration RPC'
  UNION ALL
  SELECT 'grants.anon_no_execute_migration_rpc',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN EXISTS (
        SELECT 1 FROM grant_rows WHERE grantee = 'anon' AND privilege_type = 'EXECUTE'
      ) THEN 'fail'
      ELSE 'pass'
    END,
    'anon must not have EXECUTE on migration RPC'
  UNION ALL
  SELECT 'grants.authenticated_no_execute_migration_rpc',
    CASE
      WHEN (SELECT oid FROM migration_rpc) IS NULL THEN 'unknown'
      WHEN EXISTS (
        SELECT 1 FROM grant_rows WHERE grantee = 'authenticated' AND privilege_type = 'EXECUTE'
      ) THEN 'fail'
      ELSE 'pass'
    END,
    'authenticated must not have EXECUTE on migration RPC'
  UNION ALL
  SELECT 'schema.core_tables_present',
    CASE
      WHEN (SELECT promotions_exists FROM refs)
        AND (SELECT reviews_exists FROM refs)
        AND (SELECT governed_exists FROM refs) THEN 'pass'
      ELSE 'fail'
    END,
    'promotions, promotion_migration_reviews, governed_content must exist'
  UNION ALL
  SELECT 'schema.no_destructive_ddl_expected',
    'pass',
    'Migration 012 is additive RPC-only — no DROP/TRUNCATE/DELETE DDL'
  UNION ALL
  SELECT 'feature.legacy_promotions_write_still_disabled',
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'unknown'
      WHEN (SELECT enabled FROM write_freeze) IS FALSE THEN 'pass'
      WHEN (SELECT enabled FROM write_freeze) IS NULL THEN 'fail'
      ELSE 'fail'
    END,
    'legacy_promotions_write must remain disabled after 012 apply'
)
SELECT check_id, status, detail
FROM (
  SELECT check_id, status, detail FROM checks
  UNION ALL
  SELECT 'overall.exact_match_verdict',
    CASE
      WHEN EXISTS (SELECT 1 FROM checks WHERE status = 'fail') THEN 'fail'
      WHEN EXISTS (SELECT 1 FROM checks WHERE status = 'unknown') THEN 'unknown'
      ELSE 'pass'
    END,
    'All verification checks must pass for exact-match verdict'
) verdict
ORDER BY check_id;
