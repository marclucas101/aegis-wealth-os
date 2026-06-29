-- Verification for migration 202606290007 (Phase 05 Google Calendar core).

SELECT
  'phase05.core.verify.table' AS check_id,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('crm_google_oauth_states', 'crm_google_calendar_event_mappings')
ORDER BY table_name;

SELECT
  'phase05.core.verify.connection_columns' AS check_id,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'adviser_calendar_connections'
  AND column_name IN (
    'google_account_id',
    'connection_status',
    'refresh_capable',
    'last_refresh_success_at',
    'last_sync_status',
    'disconnected_at'
  )
ORDER BY column_name;
