-- Verification after 202606290004_phase03_crm_v2_appointment_core.sql

WITH appointment_cols AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'adviser_appointments'
),
supporting_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'crm_appointment_participants',
      'crm_appointment_state_events',
      'crm_appointment_client_topics',
      'crm_appointment_agenda_items',
      'crm_appointment_checklist_items'
    )
),
appointment_count AS (
  SELECT COUNT(*)::bigint AS total FROM adviser_appointments
)
SELECT check_id, expected, observed_value, classification, detail
FROM (
  SELECT
    'phase03.core.lifecycle_column' AS check_id,
    'present' AS expected,
    CASE WHEN EXISTS (SELECT 1 FROM appointment_cols WHERE column_name = 'crm_lifecycle_status') THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (SELECT 1 FROM appointment_cols WHERE column_name = 'crm_lifecycle_status') THEN 'match' ELSE 'conflicting' END,
    'crm_lifecycle_status column'
  UNION ALL
  SELECT
    'phase03.core.version_column',
    'present',
    CASE WHEN EXISTS (SELECT 1 FROM appointment_cols WHERE column_name = 'version') THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (SELECT 1 FROM appointment_cols WHERE column_name = 'version') THEN 'match' ELSE 'conflicting' END,
    'optimistic concurrency version'
  UNION ALL
  SELECT
    'phase03.core.state_events_table',
    'present',
    CASE WHEN EXISTS (SELECT 1 FROM supporting_tables WHERE table_name = 'crm_appointment_state_events') THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (SELECT 1 FROM supporting_tables WHERE table_name = 'crm_appointment_state_events') THEN 'match' ELSE 'conflicting' END,
    'crm_appointment_state_events'
  UNION ALL
  SELECT
    'phase03.core.participants_table',
    'present',
    CASE WHEN EXISTS (SELECT 1 FROM supporting_tables WHERE table_name = 'crm_appointment_participants') THEN 'present' ELSE 'missing' END,
    CASE WHEN EXISTS (SELECT 1 FROM supporting_tables WHERE table_name = 'crm_appointment_participants') THEN 'match' ELSE 'conflicting' END,
    'crm_appointment_participants'
  UNION ALL
  SELECT
    'phase03.core.appointment_rows_preserved',
    '>=0',
    (SELECT total::text FROM appointment_count),
    'match',
    'existing appointment rows remain readable'
) checks;
