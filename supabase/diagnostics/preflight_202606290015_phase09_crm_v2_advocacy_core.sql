-- Read-only preflight for migration 202606290015 (Phase 09 Advocacy core).
SELECT
  'phase09.advocacy.core.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AS clients_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adviser_appointments'
  ) AS adviser_appointments_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_service_requests'
  ) AS client_service_requests_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'relationship_moments'
  ) AS relationship_moments_present;
