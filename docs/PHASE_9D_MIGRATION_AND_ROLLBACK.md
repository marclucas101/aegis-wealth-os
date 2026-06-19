# Phase 9D — Migration and Rollback

## Migration

File: `supabase/migrations/202606200005_phase9d_converted_client_portal.sql`

### Changes

1. Extends `published_outputs.output_type` CHECK with `client_plan_summary`, `meeting_summary`, `goal_plan_summary`
2. Adds `roadmap_items` columns: `task_owner`, `client_visible`, `client_status_label`, `display_category`
3. Creates `client_goals` table
4. Creates `client_review_submissions` table with idempotent `source_key`

### Apply (staging only)

```bash
supabase db push
# or apply SQL manually in staging Supabase project
```

**Do not apply to production** until Phase 9F rollout approval.

## Rollback limitations

| Change | Rollback |
|--------|----------|
| New output types in CHECK | Requires constraint revert; existing rows with new types must be deleted first |
| `client_goals` / `client_review_submissions` | `DROP TABLE` — **loses client-entered data** |
| `roadmap_items` columns | `DROP COLUMN` — loses presentation metadata |
| Application code | Revert git branch; old code ignores new columns safely |

## Pre-migration checklist

- [ ] Backup staging database
- [ ] Verify Phase 9A publication workflow operational
- [ ] Seed at least one `financial_overview` publication for test client
- [ ] Mark test roadmap items `client_visible = true` for roadmap QA

## Post-migration verification

```bash
npm run qa:phase9d-client-portal
npm run qa:phase9a-access
npm run qa:phase9b-prospect
npm run qa:phase9c-meeting-studio
```

## Verification SQL (staging — do not run on production without approval)

```sql
-- 1. Publication output types extended
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'published_outputs'::regclass
  AND conname = 'published_outputs_output_type_check';

-- 2. Roadmap presentation columns
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'roadmap_items'
  AND column_name IN ('task_owner', 'client_visible', 'client_status_label', 'display_category');

-- 3. Client goals RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'client_goals';

-- 4. Review submissions unique source key
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'client_review_submissions'
  AND indexdef ILIKE '%source_key%';

-- 5. No cross-client goal visibility (run as client A — should return 0 rows for client B goals)
-- SET request.jwt.claim.sub = '<client_a_user_id>';
-- SELECT count(*) FROM client_goals WHERE client_id = '<client_b_id>';

-- 6. Existing published_outputs rows still valid
SELECT output_type, count(*)
FROM published_outputs
GROUP BY output_type
ORDER BY output_type;
```

## Code-only deployment

Phase 9D UI and APIs degrade gracefully if migration not yet applied:

- Goals/review submission APIs error until tables exist
- Roadmap API treats missing columns as defaults (`client_visible=false` → empty roadmap)
- Publication types for new output types require migration before adviser publish
