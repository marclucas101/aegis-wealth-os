-- Read-only preflight before 202606200009_phase9f2_lifecycle_notifications.sql
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail.

WITH refs AS (
  SELECT
    to_regclass('public.client_notifications') IS NOT NULL AS notifications_exists,
    to_regclass('public.communication_preferences') IS NOT NULL AS preferences_exists,
    to_regclass('public.communication_deliveries') IS NOT NULL AS deliveries_exists,
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations'
        AND c.relname = 'schema_migrations'
        AND c.relkind IN ('r', 'p')
    ) AS history_table_exists
),
column_probe AS (
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'client_notifications' AND column_name = 'lifecycle_event'
    ) AS lifecycle_event_exists,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'client_notifications' AND column_name = 'idempotency_key'
    ) AS idempotency_key_exists,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'client_notifications' AND column_name = 'metadata'
    ) AS metadata_exists
),
index_probe AS (
  SELECT
    to_regclass('public.idx_client_notifications_lifecycle_idempotent') IS NOT NULL AS lifecycle_idempotent_index_exists,
    to_regclass('public.idx_client_notifications_lifecycle_event') IS NOT NULL AS lifecycle_event_index_exists
),
rls_probe AS (
  SELECT
    CASE
      WHEN NOT (SELECT notifications_exists FROM refs) THEN NULL::boolean
      ELSE (
        SELECT c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'client_notifications'
      )
    END AS rls_enabled
),
feature_seed AS (
  SELECT
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1 FROM platform_feature_controls
        WHERE feature_key = 'document_event_notifications'
      )
    END AS document_events_seed_present
),
probes AS (
  SELECT
    'prerequisites.client_notifications'::text AS probe_id,
    CASE WHEN NOT (SELECT notifications_exists FROM refs) THEN 'BLOCKER' ELSE 'READY' END AS classification,
    'client_notifications must exist from Phase 9E before applying lifecycle columns'::text AS detail
  UNION ALL
  SELECT
    'prerequisites.migration_202606200008',
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200008') THEN 'WARNING'
      ELSE 'READY'
    END,
    'Phase 9F.1 scheduled publishing should be applied before 9F.2 lifecycle hardening'
  UNION ALL
  SELECT
    'prerequisites.communication_tables',
    CASE
      WHEN NOT (SELECT preferences_exists FROM refs) OR NOT (SELECT deliveries_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END,
    'communication_preferences and communication_deliveries expected from Phase 9E'
  UNION ALL
  SELECT
    'prerequisites.document_event_notifications_feature',
    CASE
      WHEN (SELECT document_events_seed_present FROM feature_seed) IS NULL THEN 'UNKNOWN'
      WHEN (SELECT document_events_seed_present FROM feature_seed) THEN 'READY'
      ELSE 'WARNING'
    END,
    'document_event_notifications row should exist; migration 009 reuses this control'
  UNION ALL
  SELECT
    'schema.lifecycle_columns_absent',
    CASE
      WHEN NOT (SELECT notifications_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT lifecycle_event_exists FROM column_probe)
        OR (SELECT idempotency_key_exists FROM column_probe)
        OR (SELECT metadata_exists FROM column_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Expected migration-owned columns absent before first apply'
  UNION ALL
  SELECT
    'schema.lifecycle_indexes_absent',
    CASE
      WHEN (SELECT lifecycle_idempotent_index_exists FROM index_probe)
        OR (SELECT lifecycle_event_index_exists FROM index_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Expected lifecycle indexes absent before first apply'
  UNION ALL
  SELECT
    'schema.index_name_conflict',
    CASE
      WHEN (SELECT lifecycle_idempotent_index_exists FROM index_probe)
        AND NOT (SELECT idempotency_key_exists FROM column_probe) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Index exists without idempotency_key column indicates incompatible partial apply'
  UNION ALL
  SELECT
    'data.duplicate_idempotency_key',
    CASE
      WHEN NOT (SELECT idempotency_key_exists FROM column_probe) THEN 'READY'
      ELSE 'WARNING'
    END,
    'Pre-apply: column absent so duplicate scan skipped. After column exists, run verify diagnostic duplicate probe or re-run preflight.'
  UNION ALL
  SELECT
    'rls.client_notifications_enabled',
    CASE
      WHEN (SELECT rls_enabled FROM rls_probe) IS NULL THEN 'UNKNOWN'
      WHEN (SELECT rls_enabled FROM rls_probe) THEN 'READY'
      ELSE 'BLOCKER'
    END,
    'client_notifications RLS must remain enabled'
  UNION ALL
  SELECT
    'history.duplicate_migration_entry',
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200009') THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Migration version must not already be recorded'
  UNION ALL
  SELECT
    'history.pending_migration',
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '202606200009') THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Expected pending state before apply'
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
