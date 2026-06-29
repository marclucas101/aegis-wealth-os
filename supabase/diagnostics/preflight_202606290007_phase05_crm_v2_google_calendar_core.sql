-- Read-only preflight for migration 202606290007 (Phase 05 Google Calendar core).
-- No writes.

SELECT
  'phase05.core.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adviser_calendar_connections'
  ) AS adviser_calendar_connections_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adviser_appointments'
  ) AS adviser_appointments_present;
