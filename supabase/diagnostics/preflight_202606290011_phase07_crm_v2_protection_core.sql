-- Read-only preflight for migration 202606290011 (Phase 07 Protection core).
SELECT
  'phase07.core.preflight' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) AS clients_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents'
  ) AS documents_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_service_requests'
  ) AS client_service_requests_present;
