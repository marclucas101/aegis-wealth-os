# CRM V2 Phase 05 — Existing Google Calendar Audit

## Existing implementation inventory

- **OAuth routes:** `app/api/advisor/calendar/connect/route.ts`, `app/api/google-calendar/callback/route.ts`.
- **Scopes:** `calendar.events`, `calendar.readonly` from `lib/google/env.ts`.
- **Token storage:** `adviser_calendar_connections` with encrypted access/refresh tokens.
- **Encryption:** AES-256-GCM in `lib/security/tokenEncryption.ts`.
- **Refresh behavior:** access token refresh through `refreshGoogleAccessToken`, persisted by `getAdviserGoogleAccessToken`.
- **Connection tables:** `adviser_calendar_connections` (authority), `adviser_calendar_settings` (preferences).
- **Mapping fields:** `adviser_appointments.google_event_id`, `google_calendar_id`, `google_event_url`, `calendar_sync_status`.
- **Sync writers/readers:** legacy booking and cancellation flows in `lib/supabase/appointmentsPersistence.ts`.
- **Meet support:** conference create request in `createGoogleCalendarEvent`.
- **Webhook/watch channels:** not implemented.
- **Scheduled sync/retry worker:** not implemented.
- **Disconnect/revoke:** `disconnectGoogleCalendar` includes best-effort provider revocation.

## Classification

- **Authoritative connection record:** `adviser_calendar_connections` (reused and evolved in Phase 05).
- **Reusable integration service:** `lib/google/calendarClient.ts` (reused via provider adapter).
- **Reusable mapping:** `adviser_appointments.google_*` compatibility fields (retained).
- **Compatibility layer:** legacy `/advisor` calendar pages and APIs.
- **Obsolete duplicate:** direct route-level provider calls outside centralized CRM V2 boundary.
- **Deferred:** inbound webhook sync and unrestricted two-way reconciliation.

## Risks found

- Signed OAuth state existed but replay-consumption persistence was missing.
- Legacy event creation defaulted to broad attendee updates and client notes payload.
- Mapping authority relied on inline appointment columns and lacked dedicated retry/error taxonomy.
- Sync and retry operations were fragmented across legacy booking code paths.
