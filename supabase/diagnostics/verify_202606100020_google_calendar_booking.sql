-- Read-only deep verification for 202606100020_google_calendar_booking.sql
-- Safe if objects are absent. Uses catalogs/information_schema only.

WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606100020','extension','public','btree_gist','btree_gist'),
    ('202606100020','table','public','adviser_calendar_connections',NULL),
    ('202606100020','table','public','adviser_calendar_settings',NULL),
    ('202606100020','table','public','adviser_appointments',NULL),
    ('202606100020','enum','public','adviser_appointment_status','pending|confirmed|cancelled|completed|failed'),
    ('202606100020','column','public','adviser_calendar_connections','provider'),
    ('202606100020','column','public','adviser_calendar_connections','encrypted_refresh_token'),
    ('202606100020','column','public','adviser_calendar_settings','appointment_duration_minutes'),
    ('202606100020','column','public','adviser_calendar_settings','location_type'),
    ('202606100020','column','public','adviser_appointments','status'),
    ('202606100020','column','public','adviser_appointments','idempotency_key'),
    ('202606100020','constraint','public','adviser_calendar_connections','adviser_calendar_connections_provider_check'),
    ('202606100020','constraint','public','adviser_calendar_settings','adviser_calendar_settings_location_check'),
    ('202606100020','constraint','public','adviser_appointments','adviser_appointments_time_check'),
    ('202606100020','constraint','public','adviser_appointments','adviser_appointments_no_overlap'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_adviser_starts'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_client_starts'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_status'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_idempotency'),
    ('202606100020','trigger','public','adviser_calendar_connections','adviser_calendar_connections_set_updated_at'),
    ('202606100020','trigger','public','adviser_calendar_settings','adviser_calendar_settings_set_updated_at'),
    ('202606100020','trigger','public','adviser_appointments','adviser_appointments_set_updated_at'),
    ('202606100020','rls_enabled','public','adviser_calendar_connections',NULL),
    ('202606100020','rls_enabled','public','adviser_calendar_settings',NULL),
    ('202606100020','rls_enabled','public','adviser_appointments',NULL),
    ('202606100020','policy','public','adviser_calendar_connections','adviser_calendar_connections_no_client_access'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_select_own_or_admin'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_insert_own_or_admin'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_update_own_or_admin'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_delete_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_select_own_client_or_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_insert_client_assigned'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_update_adviser_client_or_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_delete_admin')
  ) AS expected(migration, check_kind, schema_name, relation_name, object_name)
),
table_presence AS (
  SELECT n.nspname AS schema_name, c.relname AS relation_name, true AS is_present
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
),
column_presence AS (
  SELECT cols.table_schema AS schema_name, cols.table_name AS relation_name, cols.column_name AS object_name,
         cols.udt_name AS actual_type, cols.is_nullable, cols.column_default, true AS is_present
  FROM information_schema.columns cols
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
trigger_presence AS (
  SELECT n.nspname AS schema_name, rel.relname AS relation_name, tg.tgname AS object_name,
         pg_get_triggerdef(tg.oid) AS definition, true AS is_present
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE NOT tg.tgisinternal
),
policy_presence AS (
  SELECT pol.schemaname AS schema_name, pol.tablename AS relation_name, pol.policyname AS object_name,
         pol.cmd AS policy_cmd, true AS is_present
  FROM pg_policies pol
),
enum_presence AS (
  SELECT t.typname AS object_name, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) AS enum_values, true AS is_present
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typtype = 'e'
  GROUP BY t.typname
),
rls_presence AS (
  SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relrowsecurity AS is_present
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
),
extension_presence AS (
  SELECT ext.extname AS object_name, true AS is_present
  FROM pg_extension ext
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
      WHEN e.check_kind = 'constraint' THEN csp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'trigger' THEN trp.is_present
      WHEN e.check_kind = 'policy' THEN pp.is_present
      WHEN e.check_kind = 'enum' THEN ep.is_present
      WHEN e.check_kind = 'rls_enabled' THEN rp.is_present
      WHEN e.check_kind = 'extension' THEN exp.is_present
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'enum' AND ep.is_present THEN ep.enum_values
      WHEN e.check_kind = 'index' AND ip.is_present THEN ip.definition
      WHEN e.check_kind = 'constraint' AND csp.is_present THEN csp.definition
      WHEN e.check_kind = 'trigger' AND trp.is_present THEN trp.definition
      WHEN e.check_kind = 'policy' AND pp.is_present THEN pp.policy_cmd
      WHEN e.check_kind = 'column' AND cp.is_present THEN
        'type=' || cp.actual_type || ', nullable=' || cp.is_nullable || ', default=' || COALESCE(cp.column_default, 'NULL')
      ELSE NULL
    END AS actual_detail,
    CASE
      WHEN e.check_kind = 'enum' AND ep.is_present AND ep.enum_values <> e.object_name THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%adviser_appointments%' THEN true
      ELSE false
    END AS conflicting
  FROM expected_checks e
  LEFT JOIN table_presence tp
    ON e.check_kind = 'table' AND tp.schema_name = e.schema_name AND tp.relation_name = e.relation_name
  LEFT JOIN column_presence cp
    ON e.check_kind = 'column' AND cp.schema_name = e.schema_name AND cp.relation_name = e.relation_name AND cp.object_name = e.object_name
  LEFT JOIN constraint_presence csp
    ON e.check_kind = 'constraint' AND csp.schema_name = e.schema_name AND csp.relation_name = e.relation_name AND csp.object_name = e.object_name
  LEFT JOIN index_presence ip
    ON e.check_kind = 'index' AND ip.schema_name = e.schema_name AND ip.relation_name = e.relation_name AND ip.object_name = e.object_name
  LEFT JOIN trigger_presence trp
    ON e.check_kind = 'trigger' AND trp.schema_name = e.schema_name AND trp.relation_name = e.relation_name AND trp.object_name = e.object_name
  LEFT JOIN policy_presence pp
    ON e.check_kind = 'policy' AND pp.schema_name = e.schema_name AND pp.relation_name = e.relation_name AND pp.object_name = e.object_name
  LEFT JOIN enum_presence ep
    ON e.check_kind = 'enum' AND ep.object_name = e.relation_name
  LEFT JOIN rls_presence rp
    ON e.check_kind = 'rls_enabled' AND rp.schema_name = e.schema_name AND rp.relation_name = e.relation_name
  LEFT JOIN extension_presence exp
    ON e.check_kind = 'extension' AND exp.object_name = e.relation_name
)
SELECT
  r.migration,
  r.check_kind || ':' || COALESCE(r.expected_object_name, r.expected_relation_name) AS check_id,
  COALESCE(r.expected_schema_name || '.', '') || COALESCE(r.expected_relation_name, r.expected_object_name) AS expected_object,
  r.present,
  CASE
    WHEN r.present IS FALSE THEN 'absent'
    WHEN r.conflicting THEN 'conflicting'
    WHEN r.present IS TRUE THEN 'present'
    ELSE 'unknown'
  END AS state,
  r.actual_detail AS detail
