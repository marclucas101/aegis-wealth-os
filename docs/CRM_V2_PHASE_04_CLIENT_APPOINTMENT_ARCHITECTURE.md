# CRM V2 Phase 04 — Client Appointment Architecture

## Authority

- Single authority remains `adviser_appointments.id`.
- Client collaboration writes update the same appointment row and supporting `crm_appointment_*` records.
- No second appointment authority table is introduced.

## Feature gate

- Feature key: `crm_v2_appointments_client`.
- Default disabled in code and persistence.
- Access requires authenticated client session + feature enabled + `client_visible = true`.

## Access model

- Server-only helper: `assertCrmV2ClientAppointmentsAccess()`.
- Identity derived from `ensureUserClientProfile()` only.
- Ownership validated by `client_id` match.
- Cross-client and forged ID requests return safe `not_found`.

## Routes

- UI: `/appointments`, `/appointments/request`, `/appointments/[appointmentId]`.
- API:
  - `GET/POST /api/appointments`
  - `GET /api/appointments/[appointmentId]`
  - `POST /api/appointments/[appointmentId]/confirm|decline|reschedule-request|cancel`
  - `POST/PATCH /api/appointments/[appointmentId]/topics`
  - `PATCH /api/appointments/[appointmentId]/checklist/[itemId]`

## DTO boundary

- Exposes only client-safe fields, lifecycle labels, permitted actions, checklist, topics, published outcomes, and client-visible follow-up.
- Excludes adviser agenda, internal notes, financial data, policy identifiers, storage paths, signed URLs, and raw event history.

## Compatibility

- Adviser CRM V2 appointment APIs unchanged.
- Legacy adviser and client surfaces remain available.
- Meeting Studio and Google Calendar behavior unchanged in Phase 04.
