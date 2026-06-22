-- Read-only preflight before 202606200008_phase9f_scheduled_publishing.sql
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail.

WITH refs AS (
  SELECT
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    to_regclass('public.governed_content') IS NOT NULL AS governed_content_exists,
    to_regclass('public.automation_job_runs') IS NOT NULL AS job_runs_exists,
    to_regclass('public.automation_job_items') IS NOT NULL AS job_items_exists,
    EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'supabase_migrations'
        AND c.relname = 'schema_migrations'
        AND c.relkind IN ('r', 'p')
    ) AS history_table_exists
),
probes AS (
  SELECT
    'prerequisites.platform_feature_controls'::text AS probe_id,
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'BLOCKER'
      ELSE 'READY'
    END AS classification,
    'Phase 9F.1 feature-control seed requires platform_feature_controls'::text AS detail
  UNION ALL
  SELECT
    'prerequisites.governed_content',
    CASE
      WHEN NOT (SELECT governed_content_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Governed content from Phase 9E should exist before enabling automation'
  UNION ALL
  SELECT
    'object.automation_job_runs_absent',
    CASE
      WHEN (SELECT job_runs_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Expected absent before first apply; existing table may indicate prior partial apply'
  UNION ALL
  SELECT
    'object.automation_job_items_absent',
    CASE
      WHEN (SELECT job_items_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Expected absent before first apply; existing table may indicate prior partial apply'
  UNION ALL
  SELECT
    'object.automation_job_runs_incompatible_structure',
    CASE
      WHEN NOT (SELECT job_runs_exists FROM refs) THEN 'READY'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'automation_job_runs' AND column_name = 'sanitized_error'
      ) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Existing automation_job_runs must include Phase 9F.1 operational columns'
  UNION ALL
  SELECT
    'feature.scheduled_content_automation_seed_conflict',
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (
        SELECT 1
        FROM platform_feature_controls pfc
        WHERE pfc.feature_key = 'scheduled_content_automation'
          AND pfc.enabled = true
      ) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Migration seed is disabled and uses ON CONFLICT DO NOTHING — pre-enabled row is not overwritten'
  UNION ALL
  SELECT
    'history.duplicate_migration_entry',
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = '202606200008'
      ) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Migration version must not already be recorded in schema_migrations'
  UNION ALL
  SELECT
    'history.prerequisite_202606200007',
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = '202606200007'
      ) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Phase 9E hardening (202606200007) should be applied before 202606200008'
  UNION ALL
  SELECT
    'object.conflicting_relation_kind',
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('automation_job_runs', 'automation_job_items')
          AND c.relkind NOT IN ('r', 'p')
      ) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Target names must not already exist as non-table relations'
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
