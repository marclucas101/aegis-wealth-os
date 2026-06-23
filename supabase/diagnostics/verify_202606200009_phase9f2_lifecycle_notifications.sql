-- Read-only verification for 202606200009_phase9f2_lifecycle_notifications.sql

WITH
-- PHASE9F2_RESOLVED_CORE_BEGIN
expected AS (
  SELECT * FROM (VALUES
    ('202606200009','column','client_notifications','lifecycle_event'),
    ('202606200009','column','client_notifications','source_entity_type'),
    ('202606200009','column','client_notifications','source_lifecycle_version'),
    ('202606200009','column','client_notifications','idempotency_key'),
    ('202606200009','column','client_notifications','metadata'),
    ('202606200009','column_attr','client_notifications.lifecycle_event','data_type|text'),
    ('202606200009','column_attr','client_notifications.lifecycle_event','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.source_entity_type','data_type|text'),
    ('202606200009','column_attr','client_notifications.source_entity_type','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.source_lifecycle_version','data_type|text'),
    ('202606200009','column_attr','client_notifications.source_lifecycle_version','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.idempotency_key','data_type|text'),
    ('202606200009','column_attr','client_notifications.idempotency_key','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.metadata','data_type|jsonb'),
    ('202606200009','column_attr','client_notifications.metadata','is_nullable|NO'),
    ('202606200009','column_attr','client_notifications.metadata','default|{}'),
    ('202606200009','index','idx_client_notifications_lifecycle_idempotent','UNIQUE|client_notifications|idempotency_key'),
    ('202606200009','index_def','idx_client_notifications_lifecycle_idempotent','idempotency_key IS NOT NULL'),
    ('202606200009','index','idx_client_notifications_lifecycle_event','client_notifications|lifecycle_event, created_at DESC'),
    ('202606200009','index_def','idx_client_notifications_lifecycle_event','lifecycle_event IS NOT NULL'),
    ('202606200009','comment_col','client_notifications.lifecycle_event','Phase 9F.2'),
    ('202606200009','comment_col','client_notifications.idempotency_key','SHA-256'),
    ('202606200009','comment','client_notifications','Phase 9E/9F.2'),
    ('202606200009','rls','client_notifications','enabled'),
    ('202606200009','policy','client_notifications_select_owner','SELECT'),
    ('202606200009','policy','client_notifications_update_owner','UPDATE'),
    ('202606200009','no_policy','client_notifications','zero_adviser_policies'),
    ('202606200009','no_policy','client_notifications','zero_insert_policies'),
    ('202606200009','prereq_table','client_notifications',NULL),
    ('202606200009','prereq_table','communication_preferences',NULL),
    ('202606200009','prereq_table','communication_deliveries',NULL),
    ('202606200009','prereq_table','platform_feature_controls',NULL),
    ('202606200009','seed','platform_feature_controls.document_event_notifications','present')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
tbl AS (
  SELECT c.relname, c.relrowsecurity, c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
cols AS (
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
col_comments AS (
  SELECT
    c.relname AS table_name,
    a.attname AS column_name,
    d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
  WHERE n.nspname = 'public'
),
tbl_comment AS (
  SELECT c.relname AS table_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass AND d.objsubid = 0
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
index_key_cols AS (
  SELECT
    n.nspname AS schema_name,
    tbl.relname AS table_name,
    ic.relname AS index_name,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    pg_get_indexdef(ix.indexrelid) AS indexdef,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate_raw,
    (
      SELECT string_agg(
        a.attname ||
        CASE WHEN (ix.indoption[k.ordinality - 1] & 2) = 2 THEN ' DESC' ELSE '' END,
        ', ' ORDER BY k.ordinality
      )
      FROM unnest(ix.indkey::int[]) WITH ORDINALITY AS k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum AND k.attnum > 0
    ) AS key_columns_ordered
  FROM pg_index ix
  JOIN pg_class ic ON ic.oid = ix.indexrelid
  JOIN pg_class tbl ON tbl.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = ic.relnamespace
  WHERE n.nspname = 'public' AND ic.relkind = 'i'
),
index_catalog AS (
  SELECT
    ik.*,
    CASE
      WHEN ik.predicate_raw IS NULL THEN NULL::text
      ELSE regexp_replace(
        regexp_replace(
          lower(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  btrim(regexp_replace(ik.predicate_raw, '^\s*where\s+', '', 'i')),
                  '::text\b', '', 'gi'
                ),
                '''([^'']+)''::text', '''\1''', 'gi'
              ),
              '\s+', ' ', 'g'
            )
          ),
          '^\((.*)\)$', '\1'
        ),
        '^\((.*)\)$', '\1'
      )
    END AS predicate_canonical
  FROM index_key_cols ik
),
pol AS (
  SELECT tablename, policyname, cmd, roles::text AS roles_text
  FROM pg_policies
  WHERE schemaname = 'public'
),
adviser_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pol
  WHERE tablename = 'client_notifications'
    AND (roles_text ILIKE '%advisor%' OR roles_text ILIKE '%adviser%')
),
insert_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pol
  WHERE tablename = 'client_notifications' AND cmd = 'INSERT'
),
seed_probe AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1
        FROM platform_feature_controls pfc
        WHERE pfc.feature_key = 'document_event_notifications'
        LIMIT 1
      )
    END AS seed_present
),
refs AS (
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations'
      AND c.relname = 'schema_migrations'
      AND c.relkind IN ('r', 'p')
  ) AS history_table_exists
),
migration_history AS (
  SELECT
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = '202606200009'
      )
    END AS migration_recorded
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind || ':' || e.object_name
      || CASE WHEN e.expected_detail IS NULL OR e.expected_detail = '' THEN '' ELSE '.' || e.expected_detail END AS check_id,
    e.check_kind,
    e.object_name AS expected_object,
    e.expected_detail,
    CASE
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        CASE
          WHEN ik.table_name = 'client_notifications'
            AND ik.is_unique AND ik.is_valid AND ik.is_ready
            AND ik.key_columns_ordered = 'idempotency_key'
            THEN 'present'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        CASE
          WHEN ik.predicate_canonical = lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g')) THEN 'present'
          WHEN ik.predicate_raw IS NULL THEN 'conflicting'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        CASE
          WHEN ik.table_name = 'client_notifications'
            AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
            AND ik.key_columns_ordered = 'lifecycle_event, created_at DESC'
            THEN 'present'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        CASE
          WHEN ik.predicate_canonical = lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g')) THEN 'present'
          WHEN ik.predicate_raw IS NULL THEN 'conflicting'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND to_regclass('public.client_notifications') IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'column_attr' AND to_regclass('public.client_notifications') IS NULL THEN 'absent'
      WHEN e.check_kind = 'column_attr' AND ca.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'data_type'
        AND ca.data_type = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'is_nullable'
        AND ca.is_nullable = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'default'
        AND ca.column_default IS NOT NULL
        AND ca.column_default ILIKE '%' || split_part(e.expected_detail, '|', 2) || '%' THEN 'present'
      WHEN e.check_kind = 'column_attr' THEN 'conflicting'
      WHEN e.check_kind = 'comment_col' AND cc.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment_col' AND cc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment_col' THEN 'conflicting'
      WHEN e.check_kind = 'comment' AND tc.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment' AND tc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment' THEN 'conflicting'
      WHEN e.check_kind = 'rls' AND t.relname IS NULL THEN 'absent'
      WHEN e.check_kind = 'rls' AND t.relrowsecurity THEN 'present'
      WHEN e.check_kind = 'rls' THEN 'conflicting'
      WHEN e.check_kind = 'policy' AND p.policyname IS NULL THEN 'absent'
      WHEN e.check_kind = 'policy' AND p.cmd = e.expected_detail THEN 'present'
      WHEN e.check_kind = 'policy' THEN 'conflicting'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies'
        AND to_regclass('public.client_notifications') IS NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies'
        AND ap.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies'
        AND to_regclass('public.client_notifications') IS NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies'
        AND ip.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_policy' THEN 'conflicting'
      WHEN e.check_kind = 'prereq_table' AND to_regclass('public.' || e.object_name) IS NULL THEN 'absent'
      WHEN e.check_kind = 'prereq_table' THEN 'present'
      WHEN e.check_kind = 'seed' AND sp.seed_present IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND sp.seed_present THEN 'present'
      WHEN e.check_kind = 'seed' THEN 'conflicting'
      ELSE 'conflicting'
    END AS state,
    CASE
      WHEN e.check_kind = 'column' THEN c.column_name IS NOT NULL
      WHEN e.check_kind = 'column_attr' THEN ca.column_name IS NOT NULL
      WHEN e.check_kind IN ('index','index_def') THEN ik.index_name IS NOT NULL
      WHEN e.check_kind = 'comment_col' THEN cc.column_name IS NOT NULL
      WHEN e.check_kind = 'comment' THEN tc.table_name IS NOT NULL
      WHEN e.check_kind = 'rls' THEN t.relname IS NOT NULL
      WHEN e.check_kind = 'policy' THEN p.policyname IS NOT NULL
      WHEN e.check_kind = 'prereq_table' THEN to_regclass('public.' || e.object_name) IS NOT NULL
      WHEN e.check_kind = 'seed' THEN sp.seed_present IS NOT NULL
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'column_attr' THEN
        COALESCE(ca.data_type, '?') || '|' || COALESCE(ca.is_nullable, '?') || '|' || COALESCE(ca.column_default, '')
      WHEN e.check_kind IN ('index','index_def') THEN
        'schema=' || COALESCE(ik.schema_name, '?')
        || '|table=' || COALESCE(ik.table_name, '?')
        || '|unique=' || COALESCE(ik.is_unique::text, '?')
        || '|keys=' || COALESCE(ik.key_columns_ordered, '?')
        || '|predicate_raw=' || COALESCE(ik.predicate_raw, '')
      WHEN e.check_kind = 'rls' THEN
        CASE WHEN t.relrowsecurity THEN 'enabled' ELSE 'disabled' END
      WHEN e.check_kind = 'comment_col' THEN cc.description
      WHEN e.check_kind = 'comment' THEN tc.description
      WHEN e.check_kind = 'policy' THEN p.cmd
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies' THEN ap.policy_count::text
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies' THEN ip.policy_count::text
      WHEN e.check_kind = 'seed' THEN
        CASE
          WHEN sp.seed_present IS NULL THEN 'row_absent_or_table_missing'
          WHEN sp.seed_present THEN 'present'
          ELSE 'absent'
        END
      ELSE NULL
    END AS detail,
    e.expected_detail AS expected_canonical_detail,
    CASE
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        'schema=public|table=client_notifications|unique=true|keys=idempotency_key'
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g'))
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        'schema=public|table=client_notifications|unique=false|keys=lifecycle_event, created_at DESC'
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g'))
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NOT NULL THEN
        'schema=' || ik.schema_name
        || '|table=' || ik.table_name
        || '|unique=' || ik.is_unique::text
        || '|keys=' || COALESCE(ik.key_columns_ordered, '')
        || CASE WHEN e.check_kind = 'index_def' THEN '|predicate=' || COALESCE(ik.predicate_canonical, '') ELSE '' END
      WHEN e.check_kind = 'column_attr' THEN e.expected_detail
      WHEN e.check_kind = 'rls' THEN e.expected_detail
      WHEN e.check_kind = 'policy' THEN e.expected_detail
      WHEN e.check_kind = 'seed' THEN e.expected_detail
      ELSE NULL
    END AS actual_canonical_detail,
    mh.migration_recorded
  FROM expected e
  LEFT JOIN tbl t ON e.check_kind = 'rls' AND t.relname = e.object_name
  LEFT JOIN cols c ON e.check_kind = 'column' AND c.table_name = e.object_name AND c.column_name = e.expected_detail
  LEFT JOIN cols ca ON e.check_kind = 'column_attr'
    AND ca.table_name = split_part(e.object_name, '.', 1)
    AND ca.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN col_comments cc ON e.check_kind = 'comment_col'
    AND cc.table_name = split_part(e.object_name, '.', 1)
    AND cc.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
  LEFT JOIN pol p ON e.check_kind = 'policy' AND p.policyname = e.object_name
  LEFT JOIN index_catalog ik ON e.check_kind IN ('index','index_def') AND ik.index_name = e.object_name
  CROSS JOIN adviser_policies ap
  CROSS JOIN insert_policies ip
  CROSS JOIN seed_probe sp
  CROSS JOIN migration_history mh
)
-- PHASE9F2_RESOLVED_CORE_END
SELECT
  migration,
  check_id,
  check_kind,
  expected_object,
  expected_detail,
  present,
  detail,
  state,
  expected_canonical_detail,
  actual_canonical_detail,
  migration_recorded
FROM resolved
ORDER BY check_id;

-- Strict rollup (same resolved inventory as detail query above)
WITH
-- PHASE9F2_RESOLVED_CORE_BEGIN
expected AS (
  SELECT * FROM (VALUES
    ('202606200009','column','client_notifications','lifecycle_event'),
    ('202606200009','column','client_notifications','source_entity_type'),
    ('202606200009','column','client_notifications','source_lifecycle_version'),
    ('202606200009','column','client_notifications','idempotency_key'),
    ('202606200009','column','client_notifications','metadata'),
    ('202606200009','column_attr','client_notifications.lifecycle_event','data_type|text'),
    ('202606200009','column_attr','client_notifications.lifecycle_event','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.source_entity_type','data_type|text'),
    ('202606200009','column_attr','client_notifications.source_entity_type','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.source_lifecycle_version','data_type|text'),
    ('202606200009','column_attr','client_notifications.source_lifecycle_version','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.idempotency_key','data_type|text'),
    ('202606200009','column_attr','client_notifications.idempotency_key','is_nullable|YES'),
    ('202606200009','column_attr','client_notifications.metadata','data_type|jsonb'),
    ('202606200009','column_attr','client_notifications.metadata','is_nullable|NO'),
    ('202606200009','column_attr','client_notifications.metadata','default|{}'),
    ('202606200009','index','idx_client_notifications_lifecycle_idempotent','UNIQUE|client_notifications|idempotency_key'),
    ('202606200009','index_def','idx_client_notifications_lifecycle_idempotent','idempotency_key IS NOT NULL'),
    ('202606200009','index','idx_client_notifications_lifecycle_event','client_notifications|lifecycle_event, created_at DESC'),
    ('202606200009','index_def','idx_client_notifications_lifecycle_event','lifecycle_event IS NOT NULL'),
    ('202606200009','comment_col','client_notifications.lifecycle_event','Phase 9F.2'),
    ('202606200009','comment_col','client_notifications.idempotency_key','SHA-256'),
    ('202606200009','comment','client_notifications','Phase 9E/9F.2'),
    ('202606200009','rls','client_notifications','enabled'),
    ('202606200009','policy','client_notifications_select_owner','SELECT'),
    ('202606200009','policy','client_notifications_update_owner','UPDATE'),
    ('202606200009','no_policy','client_notifications','zero_adviser_policies'),
    ('202606200009','no_policy','client_notifications','zero_insert_policies'),
    ('202606200009','prereq_table','client_notifications',NULL),
    ('202606200009','prereq_table','communication_preferences',NULL),
    ('202606200009','prereq_table','communication_deliveries',NULL),
    ('202606200009','prereq_table','platform_feature_controls',NULL),
    ('202606200009','seed','platform_feature_controls.document_event_notifications','present')
  ) AS t(migration, check_kind, object_name, expected_detail)
),
tbl AS (
  SELECT c.relname, c.relrowsecurity, c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
cols AS (
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
col_comments AS (
  SELECT
    c.relname AS table_name,
    a.attname AS column_name,
    d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.objsubid = a.attnum
  WHERE n.nspname = 'public'
),
tbl_comment AS (
  SELECT c.relname AS table_name, d.description
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_description d ON d.objoid = c.oid AND d.classoid = 'pg_class'::regclass AND d.objsubid = 0
  WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
),
index_key_cols AS (
  SELECT
    n.nspname AS schema_name,
    tbl.relname AS table_name,
    ic.relname AS index_name,
    ix.indisunique AS is_unique,
    ix.indisvalid AS is_valid,
    ix.indisready AS is_ready,
    pg_get_indexdef(ix.indexrelid) AS indexdef,
    pg_get_expr(ix.indpred, ix.indrelid) AS predicate_raw,
    (
      SELECT string_agg(
        a.attname ||
        CASE WHEN (ix.indoption[k.ordinality - 1] & 2) = 2 THEN ' DESC' ELSE '' END,
        ', ' ORDER BY k.ordinality
      )
      FROM unnest(ix.indkey::int[]) WITH ORDINALITY AS k(attnum, ordinality)
      JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = k.attnum AND k.attnum > 0
    ) AS key_columns_ordered
  FROM pg_index ix
  JOIN pg_class ic ON ic.oid = ix.indexrelid
  JOIN pg_class tbl ON tbl.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = ic.relnamespace
  WHERE n.nspname = 'public' AND ic.relkind = 'i'
),
index_catalog AS (
  SELECT
    ik.*,
    CASE
      WHEN ik.predicate_raw IS NULL THEN NULL::text
      ELSE regexp_replace(
        regexp_replace(
          lower(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  btrim(regexp_replace(ik.predicate_raw, '^\s*where\s+', '', 'i')),
                  '::text\b', '', 'gi'
                ),
                '''([^'']+)''::text', '''\1''', 'gi'
              ),
              '\s+', ' ', 'g'
            )
          ),
          '^\((.*)\)$', '\1'
        ),
        '^\((.*)\)$', '\1'
      )
    END AS predicate_canonical
  FROM index_key_cols ik
),
pol AS (
  SELECT tablename, policyname, cmd, roles::text AS roles_text
  FROM pg_policies
  WHERE schemaname = 'public'
),
adviser_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pol
  WHERE tablename = 'client_notifications'
    AND (roles_text ILIKE '%advisor%' OR roles_text ILIKE '%adviser%')
),
insert_policies AS (
  SELECT count(*)::bigint AS policy_count
  FROM pol
  WHERE tablename = 'client_notifications' AND cmd = 'INSERT'
),
seed_probe AS (
  SELECT
    CASE
      WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1
        FROM platform_feature_controls pfc
        WHERE pfc.feature_key = 'document_event_notifications'
        LIMIT 1
      )
    END AS seed_present
),
refs AS (
  SELECT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'supabase_migrations'
      AND c.relname = 'schema_migrations'
      AND c.relkind IN ('r', 'p')
  ) AS history_table_exists
),
migration_history AS (
  SELECT
    CASE
      WHEN NOT (SELECT history_table_exists FROM refs) THEN NULL::boolean
      ELSE EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = '202606200009'
      )
    END AS migration_recorded
),
resolved AS (
  SELECT
    e.migration,
    e.check_kind || ':' || e.object_name
      || CASE WHEN e.expected_detail IS NULL OR e.expected_detail = '' THEN '' ELSE '.' || e.expected_detail END AS check_id,
    e.check_kind,
    e.object_name AS expected_object,
    e.expected_detail,
    CASE
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        CASE
          WHEN ik.table_name = 'client_notifications'
            AND ik.is_unique AND ik.is_valid AND ik.is_ready
            AND ik.key_columns_ordered = 'idempotency_key'
            THEN 'present'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        CASE
          WHEN ik.predicate_canonical = lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g')) THEN 'present'
          WHEN ik.predicate_raw IS NULL THEN 'conflicting'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        CASE
          WHEN ik.table_name = 'client_notifications'
            AND NOT ik.is_unique AND ik.is_valid AND ik.is_ready
            AND ik.key_columns_ordered = 'lifecycle_event, created_at DESC'
            THEN 'present'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        CASE
          WHEN ik.predicate_canonical = lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g')) THEN 'present'
          WHEN ik.predicate_raw IS NULL THEN 'conflicting'
          WHEN ik.index_name IS NULL THEN 'absent'
          ELSE 'conflicting'
        END
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND to_regclass('public.client_notifications') IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column' AND c.column_name IS NOT NULL THEN 'present'
      WHEN e.check_kind = 'column_attr' AND to_regclass('public.client_notifications') IS NULL THEN 'absent'
      WHEN e.check_kind = 'column_attr' AND ca.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'data_type'
        AND ca.data_type = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'is_nullable'
        AND ca.is_nullable = split_part(e.expected_detail, '|', 2) THEN 'present'
      WHEN e.check_kind = 'column_attr' AND split_part(e.expected_detail, '|', 1) = 'default'
        AND ca.column_default IS NOT NULL
        AND ca.column_default ILIKE '%' || split_part(e.expected_detail, '|', 2) || '%' THEN 'present'
      WHEN e.check_kind = 'column_attr' THEN 'conflicting'
      WHEN e.check_kind = 'comment_col' AND cc.column_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment_col' AND cc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment_col' THEN 'conflicting'
      WHEN e.check_kind = 'comment' AND tc.table_name IS NULL THEN 'absent'
      WHEN e.check_kind = 'comment' AND tc.description ILIKE '%' || e.expected_detail || '%' THEN 'present'
      WHEN e.check_kind = 'comment' THEN 'conflicting'
      WHEN e.check_kind = 'rls' AND t.relname IS NULL THEN 'absent'
      WHEN e.check_kind = 'rls' AND t.relrowsecurity THEN 'present'
      WHEN e.check_kind = 'rls' THEN 'conflicting'
      WHEN e.check_kind = 'policy' AND p.policyname IS NULL THEN 'absent'
      WHEN e.check_kind = 'policy' AND p.cmd = e.expected_detail THEN 'present'
      WHEN e.check_kind = 'policy' THEN 'conflicting'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies'
        AND to_regclass('public.client_notifications') IS NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies'
        AND ap.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies'
        AND to_regclass('public.client_notifications') IS NULL THEN 'present'
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies'
        AND ip.policy_count = 0 THEN 'present'
      WHEN e.check_kind = 'no_policy' THEN 'conflicting'
      WHEN e.check_kind = 'prereq_table' AND to_regclass('public.' || e.object_name) IS NULL THEN 'absent'
      WHEN e.check_kind = 'prereq_table' THEN 'present'
      WHEN e.check_kind = 'seed' AND sp.seed_present IS NULL THEN 'unknown'
      WHEN e.check_kind = 'seed' AND sp.seed_present THEN 'present'
      WHEN e.check_kind = 'seed' THEN 'conflicting'
      ELSE 'conflicting'
    END AS state,
    CASE
      WHEN e.check_kind = 'column' THEN c.column_name IS NOT NULL
      WHEN e.check_kind = 'column_attr' THEN ca.column_name IS NOT NULL
      WHEN e.check_kind IN ('index','index_def') THEN ik.index_name IS NOT NULL
      WHEN e.check_kind = 'comment_col' THEN cc.column_name IS NOT NULL
      WHEN e.check_kind = 'comment' THEN tc.table_name IS NOT NULL
      WHEN e.check_kind = 'rls' THEN t.relname IS NOT NULL
      WHEN e.check_kind = 'policy' THEN p.policyname IS NOT NULL
      WHEN e.check_kind = 'prereq_table' THEN to_regclass('public.' || e.object_name) IS NOT NULL
      WHEN e.check_kind = 'seed' THEN sp.seed_present IS NOT NULL
      ELSE NULL::boolean
    END AS present,
    CASE
      WHEN e.check_kind = 'column_attr' THEN
        COALESCE(ca.data_type, '?') || '|' || COALESCE(ca.is_nullable, '?') || '|' || COALESCE(ca.column_default, '')
      WHEN e.check_kind IN ('index','index_def') THEN
        'schema=' || COALESCE(ik.schema_name, '?')
        || '|table=' || COALESCE(ik.table_name, '?')
        || '|unique=' || COALESCE(ik.is_unique::text, '?')
        || '|keys=' || COALESCE(ik.key_columns_ordered, '?')
        || '|predicate_raw=' || COALESCE(ik.predicate_raw, '')
      WHEN e.check_kind = 'rls' THEN
        CASE WHEN t.relrowsecurity THEN 'enabled' ELSE 'disabled' END
      WHEN e.check_kind = 'comment_col' THEN cc.description
      WHEN e.check_kind = 'comment' THEN tc.description
      WHEN e.check_kind = 'policy' THEN p.cmd
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_adviser_policies' THEN ap.policy_count::text
      WHEN e.check_kind = 'no_policy' AND e.expected_detail = 'zero_insert_policies' THEN ip.policy_count::text
      WHEN e.check_kind = 'seed' THEN
        CASE
          WHEN sp.seed_present IS NULL THEN 'row_absent_or_table_missing'
          WHEN sp.seed_present THEN 'present'
          ELSE 'absent'
        END
      ELSE NULL
    END AS detail,
    e.expected_detail AS expected_canonical_detail,
    CASE
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        'schema=public|table=client_notifications|unique=true|keys=idempotency_key'
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_idempotent' THEN
        lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g'))
      WHEN e.check_kind = 'index' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        'schema=public|table=client_notifications|unique=false|keys=lifecycle_event, created_at DESC'
      WHEN e.check_kind = 'index_def' AND e.object_name = 'idx_client_notifications_lifecycle_event' THEN
        lower(regexp_replace(e.expected_detail, '\s+', ' ', 'g'))
      WHEN e.check_kind IN ('index','index_def') AND ik.index_name IS NOT NULL THEN
        'schema=' || ik.schema_name
        || '|table=' || ik.table_name
        || '|unique=' || ik.is_unique::text
        || '|keys=' || COALESCE(ik.key_columns_ordered, '')
        || CASE WHEN e.check_kind = 'index_def' THEN '|predicate=' || COALESCE(ik.predicate_canonical, '') ELSE '' END
      WHEN e.check_kind = 'column_attr' THEN e.expected_detail
      WHEN e.check_kind = 'rls' THEN e.expected_detail
      WHEN e.check_kind = 'policy' THEN e.expected_detail
      WHEN e.check_kind = 'seed' THEN e.expected_detail
      ELSE NULL
    END AS actual_canonical_detail,
    mh.migration_recorded
  FROM expected e
  LEFT JOIN tbl t ON e.check_kind = 'rls' AND t.relname = e.object_name
  LEFT JOIN cols c ON e.check_kind = 'column' AND c.table_name = e.object_name AND c.column_name = e.expected_detail
  LEFT JOIN cols ca ON e.check_kind = 'column_attr'
    AND ca.table_name = split_part(e.object_name, '.', 1)
    AND ca.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN col_comments cc ON e.check_kind = 'comment_col'
    AND cc.table_name = split_part(e.object_name, '.', 1)
    AND cc.column_name = split_part(e.object_name, '.', 2)
  LEFT JOIN tbl_comment tc ON e.check_kind = 'comment' AND tc.table_name = e.object_name
  LEFT JOIN pol p ON e.check_kind = 'policy' AND p.policyname = e.object_name
  LEFT JOIN index_catalog ik ON e.check_kind IN ('index','index_def') AND ik.index_name = e.object_name
  CROSS JOIN adviser_policies ap
  CROSS JOIN insert_policies ip
  CROSS JOIN seed_probe sp
  CROSS JOIN migration_history mh
)
-- PHASE9F2_RESOLVED_CORE_END
,
summary AS (
  SELECT
    COUNT(*) AS total_required_checks,
    COUNT(*) FILTER (WHERE state = 'present') AS present_checks,
    COUNT(*) FILTER (WHERE state = 'absent') AS absent_checks,
    COUNT(*) FILTER (WHERE state = 'conflicting') AS conflicting_checks,
    COUNT(*) FILTER (WHERE state = 'unknown') AS unknown_checks
  FROM resolved
)
SELECT
  '202606200009' AS migration,
  total_required_checks,
  present_checks,
  absent_checks,
  conflicting_checks,
  unknown_checks,
  CASE
    WHEN present_checks = total_required_checks AND absent_checks = 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN present_checks = 0 AND absent_checks > 0 AND conflicting_checks = 0 AND unknown_checks = 0 THEN 'ABSENT'
    WHEN conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN unknown_checks > 0 THEN 'UNKNOWN'
    ELSE 'PARTIAL_MATCH'
  END AS classification
FROM summary;
