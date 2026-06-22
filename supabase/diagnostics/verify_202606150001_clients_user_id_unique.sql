-- Read-only deep verification for 202606150001_clients_user_id_unique.sql

WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606150001','table','public','clients',NULL),
    ('202606150001','column','public','clients','user_id'),
    ('202606150001','column_type','public','clients','user_id:uuid'),
    ('202606150001','index','public','clients','clients_user_id_unique'),
    ('202606150001','index_definition','public','clients','UNIQUE (user_id)'),
    ('202606150001','fk_user_id_to_users','public','clients','users(id)'),
    ('202606150001','duplicate_non_null_user_id_probe','public','clients','non_null_duplicate_count')
  ) AS expected(migration, check_kind, schema_name, relation_name, object_name)
),
table_presence AS (
  SELECT n.nspname AS schema_name, c.relname AS relation_name, true AS is_present
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
),
column_presence AS (
  SELECT c.table_schema AS schema_name, c.table_name AS relation_name, c.column_name,
         c.udt_name AS column_type, c.is_nullable, c.column_default, true AS is_present
  FROM information_schema.columns c
),
index_presence AS (
  SELECT i.schemaname AS schema_name, i.tablename AS relation_name, i.indexname, i.indexdef, true AS is_present
  FROM pg_indexes i
),
fk_presence AS (
  SELECT n.nspname AS schema_name, rel.relname AS relation_name, con.conname,
         pg_get_constraintdef(con.oid) AS definition, true AS is_present
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE con.contype = 'f'
),
duplicate_probe AS (
  SELECT
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'clients' AND c.relkind IN ('r','p')
    ) AS clients_table_exists
),
duplicate_counts AS (
  SELECT
    dp.clients_table_exists,
    CASE
      WHEN dp.clients_table_exists THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM (SELECT user_id FROM public.clients WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1) d',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS duplicate_non_null_user_id_count
  FROM duplicate_probe dp
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind,
    e.schema_name AS expected_schema_name,
    e.relation_name AS expected_relation_name,
    e.object_name AS expected_object_name,
    CASE
      WHEN e.check_kind = 'table' THEN tp.is_present
      WHEN e.check_kind = 'column' THEN cp.is_present
      WHEN e.check_kind = 'column_type' THEN cp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'index_definition' THEN ip.is_present
      WHEN e.check_kind = 'fk_user_id_to_users' THEN fp.is_present
      WHEN e.check_kind = 'duplicate_non_null_user_id_probe' THEN dc.clients_table_exists
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'column_type' AND cp.is_present AND cp.column_type <> split_part(e.object_name, ':', 2) THEN true
      WHEN e.check_kind = 'index_definition' AND ip.is_present AND ip.indexdef NOT ILIKE '%UNIQUE INDEX%' THEN true
      WHEN e.check_kind = 'index_definition' AND ip.is_present AND ip.indexdef NOT ILIKE '%(user_id)%' THEN true
      WHEN e.check_kind = 'fk_user_id_to_users' AND fp.is_present AND fp.definition NOT ILIKE '%REFERENCES users(id)%' THEN true
      WHEN e.check_kind = 'duplicate_non_null_user_id_probe' AND dc.clients_table_exists AND dc.duplicate_non_null_user_id_count > 0 THEN true
      ELSE false
    END AS conflicting,
    CASE
      WHEN e.check_kind = 'column' AND cp.is_present THEN
        'type=' || cp.column_type || ', nullable=' || cp.is_nullable || ', default=' || COALESCE(cp.column_default, 'NULL')
      WHEN e.check_kind = 'index_definition' AND ip.is_present THEN ip.indexdef
      WHEN e.check_kind = 'fk_user_id_to_users' AND fp.is_present THEN fp.definition
      WHEN e.check_kind = 'duplicate_non_null_user_id_probe' THEN
        'duplicate_non_null_user_id_count=' || COALESCE(dc.duplicate_non_null_user_id_count::text, 'NULL')
      ELSE NULL
    END AS actual_detail
  FROM expected_checks e
  LEFT JOIN table_presence tp
    ON e.check_kind = 'table' AND tp.schema_name = e.schema_name AND tp.relation_name = e.relation_name
  LEFT JOIN column_presence cp
    ON e.check_kind IN ('column','column_type')
   AND cp.schema_name = e.schema_name
   AND cp.relation_name = e.relation_name
   AND cp.column_name = split_part(e.object_name, ':', 1)
  LEFT JOIN index_presence ip
    ON e.check_kind IN ('index','index_definition')
   AND ip.schema_name = e.schema_name
   AND ip.relation_name = e.relation_name
   AND ip.indexname = CASE WHEN e.check_kind = 'index' THEN e.object_name ELSE 'clients_user_id_unique' END
  LEFT JOIN fk_presence fp
    ON e.check_kind = 'fk_user_id_to_users'
   AND fp.schema_name = e.schema_name
   AND fp.relation_name = e.relation_name
   AND fp.definition ILIKE '%(user_id)%'
  CROSS JOIN duplicate_counts dc
)
SELECT
  r.migration,
  r.check_kind AS check_id,
  r.expected_schema_name || '.' || r.expected_relation_name || '/' || r.expected_object_name AS expected_object,
  r.present,
  CASE
    WHEN r.present IS FALSE THEN 'absent'
    WHEN r.conflicting THEN 'conflicting'
    WHEN r.present IS TRUE THEN 'present'
    ELSE 'unknown'
  END AS state,
  r.actual_detail AS detail
