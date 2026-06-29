-- Discrepancy check for migration 202606290007.

WITH expected_tables(table_name) AS (
  VALUES
    ('crm_google_oauth_states'),
    ('crm_google_calendar_event_mappings')
),
missing_tables AS (
  SELECT e.table_name
  FROM expected_tables e
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'public'
   AND t.table_name = e.table_name
  WHERE t.table_name IS NULL
)
SELECT
  'phase05.core.discrepancy' AS check_id,
  table_name AS expected_table,
  'missing_table' AS issue
FROM missing_tables;
