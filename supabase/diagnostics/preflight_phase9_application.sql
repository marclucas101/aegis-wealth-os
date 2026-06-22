-- Read-only preflight before Phase 9 migration application.
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail.

WITH refs AS (
  SELECT
    to_regclass('public.clients') IS NOT NULL AS clients_exists,
    to_regclass('public.users') IS NOT NULL AS users_exists,
    to_regclass('public.published_outputs') IS NOT NULL AS published_outputs_exists,
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    to_regclass('public.meeting_sessions') IS NOT NULL AS meeting_sessions_exists,
    to_regclass('public.client_review_submissions') IS NOT NULL AS review_submissions_exists,
    to_regclass('public.client_notifications') IS NOT NULL AS notifications_exists,
    to_regclass('public.communication_deliveries') IS NOT NULL AS deliveries_exists,
    to_regclass('public.governed_content') IS NOT NULL AS governed_content_exists
),
probes AS (
  SELECT
    'enums.relationship_stage_labels'::text AS probe_id,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_stage') THEN 'READY'
      WHEN EXISTS (
        SELECT 1
        FROM (
          SELECT string_agg(enumlabel, '|' ORDER BY enumsortorder) AS labels
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'relationship_stage'
        ) x
        WHERE x.labels <> 'prospect|fact_find_complete|adviser_review|meeting_scheduled|recommendation_prepared|active_client|inactive_client'
      ) THEN 'BLOCKER'
      ELSE 'READY'
    END AS classification,
    'Detects incompatible existing relationship_stage enum labels'::text AS detail
  UNION ALL
  SELECT
    'publications.duplicate_current_publications',
    CASE
      WHEN NOT (SELECT published_outputs_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM (
            SELECT client_id, output_type, output_audience
            FROM published_outputs
            WHERE publication_status = 'published'
              AND withdrawn_at IS NULL
              AND superseded_at IS NULL
            GROUP BY client_id, output_type, output_audience
            HAVING count(*) > 1
          ) d
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Must be zero before hardening unique publication index'
  UNION ALL
  SELECT
    'clients.invalid_relationship_stage_values',
    CASE
      WHEN NOT (SELECT clients_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_stage') THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM clients
          WHERE relationship_stage IS NULL
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Checks for null or incompatible relationship stage data'
  UNION ALL
  SELECT
    'publications.orphan_client_or_adviser_refs',
    CASE
      WHEN NOT (SELECT published_outputs_exists FROM refs) OR NOT (SELECT users_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM published_outputs po
          LEFT JOIN clients c ON c.id = po.client_id
          LEFT JOIN users u ON u.id = po.created_by_user_id
          WHERE c.id IS NULL OR (po.created_by_user_id IS NOT NULL AND u.id IS NULL)
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Detect orphaned published output references'
  UNION ALL
  SELECT
    'meeting.lifecycle_incompatibilities',
    CASE
      WHEN NOT (SELECT meeting_sessions_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM meeting_sessions
          WHERE (status = 'completed' AND completed_at IS NULL)
             OR (status = 'in_progress' AND started_at IS NULL)
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Existing meeting data should respect lifecycle timestamp semantics'
  UNION ALL
  SELECT
    'client_portal.duplicate_goal_review_source_keys',
    CASE
      WHEN NOT (SELECT review_submissions_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM (
            SELECT source_key
            FROM client_review_submissions
            GROUP BY source_key
            HAVING count(*) > 1
          ) d
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Duplicate source keys would violate unique idempotency design'
  UNION ALL
  SELECT
    'communications.duplicate_notification_idempotency_keys',
    CASE
      WHEN NOT (SELECT notifications_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM (
            SELECT client_id, notification_type, reference_type, reference_id
            FROM client_notifications
            WHERE reference_id IS NOT NULL AND reference_type IS NOT NULL
            GROUP BY client_id, notification_type, reference_type, reference_id
            HAVING count(*) > 1
          ) d
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Must be zero before applying idempotent notification unique index'
  UNION ALL
  SELECT
    'communications.duplicate_delivery_idempotency_keys',
    CASE
      WHEN NOT (SELECT deliveries_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM (
            SELECT communication_id, client_id, channel
            FROM communication_deliveries
            WHERE communication_id IS NOT NULL
            GROUP BY communication_id, client_id, channel
            HAVING count(*) > 1
          ) d
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Must be zero before delivery idempotency index'
  UNION ALL
  SELECT
    'communications.invalid_content_lifecycle_values',
    CASE
      WHEN NOT (SELECT governed_content_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM governed_content
          WHERE approval_status NOT IN (
            'draft','submitted_for_review','changes_requested','approved',
            'scheduled','published','expired','rejected','withdrawn','archived'
          )
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Lifecycle states must remain in governed enum-like set'
  UNION ALL
  SELECT
    'feature_controls.invalid_seed_state',
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM platform_feature_controls
          WHERE feature_key IN (
            'adviser_publication_workflow',
            'adviser_meeting_studio',
            'adviser_insight_authoring'
          )
            AND enabled = false
      $$, true, true, '')))[1]::text), '')::bigint > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Warn when critical Phase 9 features are disabled before verification'
  UNION ALL
  SELECT
    'prerequisites.pre_phase9_objects',
    CASE
      WHEN (SELECT clients_exists FROM refs) AND (SELECT users_exists FROM refs) THEN 'READY'
      ELSE 'BLOCKER'
    END,
    'Requires core pre-Phase-9 objects clients and users'
  UNION ALL
  SELECT
    'history.phase9_migration_status',
    CASE
      WHEN NULLIF(((xpath('/row/cnt/text()', query_to_xml($$
          SELECT count(*)::text AS cnt
          FROM supabase_migrations.schema_migrations
          WHERE version IN (
            '202606200001','202606200002','202606200003',
            '202606200004','202606200005','202606200006','202606200007'
          )
      $$, true, true, '')))[1]::text), '')::bigint = 0 THEN 'READY'
      ELSE 'WARNING'
    END,
    'History should still be pending before first Phase 9 apply'
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
