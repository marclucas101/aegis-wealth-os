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
