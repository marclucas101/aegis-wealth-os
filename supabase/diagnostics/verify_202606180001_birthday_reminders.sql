-- Read-only deep verification for 202606180001_phase8a_client_birthday_reminders.sql

WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606180001','column','public','clients','date_of_birth'),
    ('202606180001','constraint','public','clients','clients_date_of_birth_not_future'),
    ('202606180001','comment','public','clients','clients.date_of_birth'),
    ('202606180001','column','public','advisor_tasks','source_key'),
    ('202606180001','column','public','advisor_tasks','dismissed_at'),
    ('202606180001','column','public','advisor_tasks','metadata'),
    ('202606180001','constraint','public','advisor_tasks','advisor_tasks_task_type_check'),
    ('202606180001','index','public','advisor_tasks','idx_advisor_tasks_source_key_unique'),
    ('202606180001','index','public','advisor_tasks','idx_advisor_tasks_birthday_open'),
    ('202606180001','comment','public','advisor_tasks','advisor_tasks.source_key'),
    ('202606180001','comment','public','advisor_tasks','advisor_tasks.dismissed_at'),
    ('202606180001','comment','public','advisor_tasks','advisor_tasks.metadata'),
    ('202606180001','cron_metadata_expected','public',NULL,'none_in_migration')
  ) AS expected(migration, check_kind, schema_name, relation_name, object_name)
),
column_presence AS (
  SELECT c.table_schema AS schema_name, c.table_name AS relation_name, c.column_name,
         c.udt_name AS column_type, c.is_nullable, c.column_default, true AS is_present
  FROM information_schema.columns c
),
constraint_presence AS (
  SELECT n.nspname AS schema_name, rel.relname AS relation_name, con.conname AS object_name,
         pg_get_constraintdef(con.oid) AS definition, true AS is_present
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
),
index_presence AS (
  SELECT idx.schemaname AS schema_name, idx.tablename AS relation_name, idx.indexname AS object_name,
         idx.indexdef AS definition, true AS is_present
  FROM pg_indexes idx
),
comment_presence AS (
  SELECT
    n.nspname AS schema_name,
    rel.relname AS relation_name,
    a.attname AS column_name,
    col_description(rel.oid, a.attnum) AS comment_text
  FROM pg_class rel
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_attribute a ON a.attrelid = rel.oid
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
cron_presence AS (
  SELECT
    EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'cron' AND c.relname = 'job' AND c.relkind IN ('r','p')
    ) AS cron_job_catalog_exists
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind,
    e.schema_name AS expected_schema_name,
    e.relation_name AS expected_relation_name,
    e.object_name AS expected_object_name,
    CASE
      WHEN e.check_kind = 'column' THEN cp.is_present
      WHEN e.check_kind = 'constraint' THEN csp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'comment' THEN (cm.comment_text IS NOT NULL)
      WHEN e.check_kind = 'cron_metadata_expected' THEN true
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'constraint' AND csp.is_present AND csp.definition NOT ILIKE '%date_of_birth <= CURRENT_DATE%' AND e.object_name = 'clients_date_of_birth_not_future' THEN true
      WHEN e.check_kind = 'constraint' AND csp.is_present AND csp.definition NOT ILIKE '%client_birthday%' AND e.object_name = 'advisor_tasks_task_type_check' THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%source_key%' AND e.object_name = 'idx_advisor_tasks_source_key_unique' THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%task_type = ''client_birthday''%' AND e.object_name = 'idx_advisor_tasks_birthday_open' THEN true
      ELSE false
    END AS conflicting,
    CASE
      WHEN e.check_kind = 'column' AND cp.is_present THEN
        'type=' || cp.column_type || ', nullable=' || cp.is_nullable || ', default=' || COALESCE(cp.column_default, 'NULL')
      WHEN e.check_kind = 'constraint' AND csp.is_present THEN csp.definition
      WHEN e.check_kind = 'index' AND ip.is_present THEN ip.definition
      WHEN e.check_kind = 'comment' THEN cm.comment_text
      WHEN e.check_kind = 'cron_metadata_expected' THEN
        'migration does not create cron schedule objects; cron.job catalog exists=' || cr.cron_job_catalog_exists::text
      ELSE NULL
    END AS detail
  FROM expected_checks e
  LEFT JOIN column_presence cp
    ON e.check_kind = 'column'
   AND cp.schema_name = e.schema_name
   AND cp.relation_name = e.relation_name
   AND cp.column_name = e.object_name
  LEFT JOIN constraint_presence csp
    ON e.check_kind = 'constraint'
   AND csp.schema_name = e.schema_name
   AND csp.relation_name = e.relation_name
   AND csp.object_name = e.object_name
  LEFT JOIN index_presence ip
    ON e.check_kind = 'index'
   AND ip.schema_name = e.schema_name
   AND ip.relation_name = e.relation_name
   AND ip.object_name = e.object_name
  LEFT JOIN comment_presence cm
    ON e.check_kind = 'comment'
   AND cm.schema_name = e.schema_name
   AND cm.relation_name = e.relation_name
   AND cm.column_name = split_part(e.object_name, '.', 2)
  CROSS JOIN cron_presence cr
)
SELECT
  r.migration,
  r.check_kind || ':' || COALESCE(r.expected_object_name, r.expected_relation_name, 'n/a') AS check_id,
  COALESCE(r.expected_schema_name || '.', '') || COALESCE(r.expected_relation_name, '') || '/' || COALESCE(r.expected_object_name, 'n/a') AS expected_object,
  r.present,
  CASE
    WHEN r.present IS FALSE THEN 'absent'
    WHEN r.conflicting THEN 'conflicting'
    WHEN r.present IS TRUE THEN 'present'
    ELSE 'unknown'
  END AS state,
  r.detail
