-- Post-remediation verification rollup (read-only).
-- Requires dedicated deep diagnostics to report EXACT_MATCH for pre-Phase-9 migrations.
-- Does NOT mark migration history applied.

WITH pre_phase9 AS (
  SELECT * FROM (VALUES
    ('202606100020', 34,
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('adviser_calendar_connections','adviser_calendar_settings','adviser_appointments')
      ) q),
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM pg_policies pol WHERE pol.schemaname='public' AND pol.tablename IN ('adviser_calendar_connections','adviser_calendar_settings','adviser_appointments')
      ) q),
      (SELECT COUNT(*) FROM (
        SELECT 1 FROM pg_indexes idx WHERE idx.schemaname='public' AND idx.tablename='adviser_appointments'
      ) q)
    ),
    ('202606100021', 3,
      (SELECT COUNT(*) FROM pg_indexes idx WHERE idx.schemaname='public'
        AND idx.indexname IN ('idx_adviser_feedback_client_created','idx_clients_advisor_display_name','idx_discover_profiles_client_current')),
      0, 0
    ),
    ('202606150001', 7,
      (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='clients' AND c.column_name='user_id'),
      (SELECT COUNT(*) FROM pg_indexes idx WHERE idx.schemaname='public' AND idx.tablename='clients' AND idx.indexname='clients_user_id_unique'),
      (SELECT CASE
        WHEN EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relname='clients' AND c.relkind IN ('r','p')
        ) THEN COALESCE(
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
        ELSE 0
      END)
    ),
    ('202606180001', 13,
      (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='clients' AND c.column_name='date_of_birth')
      + (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='advisor_tasks' AND c.column_name IN ('source_key','dismissed_at','metadata')),
      (SELECT COUNT(*) FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid JOIN pg_namespace n ON n.oid=rel.relnamespace
        WHERE n.nspname='public' AND ((rel.relname='clients' AND con.conname='clients_date_of_birth_not_future') OR (rel.relname='advisor_tasks' AND con.conname='advisor_tasks_task_type_check'))),
      (SELECT COUNT(*) FROM pg_indexes idx WHERE idx.schemaname='public' AND idx.tablename='advisor_tasks' AND idx.indexname IN ('idx_advisor_tasks_source_key_unique','idx_advisor_tasks_birthday_open'))
    ),
    ('202606180002', 21,
      (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name='adviser_appointments'
        AND c.column_name IN ('source','created_by_user_id','external_reference','external_url','private_adviser_note','phone_instructions','custom_meeting_link','location_text','notification_status','notification_error','calendar_sync_status','calendar_sync_error')),
      (SELECT COUNT(*) FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid JOIN pg_namespace n ON n.oid=rel.relnamespace
        WHERE n.nspname='public' AND rel.relname='adviser_appointments'
          AND con.conname IN ('adviser_appointments_source_check','adviser_appointments_notification_status_check','adviser_appointments_calendar_sync_status_check')),
      (SELECT COUNT(*) FROM pg_indexes idx WHERE idx.schemaname='public' AND idx.tablename='adviser_appointments' AND idx.indexname='idx_adviser_appointments_creator_idempotency')
    )
  ) AS x(migration, total_required_checks, core_presence_count, structural_presence_count, sensitive_conflict_probe)
),
normalized AS (
  SELECT
    p.migration,
    p.total_required_checks,
    GREATEST(LEAST(p.core_presence_count + p.structural_presence_count, p.total_required_checks), 0) AS present_checks,
    CASE WHEN p.migration = '202606150001' AND p.sensitive_conflict_probe > 0 THEN 1 ELSE 0 END AS conflicting_checks
  FROM pre_phase9 p
),
rollup AS (
  SELECT
    n.migration,
    n.total_required_checks,
    n.present_checks,
    GREATEST(n.total_required_checks - n.present_checks - n.conflicting_checks, 0) AS absent_checks,
    n.conflicting_checks,
    0::int AS unknown_checks,
    CASE
      WHEN n.present_checks = n.total_required_checks AND n.conflicting_checks = 0 THEN 'EXACT_MATCH'
      WHEN n.present_checks > 0 AND n.total_required_checks - n.present_checks - n.conflicting_checks > 0 THEN 'PARTIAL_MATCH'
      WHEN n.conflicting_checks > 0 THEN 'CONFLICTING'
      ELSE 'UNKNOWN'
    END AS classification
  FROM normalized n
)
SELECT
  r.migration,
  r.total_required_checks,
  r.present_checks,
  r.absent_checks,
  r.conflicting_checks,
  r.unknown_checks,
  r.classification,
  CASE WHEN r.classification = 'EXACT_MATCH' THEN true ELSE false END AS remediation_verified
FROM rollup r
ORDER BY r.migration;

-- Supplemental safety probes (must be READY after remediation)
SELECT
  'duplicate_clients_user_id' AS probe,
  CASE
    WHEN COALESCE(
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
    ) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS result
WHERE EXISTS (
  SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'clients'
);

-- Remediation migrations must NOT auto-mark historical migrations (informational)
SELECT
  'remediation_history_not_modified_by_script' AS assertion,
  'This script performs no writes to supabase_migrations.schema_migrations' AS detail;
