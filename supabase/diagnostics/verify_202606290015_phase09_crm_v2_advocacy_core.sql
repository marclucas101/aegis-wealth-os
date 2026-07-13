-- Verification for migration 202606290015 (Phase 09 Advocacy core).
SELECT
  'phase09.advocacy.core.verify' AS check_id,
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'advocacy_events',
    'advocacy_score_config',
    'crm_client_advocacy_preferences',
    'advocacy_domain_events'
  )
ORDER BY table_name;
