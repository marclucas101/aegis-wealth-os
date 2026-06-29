-- Read-only preflight before 202606290004_phase03_crm_v2_appointment_core.sql

WITH refs AS (
  SELECT
    to_regclass('public.adviser_appointments') IS NOT NULL AS appointments_exists,
    to_regclass('public.clients') IS NOT NULL AS clients_exists
),
history_probe AS (
  SELECT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version = '202606290004'
  ) AS phase03_core_applied
),
column_probe AS (
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'adviser_appointments'
      AND column_name = 'crm_lifecycle_status'
  ) AS lifecycle_column_exists
)
SELECT probe_id, classification, detail
FROM (
  SELECT
    'phase03.core.appointments_table',
    CASE WHEN (SELECT appointments_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
    CASE WHEN (SELECT appointments_exists FROM refs) THEN 'adviser_appointments present' ELSE 'adviser_appointments missing' END
  UNION ALL
  SELECT
    'phase03.core.clients_table',
    CASE WHEN (SELECT clients_exists FROM refs) THEN 'READY' ELSE 'BLOCKER' END,
    CASE WHEN (SELECT clients_exists FROM refs) THEN 'clients present' ELSE 'clients missing' END
  UNION ALL
  SELECT
    'phase03.core.already_applied',
    CASE WHEN (SELECT phase03_core_applied FROM history_probe) THEN 'WARNING' ELSE 'READY' END,
    CASE WHEN (SELECT phase03_core_applied FROM history_probe) THEN 'core migration already recorded' ELSE 'core migration not yet applied' END
  UNION ALL
  SELECT
    'phase03.core.lifecycle_column_pre',
    CASE
      WHEN NOT (SELECT appointments_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT lifecycle_column_exists FROM column_probe) THEN 'WARNING'
      ELSE 'READY'
    END,
    CASE
      WHEN NOT (SELECT appointments_exists FROM refs) THEN 'cannot probe columns'
      WHEN (SELECT lifecycle_column_exists FROM column_probe) THEN 'crm_lifecycle_status already present'
      ELSE 'crm_lifecycle_status absent — ALTER will add'
    END
) probes;
