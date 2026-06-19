# Phase 9E Migration and Rollback

## Migration

**File:** `supabase/migrations/202606200006_phase9e_communications_governance.sql`

Creates:
- `governed_content`
- `client_notifications`
- `communication_preferences`
- `communication_deliveries`
- `binder_exports`
- `promotion_migration_reviews`
- Phase 9E feature control seeds

## Apply (staging first)

```bash
supabase db push
# or apply migration via your staging pipeline
```

## Rollback

Phase 9E is additive. Rollback steps:

1. Disable Phase 9E feature controls via Admin Console (`insights_and_updates`, etc.).
2. Revert `/insights` page to placeholder if needed (code rollback).
3. Drop tables only after data export (not recommended during beta):

```sql
DROP TABLE IF EXISTS promotion_migration_reviews;
DROP TABLE IF EXISTS binder_exports;
DROP TABLE IF EXISTS communication_deliveries;
DROP TABLE IF EXISTS communication_preferences;
DROP TABLE IF EXISTS client_notifications;
DROP TABLE IF EXISTS governed_content;
```

4. Remove feature control rows:

```sql
DELETE FROM platform_feature_controls WHERE feature_key IN (
  'adviser_insight_authoring', 'admin_content_approval', 'market_updates',
  'product_related_content', 'client_in_app_notifications', 'client_email_notifications',
  'document_event_notifications', 'communication_preferences', 'binder_export',
  'binder_client_publication'
);
```

## Data preservation

Audit logs and legacy `promotions` table are untouched by rollback.

## Post-migration verification SQL

Run on staging after applying `202606200006_phase9e_communications_governance.sql` and `202606200007_phase9e_hardening.sql`:

```sql
-- Tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'governed_content', 'client_notifications', 'communication_preferences',
    'communication_deliveries', 'binder_exports', 'promotion_migration_reviews'
  )
ORDER BY 1;

-- RLS enabled on all Phase 9E tables
SELECT c.relname, c.relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'governed_content', 'client_notifications', 'communication_preferences',
    'communication_deliveries', 'binder_exports', 'promotion_migration_reviews'
  );

-- No broad authenticated INSERT/UPDATE on governed_content
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE tablename = 'governed_content';

-- Feature control seeds (10 keys)
SELECT feature_key, enabled
FROM platform_feature_controls
WHERE feature_key IN (
  'adviser_insight_authoring', 'admin_content_approval', 'market_updates',
  'product_related_content', 'client_in_app_notifications', 'client_email_notifications',
  'document_event_notifications', 'communication_preferences', 'binder_export',
  'binder_client_publication'
)
ORDER BY feature_key;

-- Product and binder client publication default off
SELECT feature_key, enabled FROM platform_feature_controls
WHERE feature_key IN ('product_related_content', 'binder_client_publication');

-- Idempotency indexes (hardening migration)
SELECT indexname FROM pg_indexes
WHERE tablename IN ('client_notifications', 'communication_deliveries')
  AND indexname LIKE '%idempot%';

-- Legacy promotions untouched
SELECT COUNT(*) AS legacy_promotion_count FROM promotions;
```

Expected: 6 tables, `relrowsecurity = true`, product/binder_client_publication `enabled = false`, idempotency indexes present.
