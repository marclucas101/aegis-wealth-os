-- Verification for migration 202606290011 (Phase 07 Protection core).
SELECT
  'phase07.core.verify' AS check_id,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'protection_policies'
  ) AS protection_policies_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'protection_policy_versions'
  ) AS protection_policy_versions_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'protection_extractions'
  ) AS protection_extractions_present,
  EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'protection_domain_events'
  ) AS protection_domain_events_present;
