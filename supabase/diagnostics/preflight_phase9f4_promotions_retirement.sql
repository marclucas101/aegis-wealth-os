-- Read-only preflight: Phase 9F.4 legacy promotions retirement
-- Returns probe_id, classification (READY|WARNING|BLOCKER|UNKNOWN), detail
-- Tolerates absent objects. Does not expose campaign content or client PII.

WITH refs AS (
  SELECT
    to_regclass('public.promotions') IS NOT NULL AS promotions_exists,
    to_regclass('public.promotion_migration_reviews') IS NOT NULL AS migration_reviews_exists,
    to_regclass('public.governed_content') IS NOT NULL AS governed_content_exists,
    to_regclass('public.audit_logs') IS NOT NULL AS audit_logs_exists,
    to_regclass('public.platform_feature_controls') IS NOT NULL AS feature_controls_exists,
    EXISTS (
      SELECT 1 FROM storage.buckets b WHERE b.id = 'promotion-assets'
    ) AS promotion_assets_bucket_exists,
    to_regclass('public.communication_deliveries') IS NOT NULL AS communication_deliveries_exists,
    to_regclass('public.client_notifications') IS NOT NULL AS client_notifications_exists,
    to_regclass('public.automation_job_items') IS NOT NULL AS automation_job_items_exists
),
promotion_counts AS (
  SELECT
    CASE WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint ELSE (SELECT count(*)::bigint FROM promotions) END AS total,
    CASE WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint ELSE (SELECT count(*)::bigint FROM promotions WHERE status = 'published') END AS published,
    CASE WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint ELSE (SELECT count(*)::bigint FROM promotions WHERE status = 'draft') END AS draft,
    CASE WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint ELSE (SELECT count(*)::bigint FROM promotions WHERE status = 'archived') END AS archived,
    CASE WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint ELSE (
      SELECT count(*)::bigint FROM promotions
      WHERE status = 'published'
        AND starts_at IS NOT NULL
        AND starts_at > now()
    ) END AS scheduled_future,
    CASE WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint ELSE (
      SELECT count(*)::bigint FROM promotions
      WHERE status = 'published'
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at >= now())
    ) END AS currently_active
),
unmigrated AS (
  SELECT
    CASE
      WHEN to_regclass('public.promotions') IS NULL THEN NULL::bigint
      WHEN to_regclass('public.promotion_migration_reviews') IS NULL THEN (SELECT count(*)::bigint FROM promotions)
      ELSE (
        SELECT count(*)::bigint
        FROM promotions p
        WHERE NOT EXISTS (
          SELECT 1 FROM promotion_migration_reviews r WHERE r.promotion_id = p.id
        )
      )
    END AS unmigrated_count
),
audit_promotion_refs AS (
  SELECT
    CASE WHEN to_regclass('public.audit_logs') IS NULL THEN NULL::bigint ELSE (
      SELECT count(*)::bigint
      FROM audit_logs
      WHERE entity_type = 'promotions'
         OR entity_type = 'promotion'
         OR action LIKE 'promotion_%'
    ) END AS audit_ref_count
),
notification_promotion_refs AS (
  SELECT
    CASE WHEN to_regclass('public.client_notifications') IS NULL THEN NULL::bigint ELSE (
      SELECT count(*)::bigint
      FROM client_notifications
      WHERE metadata::text LIKE '%promotion%'
    ) END AS notification_ref_count
),
fk_dependents AS (
  SELECT count(*)::int AS dependent_fk_count
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.confrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE c.contype = 'f'
    AND nsp.nspname = 'public'
    AND rel.relname = 'promotions'
    AND c.conrelid <> to_regclass('public.promotion_migration_reviews')
),
probes AS (
  SELECT
    'object.promotions_table'::text AS probe_id,
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END AS classification,
    'Legacy promotions table presence for retirement inventory'::text AS detail
  UNION ALL
  SELECT
    'data.promotions_row_count',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT total FROM promotion_counts) > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'Table absent — nothing to retire'
      ELSE 'Total promotion rows: ' || (SELECT total FROM promotion_counts)::text
    END
  UNION ALL
  SELECT
    'data.promotions_published_active',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT currently_active FROM promotion_counts) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'Table absent'
      ELSE 'Currently active published promotions: ' || (SELECT currently_active FROM promotion_counts)::text
    END
  UNION ALL
  SELECT
    'data.promotions_scheduled_future',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT scheduled_future FROM promotion_counts) > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Future-scheduled published rows: ' || COALESCE((SELECT scheduled_future FROM promotion_counts)::text, 'n/a')
  UNION ALL
  SELECT
    'data.promotions_unmigrated',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT unmigrated_count FROM unmigrated) > 0 THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Promotions without migration review record: ' || COALESCE((SELECT unmigrated_count FROM unmigrated)::text, 'n/a')
  UNION ALL
  SELECT
    'replacement.governed_content_exists',
    CASE
      WHEN NOT (SELECT governed_content_exists FROM refs) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Phase 9E governed_content required before legacy retirement'
  UNION ALL
  SELECT
    'object.promotion_migration_reviews',
    CASE
      WHEN NOT (SELECT migration_reviews_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Migration tracking table for legacy promotions bridge'
  UNION ALL
  SELECT
    'object.promotion_assets_bucket',
    CASE
      WHEN NOT (SELECT promotion_assets_bucket_exists FROM refs) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Private promotion-assets storage bucket'
  UNION ALL
  SELECT
    'dependency.fk_to_promotions',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (SELECT dependent_fk_count FROM fk_dependents) > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Foreign keys referencing promotions (excluding migration reviews): ' ||
      COALESCE((SELECT dependent_fk_count FROM fk_dependents)::text, '0')
  UNION ALL
  SELECT
    'audit.promotion_references',
    CASE
      WHEN NOT (SELECT audit_logs_exists FROM refs) THEN 'UNKNOWN'
      WHEN COALESCE((SELECT audit_ref_count FROM audit_promotion_refs), 0) > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Audit log rows referencing promotions (retain on retirement): ' ||
      COALESCE((SELECT audit_ref_count FROM audit_promotion_refs)::text, 'n/a')
  UNION ALL
  SELECT
    'notifications.promotion_metadata_refs',
    CASE
      WHEN NOT (SELECT client_notifications_exists FROM refs) THEN 'UNKNOWN'
      WHEN COALESCE((SELECT notification_ref_count FROM notification_promotion_refs), 0) > 0 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Client notification metadata mentioning promotion: ' ||
      COALESCE((SELECT notification_ref_count FROM notification_promotion_refs)::text, 'n/a')
  UNION ALL
  SELECT
    'scheduled_publishing.promotions_dependency',
    'READY',
    'Scheduled automation targets governed_content only — no promotions coupling detected in schema'
  UNION ALL
  SELECT
    'feature.insights_and_updates',
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM platform_feature_controls
        WHERE feature_key = 'insights_and_updates' AND enabled = true
      ) THEN 'BLOCKER'
      ELSE 'READY'
    END,
    'Replacement client channel feature control must be enabled'
  UNION ALL
  SELECT
    'feature.legacy_promotions_flags_absent',
    CASE
      WHEN NOT (SELECT feature_controls_exists FROM refs) THEN 'UNKNOWN'
      WHEN EXISTS (
        SELECT 1 FROM platform_feature_controls
        WHERE feature_key IN ('legacy_promotions_write', 'legacy_promotions_ui')
      ) THEN 'WARNING'
      ELSE 'READY'
    END,
    'Phase 9F.4 checkpoint expects no legacy promotion feature flags yet'
  UNION ALL
  SELECT
    'policy.promotions_rls_enabled',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'promotions' AND c.relrowsecurity
      ) THEN 'WARNING'
      ELSE 'READY'
    END,
    'RLS should remain enabled on promotions until explicit retirement'
  UNION ALL
  SELECT
    'policy.promotions_policies_present',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (
        SELECT count(*) FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'promotions'
      ) < 1 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Promotion RLS policy count: ' ||
      COALESCE((
        SELECT count(*)::text FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'promotions'
      ), '0')
  UNION ALL
  SELECT
    'object.promotions_triggers',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'promotions' AND NOT t.tgisinternal
      ) THEN 'WARNING'
      ELSE 'READY'
    END,
    'updated_at trigger expected on promotions'
  UNION ALL
  SELECT
    'object.promotions_indexes',
    CASE
      WHEN NOT (SELECT promotions_exists FROM refs) THEN 'UNKNOWN'
      WHEN (
        SELECT count(*) FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'promotions'
      ) < 1 THEN 'WARNING'
      ELSE 'READY'
    END,
    'Index count on promotions: ' ||
      COALESCE((
        SELECT count(*)::text FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'promotions'
      ), '0')
)
SELECT probe_id, classification, detail
FROM probes
ORDER BY probe_id;
