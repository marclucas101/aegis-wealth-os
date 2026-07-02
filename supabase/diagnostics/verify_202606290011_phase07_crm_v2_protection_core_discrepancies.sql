-- Discrepancy check for migration 202606290011 (Phase 07 Protection core).
SELECT
  'phase07.core.discrepancy' AS check_id,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'protection_policies'
    ) THEN 'missing_protection_policies'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'protection_policy_versions'
    ) THEN 'missing_protection_policy_versions'
    WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'protection_extractions'
    ) THEN 'missing_protection_extractions'
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'protection_policies' AND policyname = 'protection_policies_assignment'
    ) THEN 'missing_rls_policy'
    ELSE 'ok'
  END AS discrepancy;
