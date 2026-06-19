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

## Code-only deployment

Phase 9D UI and APIs degrade gracefully if migration not yet applied:

- Goals/review submission APIs error until tables exist
- Roadmap API treats missing columns as defaults (`client_visible=false` → empty roadmap)
- Publication types for new output types require migration before adviser publish
