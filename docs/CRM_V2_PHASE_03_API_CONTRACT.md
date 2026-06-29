# CRM V2 Phase 03 — API Contract

**Namespace:** `/api/advisor-v2/appointments`  
**Cache:** `private, no-store`  
**Auth:** `assertCrmV2AppointmentsAccess()`

---

## GET /api/advisor-v2/appointments

Query: `view`, `page`, `pageSize`, `q`

Response: `{ ok: true, view, appointments[], page, pageSize, totalCount, totalPages, partialDataWarning }`

## POST /api/advisor-v2/appointments

Body: `relationshipId`, `templateKey`, `lifecycleStatus`, `startsAt`, `endsAt`, `timezone`, `deliveryMode`, optional `title`, `participants`, `adviserAgenda`, `idempotencyKey`

Rejects: `adviserUserId`, terminal lifecycle, invalid template/timezone.

Response 201: `{ ok: true, appointmentId }`

## GET /api/advisor-v2/appointments/[appointmentId]

Response: `{ ok: true, appointment: CrmAppointmentDetail }` or 404 `not_found`

## POST /api/advisor-v2/appointments/[appointmentId]/transition

Body: `toStatus`, `reasonCode`, `version`

409 on version conflict. 400 on invalid transition (no write).

## POST /api/advisor-v2/appointments/[appointmentId]/reschedule

Body: `startsAt`, `endsAt`, `timezone`, `version`

Same appointment ID returned. No Google API call.

---

## Safe DTO fields

See `lib/crm-v2/appointments/types.ts`. Excludes: private notes, storage paths, signed URLs, OAuth tokens, financial data, NRIC, policy IDs.
