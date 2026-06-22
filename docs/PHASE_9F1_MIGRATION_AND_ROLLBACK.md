# Phase 9F.1 Migration and Rollback

**Migration:** `supabase/migrations/202606200008_phase9f_scheduled_publishing.sql`  
**Depends on:** `202606200007_phase9e_hardening.sql`

## Objects created

| Object | Purpose |
|--------|---------|
| `automation_job_runs` | Operational job run records |
| `automation_job_items` | Per-item outcomes (reference UUID only) |
| `idx_automation_job_runs_single_active` | One active run per job name |
| `idx_automation_job_runs_job_started` | Admin history queries |
| `idx_automation_job_items_run` | Item lookup by run |
| Feature seed | `scheduled_content_automation` (disabled) |

## Pre-apply verification

```bash
npm run qa:migration-readiness
npm run qa:diagnostic-sql-syntax
npx supabase db push --dry-run
```

## Post-apply verification

```sql
SELECT feature_key, enabled
FROM platform_feature_controls
WHERE feature_key = 'scheduled_content_automation';

SELECT COUNT(*) FROM automation_job_runs;
```

Expected: feature `enabled = false`; zero job runs initially.

## Rollback (staging only — destructive)

```sql
-- 1. Disable automation first
UPDATE platform_feature_controls
SET enabled = false
WHERE feature_key = 'scheduled_content_automation';

-- 2. Drop job tables
DROP TABLE IF EXISTS automation_job_items;
DROP TABLE IF EXISTS automation_job_runs;

-- 3. Remove feature control row
DELETE FROM platform_feature_controls
WHERE feature_key = 'scheduled_content_automation';

-- 4. Remove migration history row (if repair required)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '202606200008';
```

**Note:** Rollback does not unpublish content already published by automation. Withdraw manually if required.

## Application rollback

1. Disable `scheduled_content_automation`.
2. Remove scheduler cron entry if configured.
3. Deploy previous application version without Phase 9F.1 routes (optional).

Governed content and Phase 9E data remain intact.
