-- Discrepancy report for migration 202606290013 (Phase 08 Relationship moments core).
SELECT
  'phase08.core.discrepancy' AS check_id,
  expected.table_name,
  CASE WHEN t.table_name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM (
  VALUES
    ('relationship_moments'),
    ('adviser_moment_overrides'),
    ('festive_holiday_mappings'),
    ('crm_review_rhythm'),
    ('crm_client_preference_updates'),
    ('relationship_moment_events')
) AS expected(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public' AND t.table_name = expected.table_name
WHERE t.table_name IS NULL;
