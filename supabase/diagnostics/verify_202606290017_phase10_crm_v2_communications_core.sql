-- Verification for migration 202606290017 (Phase 10 Communications core).
-- Catalog-safe: always returns one row.

SELECT
  'phase10.communications.core.verify' AS check_id,
  to_regclass('public.crm_communication_threads') IS NOT NULL AS threads_table,
  to_regclass('public.crm_communication_records') IS NOT NULL AS records_table,
  to_regclass('public.crm_communication_templates') IS NOT NULL AS templates_table,
  to_regclass('public.crm_communication_domain_events') IS NOT NULL AS domain_events_table,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'communication_preferences'
      AND column_name = 'do_not_contact'
  ) AS preferences_extended,
  (
    SELECT COUNT(*)::int
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'crm_communication_records'
      AND constraint_name = 'crm_communication_records_lifecycle_check'
  ) AS lifecycle_constraint_present,
  (
    SELECT COUNT(*)::int
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_crm_communication_records_idempotency'
  ) AS idempotency_index_present;
