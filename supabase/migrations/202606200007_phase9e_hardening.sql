-- Phase 9E hardening — idempotency indexes and RLS documentation
-- Do not apply to production without staging validation.

-- Idempotent client notifications for the same logical document/content event
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_notifications_idempotent
  ON client_notifications (client_id, notification_type, reference_type, reference_id)
  WHERE reference_id IS NOT NULL AND reference_type IS NOT NULL;

-- One email delivery record per communication/client/channel (retries reuse same row)
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_deliveries_idempotent
  ON communication_deliveries (communication_id, client_id, channel)
  WHERE communication_id IS NOT NULL;

COMMENT ON TABLE governed_content IS
  'Phase 9E governed communications. RLS enabled with no client policies — API service-role only.';

COMMENT ON TABLE communication_deliveries IS
  'Phase 9E delivery tracking. RLS enabled with no client policies — admin API service-role only.';

COMMENT ON TABLE binder_exports IS
  'Phase 9E binder export manifest records. RLS enabled with no client policies — adviser API service-role only.';

COMMENT ON TABLE promotion_migration_reviews IS
  'Phase 9E legacy promotion migration audit. UNIQUE(promotion_id) prevents duplicate migration.';
