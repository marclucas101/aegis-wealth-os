-- Read-only preflight before pre-Phase-9 migration history repair (no schema writes).
-- Safe when optional tables are absent. No writes. No migration-history changes.
-- Single-statement design: all CTEs are scoped to this one SELECT.
-- Run before applying reconciliation migrations on remote.

WITH clients_exists AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'clients' AND c.relkind IN ('r', 'p')
  ) AS ok
),
users_exists AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'users' AND c.relkind IN ('r', 'p')
  ) AS ok
),
advisor_tasks_exists AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'advisor_tasks' AND c.relkind IN ('r', 'p')
  ) AS ok
),
appointments_exists AS (
  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'adviser_appointments' AND c.relkind IN ('r', 'p')
  ) AS ok
),
duplicate_user_id AS (
  SELECT
    CASE
      WHEN (SELECT ok FROM clients_exists) THEN COALESCE(
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
    END AS duplicate_group_count
),
user_id_column AS (
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
    ) AS column_exists,
    (
      SELECT udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
    ) AS column_type,
    (
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'user_id'
    ) AS is_nullable
),
orphan_user_id AS (
  SELECT
    CASE
      WHEN (SELECT ok FROM clients_exists) AND (SELECT ok FROM users_exists) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM public.clients c WHERE c.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = c.user_id)',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS orphan_count
),
unique_index AS (
  SELECT
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'clients_user_id_unique'
    ) AS index_exists,
    (
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'clients_user_id_unique'
    ) AS index_definition
),
appt_counts AS (
  SELECT
    (SELECT ok FROM appointments_exists) AS ok,
    CASE
      WHEN (SELECT ok FROM appointments_exists) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM (SELECT 1 FROM public.adviser_appointments a JOIN public.adviser_appointments b ON a.adviser_user_id = b.adviser_user_id AND a.id < b.id WHERE a.status IN (''pending'', ''confirmed'') AND b.status IN (''pending'', ''confirmed'') AND tstzrange(a.starts_at, a.ends_at, ''[)'') && tstzrange(b.starts_at, b.ends_at, ''[)'')) d',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS overlap_count,
    CASE
      WHEN (SELECT ok FROM appointments_exists) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM (SELECT client_user_id, idempotency_key FROM public.adviser_appointments WHERE idempotency_key IS NOT NULL GROUP BY client_user_id, idempotency_key HAVING count(*) > 1) d',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS idem_dup_count,
    CASE
      WHEN (SELECT ok FROM appointments_exists) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM (SELECT created_by_user_id, idempotency_key FROM public.adviser_appointments WHERE idempotency_key IS NOT NULL AND created_by_user_id IS NOT NULL GROUP BY created_by_user_id, idempotency_key HAVING count(*) > 1) d',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS creator_idem_dup_count,
    CASE
      WHEN (SELECT ok FROM appointments_exists)
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'source'
        ) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM public.adviser_appointments WHERE source IS NOT NULL AND source NOT IN (''client_booking'', ''adviser_created'', ''external_import'')',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS invalid_source_count,
    CASE
      WHEN (SELECT ok FROM appointments_exists)
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'notification_status'
        ) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM public.adviser_appointments WHERE notification_status IS NOT NULL AND notification_status NOT IN (''pending'', ''sent'', ''failed'', ''retrying'')',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS invalid_notif_count,
    CASE
      WHEN (SELECT ok FROM appointments_exists)
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'calendar_sync_status'
        ) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM public.adviser_appointments WHERE calendar_sync_status IS NOT NULL AND calendar_sync_status NOT IN (''not_synced'', ''synced'', ''failed'', ''skipped'')',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS invalid_sync_count
),
future_dob AS (
  SELECT
    CASE
      WHEN (SELECT ok FROM clients_exists)
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'date_of_birth'
        ) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM public.clients WHERE date_of_birth IS NOT NULL AND date_of_birth > CURRENT_DATE',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS cnt
),
dup_source AS (
  SELECT
    CASE
      WHEN (SELECT ok FROM advisor_tasks_exists)
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'advisor_tasks' AND column_name = 'source_key'
        ) THEN COALESCE(
        NULLIF(
          ((xpath(
            '/row/cnt/text()',
            query_to_xml(
              'SELECT count(*) AS cnt FROM (SELECT source_key FROM public.advisor_tasks WHERE source_key IS NOT NULL GROUP BY source_key HAVING count(*) > 1) d',
              true, true, ''
            )
          ))[1])::text,
          ''
        )::integer,
        0
      )
      ELSE NULL::int
    END AS cnt
),
probes AS (
  SELECT
    'references.clients_table' AS probe_id,
    CASE WHEN (SELECT ok FROM clients_exists) THEN 'READY' ELSE 'UNKNOWN' END AS classification,
    'clients_table_exists=' || (SELECT ok::text FROM clients_exists) AS detail
  UNION ALL
  SELECT
    'references.users_table',
    CASE WHEN (SELECT ok FROM users_exists) THEN 'READY' ELSE 'UNKNOWN' END,
    'users_table_exists=' || (SELECT ok::text FROM users_exists)
  UNION ALL
  SELECT
    'references.advisor_tasks_table',
    CASE WHEN (SELECT ok FROM advisor_tasks_exists) THEN 'READY' ELSE 'UNKNOWN' END,
    'advisor_tasks_table_exists=' || (SELECT ok::text FROM advisor_tasks_exists)
  UNION ALL
  SELECT
    'references.adviser_appointments_table',
    CASE WHEN (SELECT ok FROM appointments_exists) THEN 'READY' ELSE 'UNKNOWN' END,
    'adviser_appointments_table_exists=' || (SELECT ok::text FROM appointments_exists)
  UNION ALL
  SELECT
    'clients.user_id_duplicate_probe',
    CASE
      WHEN NOT (SELECT ok FROM clients_exists) THEN 'UNKNOWN'
      WHEN (SELECT duplicate_group_count FROM duplicate_user_id) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'duplicate_non_null_user_id_groups=' || COALESCE((SELECT duplicate_group_count::text FROM duplicate_user_id), 'n/a')
  UNION ALL
  SELECT
    'clients.user_id_column_definition',
    CASE
      WHEN NOT (SELECT ok FROM clients_exists) THEN 'UNKNOWN'
      WHEN NOT (SELECT column_exists FROM user_id_column) THEN 'BLOCKER'
      WHEN (SELECT column_type FROM user_id_column) IS DISTINCT FROM 'uuid' THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'type=' || COALESCE((SELECT column_type FROM user_id_column), 'absent')
      || ', nullable=' || COALESCE((SELECT is_nullable FROM user_id_column), 'n/a')
  UNION ALL
  SELECT
    'clients.user_id_orphan_references',
    CASE
      WHEN NOT (SELECT ok FROM clients_exists) OR NOT (SELECT ok FROM users_exists) THEN 'UNKNOWN'
      WHEN (SELECT orphan_count FROM orphan_user_id) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'orphan_count=' || COALESCE((SELECT orphan_count::text FROM orphan_user_id), 'n/a')
  UNION ALL
  SELECT
    'clients.user_id_unique_index',
    CASE
      WHEN NOT (SELECT ok FROM clients_exists) THEN 'UNKNOWN'
      WHEN (SELECT index_exists FROM unique_index) AND (SELECT index_definition FROM unique_index) ILIKE '%UNIQUE%' THEN 'READY'
      WHEN (SELECT index_exists FROM unique_index) THEN 'BLOCKER'
      WHEN (SELECT duplicate_group_count FROM duplicate_user_id) > 0 THEN 'BLOCKER'
      ELSE 'WARNING'
    END,
    COALESCE((SELECT index_definition FROM unique_index), 'index absent')
  UNION ALL
  SELECT
    'clients.user_id_duplicate_resolution_probe',
    CASE
      WHEN NOT (SELECT ok FROM clients_exists) THEN 'UNKNOWN'
      WHEN (SELECT duplicate_group_count FROM duplicate_user_id) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    CASE
      WHEN (SELECT ok FROM clients_exists) THEN
        'probe_sql=SELECT user_id, COUNT(*)::int AS client_row_count, array_agg(id ORDER BY created_at) AS client_ids, array_agg(display_name ORDER BY created_at) AS display_names FROM public.clients WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1 ORDER BY client_row_count DESC'
      ELSE 'clients table absent — probe not applicable'
    END
  UNION ALL
  SELECT
    'appointment.overlap_probe',
    CASE
      WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'
      WHEN (SELECT overlap_count FROM appt_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'overlap_count=' || COALESCE((SELECT overlap_count::text FROM appt_counts), 'n/a')
  UNION ALL
  SELECT
    'appointment.idempotency_duplicate_probe',
    CASE
      WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'
      WHEN (SELECT idem_dup_count FROM appt_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'duplicate_groups=' || COALESCE((SELECT idem_dup_count::text FROM appt_counts), 'n/a')
  UNION ALL
  SELECT
    'appointment.creator_idempotency_duplicate_probe',
    CASE
      WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'created_by_user_id'
      ) THEN 'WARNING'
      WHEN (SELECT creator_idem_dup_count FROM appt_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'creator_duplicate_groups=' || COALESCE((SELECT creator_idem_dup_count::text FROM appt_counts), 'n/a')
  UNION ALL
  SELECT
    'appointment.invalid_source_probe',
    CASE
      WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'source'
      ) THEN 'WARNING'
      WHEN (SELECT invalid_source_count FROM appt_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'invalid_rows=' || COALESCE((SELECT invalid_source_count::text FROM appt_counts), 'n/a')
  UNION ALL
  SELECT
    'appointment.invalid_notification_status_probe',
    CASE
      WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'notification_status'
      ) THEN 'WARNING'
      WHEN (SELECT invalid_notif_count FROM appt_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'invalid_rows=' || COALESCE((SELECT invalid_notif_count::text FROM appt_counts), 'n/a')
  UNION ALL
  SELECT
    'appointment.invalid_calendar_sync_status_probe',
    CASE
      WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'adviser_appointments' AND column_name = 'calendar_sync_status'
      ) THEN 'WARNING'
      WHEN (SELECT invalid_sync_count FROM appt_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'invalid_rows=' || COALESCE((SELECT invalid_sync_count::text FROM appt_counts), 'n/a')
  UNION ALL
  SELECT
    'birthday.invalid_date_of_birth_probe',
    CASE
      WHEN NOT (SELECT ok FROM clients_exists) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'date_of_birth'
      ) THEN 'WARNING'
      WHEN (SELECT cnt FROM future_dob) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'future_dob_rows=' || COALESCE((SELECT cnt::text FROM future_dob), 'n/a')
  UNION ALL
  SELECT
    'birthday.duplicate_task_source_key_probe',
    CASE
      WHEN NOT (SELECT ok FROM advisor_tasks_exists) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'advisor_tasks' AND column_name = 'source_key'
      ) THEN 'WARNING'
      WHEN (SELECT cnt FROM dup_source) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'duplicate_source_key_groups=' || COALESCE((SELECT cnt::text FROM dup_source), 'n/a')
  UNION ALL
  SELECT
    'birthday.task_type_constraint_probe',
    CASE
      WHEN NOT (SELECT ok FROM advisor_tasks_exists) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = rel.relnamespace
        WHERE n.nspname = 'public' AND rel.relname = 'advisor_tasks' AND con.conname = 'advisor_tasks_task_type_check'
      ) THEN 'WARNING'
      WHEN EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = rel.relnamespace
        WHERE n.nspname = 'public' AND rel.relname = 'advisor_tasks' AND con.conname = 'advisor_tasks_task_type_check'
          AND pg_get_constraintdef(con.oid) NOT ILIKE '%client_birthday%'
      ) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'advisor_tasks_task_type_check includes client_birthday'
  UNION ALL
  SELECT
    'calendar.enum_status_labels',
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'adviser_appointment_status') THEN 'WARNING'
      WHEN (
        SELECT string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder)
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'adviser_appointment_status'
      ) = 'pending|confirmed|cancelled|completed|failed' THEN 'READY'
      ELSE 'BLOCKER'
    END,
    COALESCE((
      SELECT string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder)
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = 'adviser_appointment_status'
    ), 'enum absent')
  UNION ALL
  SELECT
    'calendar.exclusion_constraint_probe',
    CASE
      WHEN NOT (SELECT ok FROM appointments_exists) THEN 'UNKNOWN'
      WHEN EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = rel.relnamespace
        WHERE n.nspname = 'public' AND rel.relname = 'adviser_appointments'
          AND con.conname = 'adviser_appointments_no_overlap'
      ) THEN 'READY'
      ELSE 'WARNING'
    END,
    'adviser_appointments_no_overlap presence'
  UNION ALL
  SELECT
    'history.pending_pre_phase9',
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'supabase_migrations' AND c.relname = 'schema_migrations'
      ) THEN 'UNKNOWN'
      ELSE 'WARNING'
    END,
    'versions_pending=' || COALESCE((
      SELECT string_agg(expected.version, ',' ORDER BY expected.version)
      FROM (VALUES
        ('202606100019'), ('202606100020'), ('202606100021'), ('202606150001'),
        ('202606180001'), ('202606180002')
      ) AS expected(version)
      WHERE NOT EXISTS (
        SELECT 1 FROM supabase_migrations.schema_migrations sm
        WHERE sm.version = expected.version
      )
    ), 'n/a')
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
