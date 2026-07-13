-- Verification for migration 202606290009 (Phase 06 Service core).
SELECT
  'phase06.core.verify' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_commitments'
  ) AS service_commitments_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_service_requests'
  ) AS client_service_requests_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_commitment_events'
  ) AS service_commitment_events_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_service_request_events'
  ) AS client_service_request_events_present;
