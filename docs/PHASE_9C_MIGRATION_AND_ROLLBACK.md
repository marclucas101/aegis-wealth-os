# Phase 9C — Migration and Rollback

## Migration

**File:** `supabase/migrations/202606200003_phase9c_meeting_studio.sql`

### Creates

- `meeting_session_status` enum
- `meeting_summary_status` enum
- `meeting_sessions` table
- `meeting_session_events` table
- RLS policies (adviser/admin SELECT only — no client policies)
- Feature control seeds for 5 Meeting Studio flags

### Does not modify

- `adviser_appointments`
- `discover_profiles` (except runtime fact corrections via API)
- `published_outputs` schema
- `clients.relationship_stage` enum

## Apply

```bash
supabase db push
# or apply migrations in order:
# 202606200003_phase9c_meeting_studio.sql
# 202606200004_phase9c_meeting_studio_rls_documentation.sql
```

## Rollback (manual)

```sql
-- Remove feature controls
DELETE FROM platform_feature_controls
WHERE feature_key IN (
  'adviser_meeting_studio',
  'meeting_presentation_mode',
  'meeting_exact_amount_presentations',
  'meeting_client_acknowledgements',
  'meeting_summary_publication'
);

DROP TABLE IF EXISTS meeting_session_events;
DROP TABLE IF EXISTS meeting_sessions;
DROP TYPE IF EXISTS meeting_summary_status;
DROP TYPE IF EXISTS meeting_session_status;
```

**Warning:** Rollback deletes all meeting session data.

## Application rollback

Revert Phase 9C code deployment. Phase 9A/9B and Phase 8C routes remain functional without this migration (Meeting Studio APIs will error on missing tables).
