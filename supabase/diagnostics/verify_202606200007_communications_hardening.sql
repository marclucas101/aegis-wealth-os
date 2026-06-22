-- Read-only verification for 202606200007_phase9e_hardening.sql

WITH expected AS (
  SELECT * FROM (VALUES
    ('202606200007','index','idx_client_notifications_idempotent','UNIQUE'),
    ('202606200007','index','idx_communication_deliveries_idempotent','UNIQUE'),
    ('202606200007','index_def','idx_client_notifications_idempotent','WHERE ((reference_id IS NOT NULL) AND (reference_type IS NOT NULL))'),
    ('202606200007','index_def','idx_communication_deliveries_idempotent','WHERE (communication_id IS NOT NULL)'),
    ('202606200007','comment','governed_content','RLS enabled'),
    ('202606200007','comment','communication_deliveries','RLS enabled'),
    ('202606200007','comment','binder_exports','RLS enabled'),
    ('202606200007','comment','promotion_migration_reviews','UNIQUE(promotion_id)')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
idx AS (
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
),
tbl_comment AS (
  SELECT c.relname AS table_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
)
SELECT
  e.migration,
  e.check_kind || ':' || e.object_name AS check_id,
  e.object_name AS expected_object,
  CASE
    WHEN e.check_kind IN ('index','index_def') THEN i.indexname IS NOT NULL
    WHEN e.check_kind = 'comment' THEN tc.table_name IS NOT NULL
    ELSE NULL::boolean
  END AS present,
  CASE
    WHEN e.check_kind IN ('index','index_def') THEN i.indexdef
    WHEN e.check_kind = 'comment' THEN tc.description
    ELSE NULL
  END AS detail,
  CASE
    WHEN e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%UNIQUE INDEX%' THEN 'conflicting'
    WHEN e.check_kind = 'index_def' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%' || e.expected_detail || '%' THEN 'conflicting'
    WHEN e.check_kind = 'comment' AND (tc.description IS NULL OR tc.description NOT ILIKE '%' || e.expected_detail || '%') THEN 'conflicting'
    WHEN (e.check_kind IN ('index','index_def') AND i.indexname IS NULL) OR (e.check_kind='comment' AND tc.table_name IS NULL) THEN 'absent'
    ELSE 'present'
  END AS state
FROM expected e
LEFT JOIN idx i ON e.check_kind IN ('index','index_def') AND i.indexname = e.object_name
LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
ORDER BY check_id;

-- Rollup
WITH summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (
      WHERE (
        (e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef ILIKE '%UNIQUE INDEX%')
        OR (e.check_kind = 'index_def' AND i.indexname IS NOT NULL AND i.indexdef ILIKE '%' || e.expected_detail || '%')
        OR (e.check_kind = 'comment' AND tc.table_name IS NOT NULL AND tc.description ILIKE '%' || e.expected_detail || '%')
      )
    ) AS present_checks,
    COUNT(*) FILTER (
      WHERE (
        (e.check_kind IN ('index','index_def') AND i.indexname IS NULL)
        OR (e.check_kind = 'comment' AND tc.table_name IS NULL)
      )
    ) AS absent_checks,
    COUNT(*) FILTER (
      WHERE (
        (e.check_kind = 'index' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%UNIQUE INDEX%')
        OR (e.check_kind = 'index_def' AND i.indexname IS NOT NULL AND i.indexdef NOT ILIKE '%' || e.expected_detail || '%')
        OR (e.check_kind = 'comment' AND tc.table_name IS NOT NULL AND (tc.description IS NULL OR tc.description NOT ILIKE '%' || e.expected_detail || '%'))
      )
    ) AS conflicting_checks
  FROM (
    SELECT * FROM (VALUES
      ('index','idx_client_notifications_idempotent','UNIQUE'),
      ('index','idx_communication_deliveries_idempotent','UNIQUE'),
      ('index_def','idx_client_notifications_idempotent','WHERE ((reference_id IS NOT NULL) AND (reference_type IS NOT NULL))'),
      ('index_def','idx_communication_deliveries_idempotent','WHERE (communication_id IS NOT NULL)'),
      ('comment','governed_content','RLS enabled'),
      ('comment','communication_deliveries','RLS enabled'),
      ('comment','binder_exports','RLS enabled'),
      ('comment','promotion_migration_reviews','UNIQUE(promotion_id)')
    ) AS t(check_kind, object_name, expected_detail)
  ) e
  LEFT JOIN pg_indexes i ON i.schemaname='public' AND i.indexname = e.object_name
  LEFT JOIN (
    SELECT c.relname AS table_name, d.description
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  ) tc ON tc.table_name = e.object_name
)
SELECT
  '202606200007' AS migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  0::bigint AS unknown_checks,
  CASE
    WHEN present_checks = total_required_checks AND absent_checks = 0 AND conflicting_checks = 0 THEN 'EXACT_MATCH'
    WHEN present_checks = 0 AND absent_checks > 0 AND conflicting_checks = 0 THEN 'ABSENT'
    WHEN conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN present_checks > 0 AND absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM summary;
