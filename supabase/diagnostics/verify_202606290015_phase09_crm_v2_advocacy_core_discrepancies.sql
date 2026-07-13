-- Discrepancy check for migration 202606290015 (Phase 09 Advocacy core).
WITH expected(name) AS (
  VALUES
    ('advocacy_events'),
    ('advocacy_score_config'),
    ('crm_client_advocacy_preferences'),
    ('advocacy_domain_events')
)
SELECT
  'phase09.advocacy.core.discrepancy' AS check_id,
  expected.name AS missing_table
FROM expected
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_name = expected.name
);
