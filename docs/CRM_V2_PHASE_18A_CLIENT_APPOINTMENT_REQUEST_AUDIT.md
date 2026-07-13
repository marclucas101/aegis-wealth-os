# CRM V2 Phase 18A — Client Appointment Request Audit

**Type:** Code audit (read-only findings)  
**Date:** 2026-07-13  
**Scope:** Client appointment request reintroduction only — not full client portal

---

## Summary

The client appointment request flow is implemented in Phase 04 and wired to the consolidated adviser workspace from Phase 16. Clients submit requests via `/appointments/request`; records are written to `adviser_appointments` with `crm_lifecycle_status = requested`. Advisers manage requests from `/advisor/workspace/appointments` (Requests view). No Google Calendar auto-sync or external email/SMS/WhatsApp is triggered on client request creation.

---

## Client routes involved

| Route | Page file | Gate |
|-------|-----------|------|
| `/appointments` | `app/appointments/page.tsx` | `assertCrmV2ClientAppointmentsAccess()` |
| `/appointments/request` | `app/appointments/request/page.tsx` | same |
| `/appointments/[appointmentId]` | `app/appointments/[appointmentId]/page.tsx` | same |

Client UI components:

- `components/aegis/client/ClientAppointmentsDashboard.tsx`
- `components/aegis/client/ClientAppointmentRequestForm.tsx`
- `components/aegis/client/ClientAppointmentDetail.tsx`

Client nav entry (static): `lib/navigation.ts` → Appointments → `/appointments` (not feature-gated in nav; page gate applies on visit).

---

## Adviser routes involved

| Route | Page file | Gate |
|-------|-----------|------|
| `/advisor/workspace/appointments` | `app/advisor/(crm-v2)/workspace/appointments/page.tsx` | `assertCrmV2AppointmentsAccess()` |
| `/advisor/workspace/appointments/[appointmentId]` | `app/advisor/(crm-v2)/workspace/appointments/[appointmentId]/page.tsx` | same |
| `/advisor-v2/appointments` | compatibility redirect → workspace path | `redirectToCanonicalAdviserRoute` |

Legacy preserved (not CRM V2 authoritative):

- `/advisor/appointments` — `AppointmentsManagerClient` (legacy manager)

Relationship 360:

- `lib/crm-v2/relationships/readModel.ts` — "Next appointment" panel links to `/advisor/workspace/appointments?view=upcoming`
- `lib/crm-v2/relationships/timelineProjection.ts` — appointment events in engagement timeline (adviser link currently `/advisor/appointments` legacy)

---

## API routes involved

### Client APIs (`/api/appointments/*`)

| Method | Route | Handler gate |
|--------|-------|--------------|
| GET | `/api/appointments` | `assertCrmV2ClientAppointmentsAccess()` |
| POST | `/api/appointments` | same — creates client request |
| GET | `/api/appointments/[appointmentId]` | same |
| POST | `/api/appointments/[appointmentId]/confirm` | same |
| POST | `/api/appointments/[appointmentId]/decline` | same |
| POST | `/api/appointments/[appointmentId]/cancel` | same |
| POST | `/api/appointments/[appointmentId]/reschedule-request` | same |
| PATCH | `/api/appointments/[appointmentId]/topics` | same |
| PATCH | `/api/appointments/[appointmentId]/checklist/[itemId]` | same |

### Adviser APIs (`/api/advisor-v2/appointments/*`)

| Method | Route | Handler gate |
|--------|-------|--------------|
| GET/POST | `/api/advisor-v2/appointments` | `assertCrmV2AppointmentsAccess()` |
| GET | `/api/advisor-v2/appointments/[appointmentId]` | same |
| POST | `/api/advisor-v2/appointments/[appointmentId]/transition` | same |
| POST | `/api/advisor-v2/appointments/[appointmentId]/google-calendar/sync` | separate Google gate (manual only) |

---

## Database authority

| Domain | Authoritative table | Client write |
|--------|---------------------|--------------|
| Appointment record | `adviser_appointments` | INSERT on POST (source `client_booking`, lifecycle `requested`) |
| Client topics | `crm_appointment_client_topics` | INSERT with request |
| Checklist (read/update) | `crm_appointment_checklist_items` | Client/shared visibility only |
| State events | `crm_appointment_state_events` | On client transitions |
| Idempotency | `adviser_appointments.idempotency_key` | Per client user + key lookup |

Service: `lib/crm-v2/client-appointments/service.ts` — `createClientAppointmentRequest()`, `loadOwnedAppointment()` scoped by `client_id` from session.

---

## Feature flags required

### Client appointment flow

| Flag | Requirement |
|------|-------------|
| `crm_v2_master` | `enabled: true` (Phase 18A hardening) |
| `crm_v2_appointments_client` | `enabled: true` **and** `client_visible: true` |

