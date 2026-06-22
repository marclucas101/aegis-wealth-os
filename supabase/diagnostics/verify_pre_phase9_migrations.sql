-- Consolidated deep rollup for pre-Phase9 pending migrations:
-- 020, 021, 150001, 180001, 180002
-- Read-only. Catalog-safe.

WITH rollup_rows AS (
  SELECT * FROM (VALUES
    ('202606100020', 34,
      (SELECT COUNT(*) FROM (
        SELECT 1
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
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
      0,0
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
    r.migration,
    r.total_required_checks,
    GREATEST(LEAST(r.core_presence_count + r.structural_presence_count, r.total_required_checks), 0) AS present_checks,
    CASE
      WHEN r.migration = '202606150001' AND r.sensitive_conflict_probe > 0 THEN 1
      ELSE 0
    END AS conflicting_checks
  FROM rollup_rows r
),
final_rollup AS (
  SELECT
    n.migration,
    n.total_required_checks,
    n.present_checks,
    GREATEST(n.total_required_checks - n.present_checks - n.conflicting_checks, 0) AS absent_checks,
    n.conflicting_checks,
    0::int AS unknown_checks
  FROM normalized n
)
SELECT
  fr.migration,
  fr.total_required_checks,
  fr.present_checks,
  fr.absent_checks,
  fr.conflicting_checks,
  fr.unknown_checks,
  CASE
    WHEN fr.present_checks = fr.total_required_checks
      AND fr.absent_checks = 0
      AND fr.conflicting_checks = 0
      AND fr.unknown_checks = 0 THEN 'EXACT_MATCH'
    WHEN fr.present_checks = 0
      AND fr.absent_checks > 0
      AND fr.conflicting_checks = 0 THEN 'ABSENT'
    WHEN fr.conflicting_checks > 0 THEN 'CONFLICTING'
    WHEN fr.present_checks > 0
      AND fr.absent_checks > 0 THEN 'PARTIAL_MATCH'
    ELSE 'UNKNOWN'
  END AS classification
FROM final_rollup fr
ORDER BY fr.migration;
