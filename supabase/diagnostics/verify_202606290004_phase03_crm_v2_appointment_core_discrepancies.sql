-- Discrepancies only — 202606290004 appointment core

WITH expected_columns AS (
  SELECT unnest(ARRAY[
    'crm_lifecycle_status',
    'template_key',
    'title',
    'preparation_state',
    'follow_up_state',
    'version'
  ]) AS column_name
),
observed_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'adviser_appointments'
),
expected_tables AS (
  SELECT unnest(ARRAY[
    'crm_appointment_participants',
    'crm_appointment_state_events',
    'crm_appointment_client_topics',
    'crm_appointment_agenda_items',
    'crm_appointment_checklist_items'
  ]) AS table_name
),
observed_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
)
SELECT 'missing_column' AS issue, e.column_name AS object_name
FROM expected_columns e
LEFT JOIN observed_columns o ON o.column_name = e.column_name
WHERE o.column_name IS NULL
UNION ALL
SELECT 'missing_table', e.table_name
FROM expected_tables e
LEFT JOIN observed_tables o ON o.table_name = e.table_name
WHERE o.table_name IS NULL;
