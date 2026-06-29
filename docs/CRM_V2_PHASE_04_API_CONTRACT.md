# CRM V2 Phase 04 — Client API Contract

**Cache policy:** `private, no-store`  
**Auth:** authenticated client session only  
**Identity source:** session-derived (`ensureUserClientProfile`) only

## `GET /api/appointments`

- Query: `view=upcoming|awaiting_response|preparation|follow_up|history`
- Response: `{ ok: true, view, appointments[] }`

## `POST /api/appointments`

- Purpose: request appointment
- Body (safe/bounded): `appointmentType`, `title`, `preferredStartsAt`, `preferredEndsAt`, `timezone`, `deliveryMode`, `idempotencyKey`, optional `topics[]`
- Server-derived: `clientId`, assigned adviser
- Response: `201 { ok: true, appointmentId }`

## `GET /api/appointments/[appointmentId]`

- Response: `{ ok: true, appointment: ClientAppointmentDetailDto }`
- Cross-client or forged IDs: `404 { ok: false, reason: "not_found" }`

## Action routes

- `POST /api/appointments/[appointmentId]/confirm`
- `POST /api/appointments/[appointmentId]/decline`
- `POST /api/appointments/[appointmentId]/reschedule-request`
- `POST /api/appointments/[appointmentId]/cancel`

Body requires `version`; stale writes return `409`.

## Topics and checklist

- `POST/PATCH /api/appointments/[appointmentId]/topics`
- `PATCH /api/appointments/[appointmentId]/checklist/[itemId]`

Both enforce ownership, feature gate, identity derivation, and safe field validation.