FROM resolved r
ORDER BY check_id;

-- Rollup (CTE chain re-declared — PostgreSQL CTEs are statement-scoped)
WITH expected_checks AS (
  SELECT * FROM (VALUES
    ('202606100020','extension','public','btree_gist','btree_gist'),
    ('202606100020','table','public','adviser_calendar_connections',NULL),
    ('202606100020','table','public','adviser_calendar_settings',NULL),
    ('202606100020','table','public','adviser_appointments',NULL),
    ('202606100020','enum','public','adviser_appointment_status','pending|confirmed|cancelled|completed|failed'),
    ('202606100020','column','public','adviser_calendar_connections','provider'),
    ('202606100020','column','public','adviser_calendar_connections','encrypted_refresh_token'),
    ('202606100020','column','public','adviser_calendar_settings','appointment_duration_minutes'),
    ('202606100020','column','public','adviser_calendar_settings','location_type'),
    ('202606100020','column','public','adviser_appointments','status'),
    ('202606100020','column','public','adviser_appointments','idempotency_key'),
    ('202606100020','constraint','public','adviser_calendar_connections','adviser_calendar_connections_provider_check'),
    ('202606100020','constraint','public','adviser_calendar_settings','adviser_calendar_settings_location_check'),
    ('202606100020','constraint','public','adviser_appointments','adviser_appointments_time_check'),
    ('202606100020','constraint','public','adviser_appointments','adviser_appointments_no_overlap'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_adviser_starts'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_client_starts'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_status'),
    ('202606100020','index','public','adviser_appointments','idx_adviser_appointments_idempotency'),
    ('202606100020','trigger','public','adviser_calendar_connections','adviser_calendar_connections_set_updated_at'),
    ('202606100020','trigger','public','adviser_calendar_settings','adviser_calendar_settings_set_updated_at'),
    ('202606100020','trigger','public','adviser_appointments','adviser_appointments_set_updated_at'),
    ('202606100020','rls_enabled','public','adviser_calendar_connections',NULL),
    ('202606100020','rls_enabled','public','adviser_calendar_settings',NULL),
    ('202606100020','rls_enabled','public','adviser_appointments',NULL),
    ('202606100020','policy','public','adviser_calendar_connections','adviser_calendar_connections_no_client_access'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_select_own_or_admin'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_insert_own_or_admin'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_update_own_or_admin'),
    ('202606100020','policy','public','adviser_calendar_settings','adviser_calendar_settings_delete_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_select_own_client_or_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_insert_client_assigned'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_update_adviser_client_or_admin'),
    ('202606100020','policy','public','adviser_appointments','adviser_appointments_delete_admin')
  ) AS expected(migration, check_kind, schema_name, relation_name, object_name)
),
table_presence AS (
  SELECT n.nspname AS schema_name, c.relname AS relation_name, true AS is_present
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
),
column_presence AS (
  SELECT cols.table_schema AS schema_name, cols.table_name AS relation_name, cols.column_name AS object_name,
         cols.udt_name AS actual_type, cols.is_nullable, cols.column_default, true AS is_present
  FROM information_schema.columns cols
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
trigger_presence AS (
  SELECT n.nspname AS schema_name, rel.relname AS relation_name, tg.tgname AS object_name,
         pg_get_triggerdef(tg.oid) AS definition, true AS is_present
  FROM pg_trigger tg
  JOIN pg_class rel ON rel.oid = tg.tgrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE NOT tg.tgisinternal
),
policy_presence AS (
  SELECT pol.schemaname AS schema_name, pol.tablename AS relation_name, pol.policyname AS object_name,
         pol.cmd AS policy_cmd, true AS is_present
  FROM pg_policies pol
),
enum_presence AS (
  SELECT t.typname AS object_name, string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder) AS enum_values, true AS is_present
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typtype = 'e'
  GROUP BY t.typname
),
rls_presence AS (
  SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relrowsecurity AS is_present
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r','p')
),
extension_presence AS (
  SELECT ext.extname AS object_name, true AS is_present
  FROM pg_extension ext
),
resolved AS (
  SELECT
    CASE
      WHEN e.check_kind = 'table' THEN tp.is_present
      WHEN e.check_kind = 'column' THEN cp.is_present
      WHEN e.check_kind = 'constraint' THEN csp.is_present
      WHEN e.check_kind = 'index' THEN ip.is_present
      WHEN e.check_kind = 'trigger' THEN trp.is_present
      WHEN e.check_kind = 'policy' THEN pp.is_present
      WHEN e.check_kind = 'enum' THEN ep.is_present
      WHEN e.check_kind = 'rls_enabled' THEN rp.is_present
      WHEN e.check_kind = 'extension' THEN exp.is_present
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'enum' AND ep.is_present AND ep.enum_values <> e.object_name THEN true
      WHEN e.check_kind = 'index' AND ip.is_present AND ip.definition NOT ILIKE '%adviser_appointments%' THEN true
      ELSE false
    END AS conflicting
  FROM expected_checks e
  LEFT JOIN table_presence tp
    ON e.check_kind = 'table' AND tp.schema_name = e.schema_name AND tp.relation_name = e.relation_name
  LEFT JOIN column_presence cp
    ON e.check_kind = 'column' AND cp.schema_name = e.schema_name AND cp.relation_name = e.relation_name AND cp.object_name = e.object_name
  LEFT JOIN constraint_presence csp
    ON e.check_kind = 'constraint' AND csp.schema_name = e.schema_name AND csp.relation_name = e.relation_name AND csp.object_name = e.object_name
  LEFT JOIN index_presence ip
    ON e.check_kind = 'index' AND ip.schema_name = e.schema_name AND ip.relation_name = e.relation_name AND ip.object_name = e.object_name
  LEFT JOIN trigger_presence trp
    ON e.check_kind = 'trigger' AND trp.schema_name = e.schema_name AND trp.relation_name = e.relation_name AND trp.object_name = e.object_name
  LEFT JOIN policy_presence pp
    ON e.check_kind = 'policy' AND pp.schema_name = e.schema_name AND pp.relation_name = e.relation_name AND pp.object_name = e.object_name
  LEFT JOIN enum_presence ep
    ON e.check_kind = 'enum' AND ep.object_name = e.relation_name
  LEFT JOIN rls_presence rp
    ON e.check_kind = 'rls_enabled' AND rp.schema_name = e.schema_name AND rp.relation_name = e.relation_name
  LEFT JOIN extension_presence exp
    ON e.check_kind = 'extension' AND exp.object_name = e.relation_name
),
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE present IS TRUE AND NOT conflicting) AS present_checks,
    COUNT(*) FILTER (WHERE present IS FALSE) AS absent_checks,
    COUNT(*) FILTER (WHERE conflicting) AS conflicting_checks,
    COUNT(*) FILTER (WHERE present IS NULL) AS unknown_checks
  FROM resolved
)
SELECT
  '202606100020' AS migration,
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
