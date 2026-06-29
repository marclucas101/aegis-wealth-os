# CRM V2 Phase 04 — Security Review

## Implemented controls

- Session-derived client identity only (`ensureUserClientProfile`).
- Central feature + role + visibility gate (`assertCrmV2ClientAppointmentsAccess`).
- Ownership checks enforce `adviser_appointments.client_id = session client`.
- `rejectUnexpectedFields` rejects browser-supplied client/adviser IDs.
- Write routes are rate-limited and validate bounded JSON payloads.
- Responses use `private, no-store`; internal errors are redacted.
- Cross-client and forged IDs return safe `not_found`.
- Optimistic concurrency via `version`; stale updates return `409`.

## IDOR and privacy checks covered

- Client A cannot access Client B records/actions.
- Adviser-only agenda/checklist never appears in client DTOs.
- Unpublished outcomes and raw event history remain hidden.
- Participant email input does not grant portal access.

## Deferred / out of scope

- Google Calendar synchronization from client workflow (Phase 05).
- Service commitments schema (Phase 06).
- Protection/moments/advocacy schemas (Phases 07–09).
