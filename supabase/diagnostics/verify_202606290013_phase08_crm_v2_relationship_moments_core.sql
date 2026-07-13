-- Verification for migration 202606290013 (Phase 08 Relationship moments core).
SELECT
  'phase08.core.verify' AS check_id,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'relationship_moments',
    'adviser_moment_overrides',
    'festive_holiday_mappings',
    'crm_review_rhythm',
    'crm_client_preference_updates',
    'relationship_moment_events'
  )
ORDER BY table_name;

SELECT
  'phase08.core.ethnicity_column' AS check_id,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
  AND column_name = 'ethnicity';