`crm_v2_pilot_mode` applies to **adviser** CRM V2 shell only — not checked for client routes (clients are not in pilot allowlist).

### Adviser appointment management

| Flag | Requirement |
|------|-------------|
| `crm_v2_master` | enabled |
| `crm_v2_pilot_mode` | enabled |
| `CRM_V2_PILOT_USER_IDS` | valid allowlist |
| `crm_v2_appointments_adviser` | enabled |

---

## Access checks used

### Client (`assertCrmV2ClientAppointmentsAccess`)

1. `ensureUserClientProfile()` — authenticated session
2. `session.user.role === "client"`
3. `isFeatureEnabled(CRM_V2_MASTER_FEATURE_KEY)`
4. `crm_v2_appointments_client` row: `enabled && client_visible`
5. Server-derived `client.id` and `client.advisor_user_id` — no request-body IDs accepted on POST (rejected via `rejectUnexpectedFields`)

### Adviser (`assertCrmV2AppointmentsAccess`)

Full chain: `requireAdvisorAccess()` → master → pilot → allowlist → `crm_v2_appointments_adviser`.

---

## Lifecycle states involved

| State | Client action | Adviser action |
|-------|---------------|----------------|
| `requested` | Created on POST; can cancel, submit topics | Appears in Requests view; adviser confirms/proposes |
| `proposed` / `awaiting_confirmation` | Confirm / decline / request another time | Transition via detail |
| `confirmed` → … | Preparation, reschedule, cancel | Standard workflow |
| `cancelled_by_client` / `cancelled_by_adviser` | Safe terminal states | Visible in history |

Client create sets: `crm_lifecycle_status: "requested"`, `status: pending` (via `mapLifecycleToLegacyStatus`).

---

## Google Calendar

| Question | Finding |
|----------|---------|
| Touched on client request? | **No** — `createClientAppointmentRequest` does not import or call Google Calendar services |
| Auto-sync on create? | **No** — sync only via manual adviser action `POST .../google-calendar/sync` |
| Auto-invite to client? | **No** |

---

## Communications / send logic

| Mechanism | On client request create? |
|-----------|---------------------------|
| Email (`appointmentNotificationEmail`, etc.) | **No** |
| SMS / WhatsApp | **No** |
| Governed communications publish | **No** |
| In-app `dbCreateClientNotification` | **Yes** — portal notification only (`appointment_changed`) |
| Audit log | **Yes** — `crm_client_appointment_requested` |

---

## Privacy boundaries

| Check | Finding |
|-------|---------|
| Client can see other clients? | **No** — all queries filter `.eq("client_id", clientId)` from session |
| Client sees adviser internal agenda? | **No** — client DTO excludes adviser-only checklist (`visibility` filter: `client`, `shared` only) |
| Client sees adviser private notes? | **No** — not in client DTO (`CRM_V2_PHASE_04_VISIBILITY_AND_PRIVACY.md`) |
| Forged appointment ID? | Returns `not_found` — no cross-client leak |
| Client can request for another client? | **No** — `clientId` from session; body `clientId`/`adviserId` rejected |

---

## Adviser visibility of client requests

| Surface | Shows client request? |
|---------|----------------------|
| `/advisor/workspace/appointments?view=requests` | **Yes** — filters `requested`, `proposed`, `awaiting_confirmation` |
| `/advisor/today` | **Limited** — work queue `appointmentAdapter` includes `pending`/`confirmed` legacy status only; `requested` lifecycle not projected to Today cards in current adapters |
| Relationship 360 | **Partial** — next appointment date in overview; timeline shows appointment events; no dedicated "pending request" panel |

---

## Duplicate request safety

- `idempotency_key` column + lookup before insert (`createClientAppointmentRequest`)
- API POST requires `idempotencyKey`; client form generates stable key per submit attempt (`crypto.randomUUID()` stored in ref)
- Same key + same client → returns existing `appointmentId` (no duplicate row)

---

## Frozen client modules (verified unchanged in Phase 18A)

| Route | Status |
|-------|--------|
| `/actions` | Not modified |
| `/requests` | Not modified |
| `/protection` | Not modified |
| `/preferences` | Not modified |
| `/preferences/advocacy` | Not modified |
| `/messages` | Not modified |

---

## Gaps identified (pre–real-client test)

1. Today does not surface `requested` lifecycle as a dedicated card — advisers should use Appointments → Client requests view.
2. Client nav always shows Appointments link; disabled flag shows clean unavailable page (no nav hide).
3. In-app client notification on submit is intentional; confirm with operator it is acceptable for pilot (not external send).

---

## Related documents

- [CRM_V2_PHASE_04_CLIENT_APPOINTMENT_ARCHITECTURE.md](./CRM_V2_PHASE_04_CLIENT_APPOINTMENT_ARCHITECTURE.md)
- [CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_REINTRODUCTION.md](./CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_REINTRODUCTION.md)
