-- Read-only preflight before 202606200012_phase9f4_promotion_migration_idempotency.sql
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail.

WITH refs AS (
  SELECT
    to_regclass('public.promotions') IS NOT NULL AS promotions_exists,
    to_regclass('public.promotion_migration_reviews') IS NOT NULL AS migration_reviews_exists,
    to_regclass('public.governed_content') IS NOT NULL AS governed_content_exists,
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    to_regprocedure('extensions.uuid_generate_v5(uuid,text)') IS NOT NULL AS extensions_uuid_generate_v5_available,
    EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'service_role'
    ) AS service_role_exists,
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations'
        AND c.relname = 'schema_migrations'
        AND c.relkind IN ('r', 'p')
    ) AS history_table_exists
),
history_probe AS (
  SELECT
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202606200011'
      ) END AS phase9f4_write_freeze_applied,
    CASE WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations
        WHERE version = '202606200012'
      ) END AS phase9f4_idempotency_applied
),
function_probe AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'legacy_promotion_migration_destination_id'
        AND pg_get_function_identity_arguments(p.oid) = 'p_promotion_id uuid'
    ) AS destination_fn_present,
    EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'execute_legacy_promotion_migration'
        AND pg_get_function_identity_arguments(p.oid) =
          'p_promotion_id uuid, p_classification text, p_reviewer_user_id uuid, p_notes text, p_title text, p_summary text, p_body text, p_category text, p_content_type text, p_audience_scope text, p_external_url text, p_expires_at timestamp with time zone, p_adviser_user_id uuid'
    ) AS migration_rpc_present,
    (
      SELECT count(*)::int
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'legacy_promotion_migration_destination_id',
          'execute_legacy_promotion_migration'
        )
    ) AS related_function_count
),
constraint_probe AS (
  SELECT
    EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public'
        AND rel.relname = 'promotion_migration_reviews'
        AND c.contype = 'u'
        AND pg_get_constraintdef(c.oid) LIKE '%promotion_id%'
    ) AS promotion_id_unique_present,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'promotion_migration_reviews'
        AND column_name = 'migrated_content_id'
    ) AS migrated_content_id_column_present,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'governed_content'
        AND column_name = 'approval_status'
    ) AS governed_approval_status_present
),
grant_probe AS (
  SELECT
    COALESCE(bool_or(r.rolname = 'service_role'), false) AS service_role_execute_migration,
    COALESCE(bool_or(r.rolname = 'anon'), false) AS anon_execute_migration,
    COALESCE(bool_or(r.rolname = 'authenticated'), false) AS authenticated_execute_migration
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  LEFT JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl ON true
  LEFT JOIN pg_roles r ON r.oid = acl.grantee
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_legacy_promotion_migration'
    AND acl.privilege_type = 'EXECUTE'
),
write_freeze_probe AS (
  SELECT
    CASE WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE (
        SELECT enabled
        FROM platform_feature_controls
        WHERE feature_key = 'legacy_promotions_write'
        LIMIT 1
      ) END AS legacy_write_enabled
),
migration_rows AS (
  SELECT
    CASE WHEN NOT (SELECT migration_reviews_exists FROM refs) THEN NULL::bigint
      ELSE (
        SELECT count(*)::bigint
        FROM promotion_migration_reviews
        WHERE migrated_content_id IS NOT NULL
      ) END AS linked_review_count
),
probes (probe_id, classification, detail) AS (
  SELECT 'migration.202606200011_prerequisite',
    CASE
      WHEN (SELECT history_table_exists FROM refs) IS NOT TRUE THEN 'UNKNOWN'
      WHEN (SELECT phase9f4_write_freeze_applied FROM history_probe) IS NOT TRUE THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Phase 9F.4 write-freeze migration 202606200011 must be applied before 012'
  UNION ALL
  SELECT 'history.pending_202606200012',
    CASE
      WHEN (SELECT history_table_exists FROM refs) IS NOT TRUE THEN 'UNKNOWN'
      WHEN (SELECT phase9f4_idempotency_applied FROM history_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Migration 202606200012 should be pending before apply'
  UNION ALL
  SELECT 'schema.promotions_table',
    CASE WHEN (SELECT promotions_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
    'public.promotions must exist for migration source reads'
  UNION ALL
  SELECT 'schema.promotion_migration_reviews',
    CASE WHEN (SELECT migration_reviews_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
    'public.promotion_migration_reviews required for linkage'
  UNION ALL
  SELECT 'schema.governed_content',
    CASE WHEN (SELECT governed_content_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
    'public.governed_content required for governed draft destination'
  UNION ALL
  SELECT 'schema.promotion_id_unique_constraint',
    CASE
      WHEN NOT (SELECT migration_reviews_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT promotion_id_unique_present FROM constraint_probe) THEN 'READY'
      ELSE 'BLOCKER'
    END,
    'UNIQUE(promotion_id) required for idempotent linkage'
  UNION ALL
  SELECT 'schema.migrated_content_id_column',
    CASE
      WHEN NOT (SELECT migration_reviews_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT migrated_content_id_column_present FROM constraint_probe) THEN 'READY'
      ELSE 'BLOCKER'
    END,
    'promotion_migration_reviews.migrated_content_id required'
  UNION ALL
  SELECT 'schema.governed_content_approval_status',
    CASE
      WHEN NOT (SELECT governed_content_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT governed_approval_status_present FROM constraint_probe) THEN 'READY'
      ELSE 'BLOCKER'
    END,
    'governed_content.approval_status required for draft enforcement'
  UNION ALL
  SELECT 'extension.extensions_uuid_generate_v5_callable',
    CASE
      WHEN (SELECT extensions_uuid_generate_v5_available FROM refs) THEN 'READY'
      ELSE 'BLOCKER'
    END,
    'extensions.uuid_generate_v5(uuid,text) must be callable for deterministic destination IDs'
  UNION ALL
  SELECT 'routine.destination_function_absent_before_apply',
    CASE
      WHEN (SELECT phase9f4_idempotency_applied FROM history_probe) THEN 'UNKNOWN'
      WHEN (SELECT destination_fn_present FROM function_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    'legacy_promotion_migration_destination_id should not exist before first apply'
  UNION ALL
  SELECT 'routine.migration_rpc_absent_before_apply',
    CASE
      WHEN (SELECT phase9f4_idempotency_applied FROM history_probe) THEN 'UNKNOWN'
      WHEN (SELECT migration_rpc_present FROM function_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    'execute_legacy_promotion_migration should not exist before first apply'
  UNION ALL
  SELECT 'routine.no_conflicting_overloads',
    CASE
      WHEN (SELECT related_function_count FROM function_probe) > 2 THEN 'BLOCKER'
      WHEN (SELECT related_function_count FROM function_probe) = 2
        AND NOT (SELECT migration_rpc_present FROM function_probe) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'At most two related routines with exact expected signatures'
  UNION ALL
  SELECT 'role.service_role_exists',
    CASE WHEN (SELECT service_role_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
    'service_role must exist for restricted RPC execution'
  UNION ALL
  SELECT 'grants.no_broad_execute_before_apply',
    CASE
      WHEN (SELECT phase9f4_idempotency_applied FROM history_probe) THEN 'UNKNOWN'
      WHEN (SELECT migration_rpc_present FROM function_probe) IS NOT TRUE THEN 'READY'
      WHEN (SELECT anon_execute_migration FROM grant_probe)
        OR (SELECT authenticated_execute_migration FROM grant_probe) THEN 'BLOCKER'
      WHEN (SELECT service_role_execute_migration FROM grant_probe) THEN 'READY'
      ELSE 'WARNING'
    END,
    'If RPC already exists, anon/authenticated must not have EXECUTE'
  UNION ALL
  SELECT 'feature.legacy_promotions_write_still_disabled',
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT legacy_write_enabled FROM write_freeze_probe) IS FALSE THEN 'READY'
      WHEN (SELECT legacy_write_enabled FROM write_freeze_probe) IS NULL THEN 'WARNING'
      ELSE 'BLOCKER'
    END,
    'legacy_promotions_write must remain disabled during 012 apply'
  UNION ALL
  SELECT 'data.existing_linked_reviews_compatible',
    CASE
      WHEN (SELECT linked_review_count FROM migration_rows) IS NULL THEN 'UNKNOWN'
      ELSE 'READY'
    END,
    'Existing linked migration reviews remain compatible; no source body exposure in this preflight'
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
