-- Read-only preflight for migration 202606290009 (Phase 06 Service core).
SELECT
  'phase06.core.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AS clients_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adviser_appointments'
  ) AS adviser_appointments_present,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_assigned_advisor'
  ) AS is_assigned_advisor_present;
