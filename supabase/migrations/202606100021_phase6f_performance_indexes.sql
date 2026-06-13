-- Phase 6F: performance indexes for My Clients list and feedback lookups

CREATE INDEX IF NOT EXISTS idx_adviser_feedback_client_created
  ON adviser_feedback (client_id, created_at DESC)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_advisor_display_name
  ON clients (advisor_user_id, display_name)
  WHERE advisor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discover_profiles_client_current
  ON discover_profiles (client_id)
  WHERE is_current = true;

COMMENT ON INDEX idx_adviser_feedback_client_created IS
  'My Clients feedback status aggregation and client workspace feedback tab.';

COMMENT ON INDEX idx_clients_advisor_display_name IS
  'Paginated adviser client list ordered by display_name.';
