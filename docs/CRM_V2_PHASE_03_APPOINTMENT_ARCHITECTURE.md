# CRM V2 Phase 03 — Appointment Architecture

**Phase:** 03  
**Authority:** `adviser_appointments` (extended, not replaced)

---

## 1. Authority model

| Layer | Record | Role |
|-------|--------|------|
| Authoritative | `adviser_appointments` | Single appointment identity across full lifecycle |
| Supporting | `crm_appointment_*` child tables | Participants, checklist, topics, agenda, events |
| Execution | `meeting_sessions` | Meeting Studio content; linked via `appointment_id` |
| External | `google_event_id` | Phase 05 sync mapping only |
| Projected | CRM list views, work queue | Read assemblies |

No `crm_appointments` table. Reschedule updates the same row.

---

## 2. Feature gate

`crm_v2_appointments_adviser` requires `crm_v2_master` + `crm_v2_pilot_mode` + pilot allowlist. Default disabled in code and DB seed.

---

## 3. Lifecycle

Canonical status in `crm_lifecycle_status`. Legacy `status` enum synced on CRM V2 writes for compatibility. See `CRM_V2_PHASE_03_LIFECYCLE_AND_TRANSITIONS.md`.

`rescheduled` is a **lifecycle status** (intermediate after schedule change) and **event type** `rescheduled` in `crm_appointment_state_events`.

---

## 4. Service layer

`lib/crm-v2/appointments/service.ts` — server-only:
- Creation, transition, reschedule, detail load
- Assignment enforcement via `resolveAccessibleClient`
- Event history + bounded audit logs
- Meeting Studio link on `in_progress`
- Binder readiness read-only projection

---

## 5. Routes

| UI | API |
|----|-----|
| `/advisor-v2/appointments` | `GET /api/advisor-v2/appointments` |
| `/advisor-v2/appointments/new` | `POST /api/advisor-v2/appointments` |
| `/advisor-v2/appointments/[id]` | `GET /api/advisor-v2/appointments/[id]` |
| — | `POST .../transition`, `POST .../reschedule` |

List views via `?view=agenda|upcoming|requests|preparation|follow_up|history`.

---

## 6. Templates

Code-defined in `lib/crm-v2/appointments/templates.ts` — eight initial types with checklist seeds.

---

## 7. Deferred

- Client appointment collaboration (Phase 04)
- Google Calendar sync from CRM V2 (Phase 05)
- Legacy `/advisor` replacement (Phase 14)
