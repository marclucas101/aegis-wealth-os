-- Read-only deep verification for 202606180002_phase8b_adviser_created_appointments.sql

WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606180002','column','public','adviser_appointments','source'),
    ('202606180002','column','public','adviser_appointments','created_by_user_id'),
    ('202606180002','column','public','adviser_appointments','external_reference'),
    ('202606180002','column','public','adviser_appointments','external_url'),
    ('202606180002','column','public','adviser_appointments','private_adviser_note'),
    ('202606180002','column','public','adviser_appointments','phone_instructions'),
    ('202606180002','column','public','adviser_appointments','custom_meeting_link'),
    ('202606180002','column','public','adviser_appointments','location_text'),
    ('202606180002','column','public','adviser_appointments','notification_status'),
    ('202606180002','column','public','adviser_appointments','notification_error'),
    ('202606180002','column','public','adviser_appointments','calendar_sync_status'),
    ('202606180002','column','public','adviser_appointments','calendar_sync_error'),
    ('202606180002','constraint','public','adviser_appointments','adviser_appointments_source_check'),
    ('202606180002','constraint','public','adviser_appointments','adviser_appointments_notification_status_check'),
    ('202606180002','constraint','public','adviser_appointments','adviser_appointments_calendar_sync_status_check'),
    ('202606180002','index','public','adviser_appointments','idx_adviser_appointments_creator_idempotency'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.source'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.private_adviser_note'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.notification_status'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.calendar_sync_status'),
    ('202606180002','policy_retained','public','adviser_appointments','adviser_appointments_select_own_client_or_admin')
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
policy_presence AS (
  SELECT pol.schemaname AS schema_name, pol.tablename AS relation_name, pol.policyname AS object_name,
         pol.cmd AS policy_cmd, true AS is_present
  FROM pg_policies pol
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
      WHEN e.check_kind = 'policy_retained' THEN pp.is_present
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'constraint' AND e.object_name = 'adviser_appointments_source_check'
        AND csp.is_present AND csp.definition NOT ILIKE '%adviser_created%' THEN true
      WHEN e.check_kind = 'constraint' AND e.object_name = 'adviser_appointments_notification_status_check'
        AND csp.is_present AND csp.definition NOT ILIKE '%retrying%' THEN true
      WHEN e.check_kind = 'constraint' AND e.object_name = 'adviser_appointments_calendar_sync_status_check'
        AND csp.is_present AND csp.definition NOT ILIKE '%not_synced%' THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%created_by_user_id%' THEN true
      ELSE false
    END AS conflicting,
    CASE
      WHEN e.check_kind = 'column' AND cp.is_present THEN
        'type=' || cp.column_type || ', nullable=' || cp.is_nullable || ', default=' || COALESCE(cp.column_default, 'NULL')
      WHEN e.check_kind = 'constraint' AND csp.is_present THEN csp.definition
      WHEN e.check_kind = 'index' AND ip.is_present THEN ip.definition
      WHEN e.check_kind = 'comment' THEN cm.comment_text
      WHEN e.check_kind = 'policy_retained' AND pp.is_present THEN pp.policy_cmd
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
  LEFT JOIN policy_presence pp
    ON e.check_kind = 'policy_retained'
   AND pp.schema_name = e.schema_name
   AND pp.relation_name = e.relation_name
   AND pp.object_name = e.object_name
)
SELECT
  r.migration,
  r.check_kind || ':' || r.expected_object_name AS check_id,
  r.expected_schema_name || '.' || r.expected_relation_name || '/' || r.expected_object_name AS expected_object,
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
    ('202606180002','column','public','adviser_appointments','source'),
    ('202606180002','column','public','adviser_appointments','created_by_user_id'),
    ('202606180002','column','public','adviser_appointments','external_reference'),
    ('202606180002','column','public','adviser_appointments','external_url'),
    ('202606180002','column','public','adviser_appointments','private_adviser_note'),
    ('202606180002','column','public','adviser_appointments','phone_instructions'),
    ('202606180002','column','public','adviser_appointments','custom_meeting_link'),
    ('202606180002','column','public','adviser_appointments','location_text'),
    ('202606180002','column','public','adviser_appointments','notification_status'),
    ('202606180002','column','public','adviser_appointments','notification_error'),
    ('202606180002','column','public','adviser_appointments','calendar_sync_status'),
    ('202606180002','column','public','adviser_appointments','calendar_sync_error'),
    ('202606180002','constraint','public','adviser_appointments','adviser_appointments_source_check'),
    ('202606180002','constraint','public','adviser_appointments','adviser_appointments_notification_status_check'),
    ('202606180002','constraint','public','adviser_appointments','adviser_appointments_calendar_sync_status_check'),
    ('202606180002','index','public','adviser_appointments','idx_adviser_appointments_creator_idempotency'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.source'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.private_adviser_note'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.notification_status'),
    ('202606180002','comment','public','adviser_appointments','adviser_appointments.calendar_sync_status'),
    ('202606180002','policy_retained','public','adviser_appointments','adviser_appointments_select_own_client_or_admin')
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
policy_presence AS (
  SELECT pol.schemaname AS schema_name, pol.tablename AS relation_name, pol.policyname AS object_name,
         pol.cmd AS policy_cmd, true AS is_present
  FROM pg_policies pol
),
resolved AS (
  SELECT
    CASE
      WHEN e.check_kind = 'column' THEN cp.is_present
      WHEN e.check_kind = 'constraint' THEN csp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'comment' THEN (cm.comment_text IS NOT NULL)
      WHEN e.check_kind = 'policy_retained' THEN pp.is_present
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'constraint' AND e.object_name = 'adviser_appointments_source_check'
        AND csp.is_present AND csp.definition NOT ILIKE '%adviser_created%' THEN true
      WHEN e.check_kind = 'constraint' AND e.object_name = 'adviser_appointments_notification_status_check'
        AND csp.is_present AND csp.definition NOT ILIKE '%retrying%' THEN true
      WHEN e.check_kind = 'constraint' AND e.object_name = 'adviser_appointments_calendar_sync_status_check'
        AND csp.is_present AND csp.definition NOT ILIKE '%not_synced%' THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%created_by_user_id%' THEN true
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
  LEFT JOIN policy_presence pp
    ON e.check_kind = 'policy_retained'
   AND pp.schema_name = e.schema_name
   AND pp.relation_name = e.relation_name
   AND pp.object_name = e.object_name
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
  '202606180002' AS migration,
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
