-- Read-only deep verification for 202606100021_phase6f_performance_indexes.sql

WITH expected_indexes AS (
  SELECT * FROM (VALUES
    ('202606100021','idx_adviser_feedback_client_created','public','adviser_feedback','(client_id, created_at DESC)','client_id IS NOT NULL','false'),
    ('202606100021','idx_clients_advisor_display_name','public','clients','(advisor_user_id, display_name)','advisor_user_id IS NOT NULL','false'),
    ('202606100021','idx_discover_profiles_client_current','public','discover_profiles','(client_id)','is_current = true','false')
  ) AS expected(migration, index_name, schema_name, table_name, expected_columns_fragment, expected_predicate_fragment, expected_unique)
),
actual_indexes AS (
  SELECT
    idx.schemaname AS actual_schema_name,
    idx.tablename AS actual_table_name,
    idx.indexname AS actual_index_name,
    idx.indexdef AS actual_index_definition,
    (idx.indexdef ILIKE 'CREATE UNIQUE INDEX%')::text AS actual_unique
  FROM pg_indexes idx
),
resolved AS (
  SELECT
    e.migration,
    e.index_name,
    e.schema_name,
    e.table_name,
    e.expected_columns_fragment,
    e.expected_predicate_fragment,
    e.expected_unique,
    ai.actual_index_definition,
    ai.actual_unique,
    (ai.actual_index_name IS NOT NULL) AS present,
    CASE
      WHEN ai.actual_index_name IS NULL THEN false
      WHEN ai.actual_index_definition NOT ILIKE '%' || e.expected_columns_fragment || '%' THEN true
      WHEN ai.actual_index_definition NOT ILIKE '%' || e.expected_predicate_fragment || '%' THEN true
      WHEN ai.actual_unique <> e.expected_unique THEN true
      ELSE false
    END AS conflicting
  FROM expected_indexes e
  LEFT JOIN actual_indexes ai
    ON ai.actual_schema_name = e.schema_name
   AND ai.actual_table_name = e.table_name
   AND ai.actual_index_name = e.index_name
)
SELECT
  r.migration,
  'index:' || r.index_name AS check_id,
  r.schema_name || '.' || r.table_name || '/' || r.index_name AS expected_object,
  r.present,
  CASE
    WHEN NOT r.present THEN 'absent'
    WHEN r.conflicting THEN 'conflicting'
    ELSE 'present'
  END AS state,
  'expected columns=' || r.expected_columns_fragment
    || '; expected predicate=' || r.expected_predicate_fragment
    || '; expected unique=' || r.expected_unique
    || '; actual=' || COALESCE(r.actual_index_definition, 'MISSING') AS detail
FROM resolved r
ORDER BY r.index_name;

-- Rollup (CTE chain re-declared — PostgreSQL CTEs are statement-scoped)
WITH expected_indexes AS (
  SELECT * FROM (VALUES
    ('202606100021','idx_adviser_feedback_client_created','public','adviser_feedback','(client_id, created_at DESC)','client_id IS NOT NULL','false'),
    ('202606100021','idx_clients_advisor_display_name','public','clients','(advisor_user_id, display_name)','advisor_user_id IS NOT NULL','false'),
    ('202606100021','idx_discover_profiles_client_current','public','discover_profiles','(client_id)','is_current = true','false')
  ) AS expected(migration, index_name, schema_name, table_name, expected_columns_fragment, expected_predicate_fragment, expected_unique)
),
actual_indexes AS (
  SELECT
    idx.schemaname AS actual_schema_name,
    idx.tablename AS actual_table_name,
    idx.indexname AS actual_index_name,
    idx.indexdef AS actual_index_definition,
    (idx.indexdef ILIKE 'CREATE UNIQUE INDEX%')::text AS actual_unique
  FROM pg_indexes idx
),
resolved AS (
  SELECT
    e.migration,
    (ai.actual_index_name IS NOT NULL) AS present,
    CASE
      WHEN ai.actual_index_name IS NULL THEN false
      WHEN ai.actual_index_definition NOT ILIKE '%' || e.expected_columns_fragment || '%' THEN true
      WHEN ai.actual_index_definition NOT ILIKE '%' || e.expected_predicate_fragment || '%' THEN true
      WHEN ai.actual_unique <> e.expected_unique THEN true
      ELSE false
    END AS conflicting
  FROM expected_indexes e
  LEFT JOIN actual_indexes ai
    ON ai.actual_schema_name = e.schema_name
   AND ai.actual_table_name = e.table_name
   AND ai.actual_index_name = e.index_name
),
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE present AND NOT conflicting) AS present_checks,
    COUNT(*) FILTER (WHERE NOT present) AS absent_checks,
    COUNT(*) FILTER (WHERE conflicting) AS conflicting_checks,
    0::int AS unknown_checks
  FROM resolved
)
SELECT
  '202606100021' AS migration,
  s.total_required_checks,
  s.present_checks,
  s.absent_checks,
  s.conflicting_checks,
  s.unknown_checks,
  CASE
    WHEN s.present_checks = s.total_required_checks AND s.absent_checks = 0 AND s.conflicting_checks = 0 THEN 'EXACT_MATCH'
    WHEN s.present_checks = 0 AND s.absent_checks > 0 THEN 'ABSENT'
    WHEN s.conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN s.present_checks > 0 AND s.absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM summary s;
