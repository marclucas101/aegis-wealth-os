-- Read-only preflight for migration 202606290013 (Phase 08 Relationship moments core).
SELECT
  'phase08.core.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AS clients_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adviser_appointments'
  ) AS appointments_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_commitments'
  ) AS service_commitments_present;