FROM resolved r
ORDER BY check_id;

-- Rollup (CTE chain re-declared — PostgreSQL CTEs are statement-scoped)
WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606180001','column','public','clients','date_of_birth'),
    ('202606180001','constraint','public','clients','clients_date_of_birth_not_future'),
    ('202606180001','comment','public','clients','clients.date_of_birth'),
    ('202606180001','column','public','advisor_tasks','source_key'),
    ('202606180001','column','public','advisor_tasks','dismissed_at'),
    ('202606180001','column','public','advisor_tasks','metadata'),
    ('202606180001','constraint','public','advisor_tasks','advisor_tasks_task_type_check'),
    ('202606180001','index','public','advisor_tasks','idx_advisor_tasks_source_key_unique'),
    ('202606180001','index','public','advisor_tasks','idx_advisor_tasks_birthday_open'),
    ('202606180001','comment','public','advisor_tasks','advisor_tasks.source_key'),
    ('202606180001','comment','public','advisor_tasks','advisor_tasks.dismissed_at'),
    ('202606180001','comment','public','advisor_tasks','advisor_tasks.metadata'),
    ('202606180001','cron_metadata_expected','public',NULL,'none_in_migration')
  ) AS expected(migration, check_kind, schema_name, relation_name, object_name)
),
column_presence AS (
  SELECT c.table_schema AS schema_name, c.table_name AS relation_name, c.column_name,
         c.udt_name AS column_type, c.is_nullable, c.column_default, true AS is_present
  FROM information_schema.columns c
),
constraint_presence AS (
  SELECT n.nspname AS schema_name, rel.relname AS relation_name, con.conname AS object_name,
         pg_get_constraintdef(con.oid) AS definition, true AS is_present
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
),
index_presence AS (
  SELECT idx.schemaname AS schema_name, idx.tablename AS relation_name, idx.indexname AS object_name,
         idx.indexdef AS definition, true AS is_present
  FROM pg_indexes idx
),
comment_presence AS (
  SELECT
    n.nspname AS schema_name,
    rel.relname AS relation_name,
    a.attname AS column_name,
    col_description(rel.oid, a.attnum) AS comment_text
  FROM pg_class rel
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_attribute a ON a.attrelid = rel.oid
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
cron_presence AS (
  SELECT
    EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'cron' AND c.relname = 'job' AND c.relkind IN ('r','p')
    ) AS cron_job_catalog_exists
),
resolved AS (
  SELECT
    CASE
      WHEN e.check_kind = 'column' THEN cp.is_present
      WHEN e.check_kind = 'constraint' THEN csp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'comment' THEN (cm.comment_text IS NOT NULL)
      WHEN e.check_kind = 'cron_metadata_expected' THEN true
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'constraint' AND csp.is_present AND csp.definition NOT ILIKE '%date_of_birth <= CURRENT_DATE%' AND e.object_name = 'clients_date_of_birth_not_future' THEN true
      WHEN e.check_kind = 'constraint' AND csp.is_present AND csp.definition NOT ILIKE '%client_birthday%' AND e.object_name = 'advisor_tasks_task_type_check' THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%source_key%' AND e.object_name = 'idx_advisor_tasks_source_key_unique' THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%task_type = ''client_birthday''%' AND e.object_name = 'idx_advisor_tasks_birthday_open' THEN true
      ELSE false
    END AS conflicting
  FROM expected_checks e
  LEFT JOIN column_presence cp
    ON e.check_kind = 'column'
   AND cp.schema_name = e.schema_name
   AND cp.relation_name = e.relation_name
   AND cp.column_name = e.object_name
  LEFT JOIN constraint_presence csp
    ON e.check_kind = 'constraint'
   AND csp.schema_name = e.schema_name
   AND csp.relation_name = e.relation_name
   AND csp.object_name = e.object_name
  LEFT JOIN index_presence ip
    ON e.check_kind = 'index'
   AND ip.schema_name = e.schema_name
   AND ip.relation_name = e.relation_name
   AND ip.object_name = e.object_name
  LEFT JOIN comment_presence cm
    ON e.check_kind = 'comment'
   AND cm.schema_name = e.schema_name
   AND cm.relation_name = e.relation_name
   AND cm.column_name = split_part(e.object_name, '.', 2)
  CROSS JOIN cron_presence cr
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
  '202606180001' AS migration,
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
