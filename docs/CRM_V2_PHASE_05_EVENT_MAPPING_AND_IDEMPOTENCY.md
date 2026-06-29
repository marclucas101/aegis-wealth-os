# CRM V2 Phase 05 — Event Mapping and Idempotency

## Mapping authority

- Table: `crm_google_calendar_event_mappings`.
- Unique identity: `(appointment_id, adviser_user_id, connection_calendar_id)`.
- Provider identity uniqueness: `(adviser_user_id, connection_calendar_id, google_event_id)`.

## Stored fields

- Appointment identity and adviser ownership.
- Calendar and provider event identifiers.
- Sync status and timestamps.
- Last AEGIS version synced.
- Retry count and safe error code.
- Disconnected/deleted markers.

No token fields and no raw provider payloads are stored in mapping.

## Idempotent strategy

- Sync checks for existing mapping first.
- No mapping => create provider event then persist mapping.
- Mapping exists => update existing provider event ID, never create replacement event.
- Cancellation is idempotent: repeated cancel treats provider missing/not found as reconciled.
- Meet conference request uses deterministic request ID per appointment to avoid duplicates.
