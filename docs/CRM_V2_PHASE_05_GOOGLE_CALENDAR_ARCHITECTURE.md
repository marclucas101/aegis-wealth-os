# CRM V2 Phase 05 — Google Calendar Architecture

## Authority model

```text
AEGIS adviser_appointments.id (authoritative)
  + crm_lifecycle_status / version / client relationship
  -> crm_google_calendar_event_mappings (provider mapping authority)
  -> Google Calendar event (projection target)
```

- AEGIS remains lifecycle and schedule source of truth.
- Google event is external representation only.
- No unrestricted inbound overwrite from Google to AEGIS.

## Connection authority

- Reused and extended `adviser_calendar_connections` for provider/account/calendar status.
- One adviser connection row per adviser account with selected writable calendar.
- Tokens remain encrypted at rest and server-only.

## Sync service boundary

- New server-only service: `lib/crm-v2/google-calendar/service.ts`.
- Provider adapter: `lib/crm-v2/google-calendar/provider.ts`.
- No browser tokens and no UI-level provider SDK calls.

## Trigger model

- Explicit adviser-triggered sync/retry API actions in Phase 05.
- Appointment writes commit independently; sync failures produce status, not rollback.
- Retry is bounded and idempotent through mapping uniqueness.
