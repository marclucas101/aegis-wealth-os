-- Discrepancy check for migration 202606290009 (Phase 06 Service core).
SELECT
  'phase06.core.discrepancy' AS check_id,
  expected.table_name,
  CASE WHEN t.table_name IS NULL THEN 'missing_table' ELSE 'present' END AS table_status
FROM (
  VALUES
    ('service_commitments'),
    ('client_service_requests'),
    ('service_commitment_events'),
    ('client_service_request_events')
) AS expected(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = expected.table_name;
