-- Read-only verification for 202606200002_phase9a_publication_hardening.sql

WITH checks AS (
  SELECT * FROM (VALUES
    ('202606200002','index','idx_published_outputs_one_current_published','UNIQUE'),
    ('202606200002','index_def','idx_published_outputs_one_current_published','WHERE ((publication_status = ''published''::publication_status) AND (withdrawn_at IS NULL) AND (superseded_at IS NULL))'),
    ('202606200002','index_cols','idx_published_outputs_one_current_published','(client_id, output_type, output_audience)'),
    ('202606200002','comment','idx_published_outputs_one_current_published','at most one current published output')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
index_info AS (
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
),
index_comment AS (
  SELECT
    cls.relname AS indexname,
    d.description
  FROM pg_class cls
  JOIN pg_namespace n ON n.oid = cls.relnamespace
  LEFT JOIN pg_description d ON d.objoid = cls.oid AND d.classoid = 'pg_class'::regclass
  WHERE n.nspname = 'public' AND cls.relkind = 'i'
)
SELECT
  c.migration,
  c.check_kind || ':' || c.object_name AS check_id,
  c.object_name AS expected_object,
  (i.indexname IS NOT NULL) AS present,
  CASE
    WHEN i.indexname IS NULL THEN 'absent'
    WHEN c.check_kind = 'index' AND i.indexdef NOT ILIKE '%UNIQUE INDEX%' THEN 'conflicting'
    WHEN c.check_kind = 'index_def' AND i.indexdef NOT ILIKE '%' || c.expected_detail || '%' THEN 'conflicting'
    WHEN c.check_kind = 'index_cols' AND i.indexdef NOT ILIKE '%' || c.expected_detail || '%' THEN 'conflicting'
    WHEN c.check_kind = 'comment' AND (ic.description IS NULL OR ic.description NOT ILIKE '%' || c.expected_detail || '%') THEN 'conflicting'
    ELSE 'present'
  END AS state,
  CASE
    WHEN c.check_kind = 'comment' THEN ic.description
    ELSE i.indexdef
  END AS detail
FROM checks c
LEFT JOIN index_info i ON i.indexname = c.object_name
LEFT JOIN index_comment ic ON ic.indexname = c.object_name
ORDER BY check_id;

-- Rollup
WITH summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (
      WHERE i.indexname IS NOT NULL
      AND (c.check_kind <> 'index' OR i.indexdef ILIKE '%UNIQUE INDEX%')
      AND (c.check_kind <> 'index_def' OR i.indexdef ILIKE '%' || c.expected_detail || '%')
      AND (c.check_kind <> 'index_cols' OR i.indexdef ILIKE '%' || c.expected_detail || '%')
      AND (c.check_kind <> 'comment' OR (ic.description IS NOT NULL AND ic.description ILIKE '%' || c.expected_detail || '%'))
    ) AS present_checks,
    COUNT(*) FILTER (WHERE i.indexname IS NULL) AS absent_checks,
    COUNT(*) FILTER (
      WHERE i.indexname IS NOT NULL
      AND (
        (c.check_kind = 'index' AND i.indexdef NOT ILIKE '%UNIQUE INDEX%')
        OR (c.check_kind = 'index_def' AND i.indexdef NOT ILIKE '%' || c.expected_detail || '%')
        OR (c.check_kind = 'index_cols' AND i.indexdef NOT ILIKE '%' || c.expected_detail || '%')
        OR (c.check_kind = 'comment' AND (ic.description IS NULL OR ic.description NOT ILIKE '%' || c.expected_detail || '%'))
      )
    ) AS conflicting_checks
  FROM (
    SELECT * FROM (VALUES
      ('index','idx_published_outputs_one_current_published','UNIQUE'),
      ('index_def','idx_published_outputs_one_current_published','WHERE ((publication_status = ''published''::publication_status) AND (withdrawn_at IS NULL) AND (superseded_at IS NULL))'),
      ('index_cols','idx_published_outputs_one_current_published','(client_id, output_type, output_audience)'),
      ('comment','idx_published_outputs_one_current_published','at most one current published output')
    ) AS t(check_kind, object_name, expected_detail)
  ) c
  LEFT JOIN pg_indexes i ON i.schemaname = 'public' AND i.indexname = c.object_name
  LEFT JOIN (
    SELECT cls.relname AS indexname, d.description
    FROM pg_class cls
    JOIN pg_namespace n ON n.oid = cls.relnamespace
    LEFT JOIN pg_description d ON d.objoid = cls.oid AND d.classoid = 'pg_class'::regclass
    WHERE n.nspname = 'public' AND cls.relkind = 'i'
  ) ic ON ic.indexname = c.object_name
)
SELECT
  '202606200002' AS migration,
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
