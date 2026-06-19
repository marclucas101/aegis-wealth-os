-- Phase 9C hardening: RLS documentation (no schema change)
-- Confirms service-role-only write model for meeting tables.

COMMENT ON POLICY meeting_sessions_select_adviser ON meeting_sessions IS
  'Phase 9C: Assigned adviser or admin SELECT only. No client policy. Writes via service-role API.';

COMMENT ON POLICY meeting_session_events_select_adviser ON meeting_session_events IS
  'Phase 9C: Assigned adviser or admin SELECT only. Event INSERT via service-role API only.';
