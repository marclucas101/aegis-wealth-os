-- Discrepancy check for migration 202606290017 (Phase 10 Communications core).
-- Returns rows only when expected objects are missing post-apply.

SELECT
  'phase10.communications.core.discrepancy' AS check_id,
  'crm_communication_threads' AS expected_object,
  'missing_table' AS issue
WHERE to_regclass('public.crm_communication_threads') IS NULL
UNION ALL
SELECT
  'phase10.communications.core.discrepancy',
  'crm_communication_records',
  'missing_table'
WHERE to_regclass('public.crm_communication_records') IS NULL
UNION ALL
SELECT
  'phase10.communications.core.discrepancy',
  'crm_communication_templates',
  'missing_table'
WHERE to_regclass('public.crm_communication_templates') IS NULL
UNION ALL
SELECT
  'phase10.communications.core.discrepancy',
  'crm_communication_domain_events',
  'missing_table'
WHERE to_regclass('public.crm_communication_domain_events') IS NULL
UNION ALL
SELECT
  'phase10.communications.core.discrepancy',
  'communication_preferences.do_not_contact',
  'missing_column'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'communication_preferences'
    AND column_name = 'do_not_contact'
);