FROM resolved r
ORDER BY r.check_kind;

-- Rollup (CTE chain re-declared — PostgreSQL CTEs are statement-scoped)
WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606150001','table','public','clients',NULL),
    ('202606150001','column','public','clients','user_id'),
    ('202606150001','column_type','public','clients','user_id:uuid'),
    ('202606150001','index','public','clients','clients_user_id_unique'),
    ('202606150001','index_definition','public','clients','UNIQUE (user_id)'),
    ('202606150001','fk_user_id_to_users','public','clients','users(id)'),
    ('202606150001','duplicate_non_null_user_id_probe','public','clients','non_null_duplicate_count')
  ) AS expected(migration, check_kind, schema_name, relation_name, object_name)
),
table_presence AS (
  SELECT n.nspname AS schema_name, c.relname AS relation_name, true AS is_present
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
),
column_presence AS (
  SELECT c.table_schema AS schema_name, c.table_name AS relation_name, c.column_name,
         c.udt_name AS column_type, c.is_nullable, c.column_default, true AS is_present
  FROM information_schema.columns c
),
index_presence AS (
  SELECT i.schemaname AS schema_name, i.tablename AS relation_name, i.indexname, i.indexdef, true AS is_present
  FROM pg_indexes i
),
fk_presence AS (
  SELECT n.nspname AS schema_name, rel.relname AS relation_name, con.conname,
         pg_get_constraintdef(con.oid) AS definition, true AS is_present
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE con.contype = 'f'
),
duplicate_probe AS (
  SELECT
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'clients' AND c.relkind IN ('r','p')
    ) AS clients_table_exists
),
duplicate_counts AS (
  SELECT
    dp.clients_table_exists,
    CASE
      WHEN dp.clients_table_exists THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM (SELECT user_id FROM public.clients WHERE user_id IS NOT NULL GROUP BY user_id HAVING count(*) > 1) d',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS duplicate_non_null_user_id_count
  FROM duplicate_probe dp
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind,
    CASE
      WHEN e.check_kind = 'table' THEN tp.is_present
      WHEN e.check_kind = 'column' THEN cp.is_present
      WHEN e.check_kind = 'column_type' THEN cp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'index_definition' THEN ip.is_present
      WHEN e.check_kind = 'fk_user_id_to_users' THEN fp.is_present
      WHEN e.check_kind = 'duplicate_non_null_user_id_probe' THEN dc.clients_table_exists
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'column_type' AND cp.is_present AND cp.column_type <> split_part(e.object_name, ':', 2) THEN true
      WHEN e.check_kind = 'index_definition' AND ip.is_present AND ip.indexdef NOT ILIKE '%UNIQUE INDEX%' THEN true
      WHEN e.check_kind = 'index_definition' AND ip.is_present AND ip.indexdef NOT ILIKE '%(user_id)%' THEN true
      WHEN e.check_kind = 'fk_user_id_to_users' AND fp.is_present AND fp.definition NOT ILIKE '%REFERENCES users(id)%' THEN true
      WHEN e.check_kind = 'duplicate_non_null_user_id_probe' AND dc.clients_table_exists AND dc.duplicate_non_null_user_id_count > 0 THEN true
      ELSE false
    END AS conflicting
  FROM expected_checks e
  LEFT JOIN table_presence tp
    ON e.check_kind = 'table' AND tp.schema_name = e.schema_name AND tp.relation_name = e.relation_name
  LEFT JOIN column_presence cp
    ON e.check_kind IN ('column','column_type')
   AND cp.schema_name = e.schema_name
   AND cp.relation_name = e.relation_name
   AND cp.column_name = split_part(e.object_name, ':', 1)
  LEFT JOIN index_presence ip
    ON e.check_kind IN ('index','index_definition')
   AND ip.schema_name = e.schema_name
   AND ip.relation_name = e.relation_name
   AND ip.indexname = CASE WHEN e.check_kind = 'index' THEN e.object_name ELSE 'clients_user_id_unique' END
  LEFT JOIN fk_presence fp
    ON e.check_kind = 'fk_user_id_to_users'
   AND fp.schema_name = e.schema_name
   AND fp.relation_name = e.relation_name
   AND fp.definition ILIKE '%(user_id)%'
  CROSS JOIN duplicate_counts dc
),
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE present IS TRUE AND conflicting = false) AS present_checks,
    COUNT(*) FILTER (WHERE present IS FALSE) AS absent_checks,
    COUNT(*) FILTER (WHERE conflicting = true) AS conflicting_checks,
    COUNT(*) FILTER (WHERE present IS NULL) AS unknown_checks
  FROM resolved
)
SELECT
  '202606150001' AS migration,
  s.total_required_checks,
  s.present_checks,
  s.absent_checks,
  s.conflicting_checks,
  s.unknown_checks,
  CASE
    WHEN s.present_checks = s.total_required_checks AND s.absent_checks = 0 AND s.conflicting_checks = 0 AND s.unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN s.present_checks = 0 AND s.absent_checks > 0 AND s.conflicting_checks = 0 THEN 'ABSENT'
    WHEN s.conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN s.present_checks > 0 AND s.absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM summary s;
