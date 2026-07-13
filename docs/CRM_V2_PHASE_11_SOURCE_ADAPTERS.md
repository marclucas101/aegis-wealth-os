# CRM V2 Phase 11 — Source Adapters

**Phase:** 11

---

## 1. Adapter inventory

| Adapter | File | Authoritative source |
|---------|------|---------------------|
| Work queue | `sourceAdapters/workQueueAdapter.ts` | Phase 10.2 virtual queue items |
| Google Calendar | `sourceAdapters/googleCalendarAdapter.ts` | `adviser_calendar_connections`, `crm_google_calendar_event_mappings` |

Work queue adapter delegates to existing Phase 10.2 adapters via `buildAdviserWorkQueue`.

---

## 2. Work queue source mapping

| Source type | Today section | CRM V2 route |
|-------------|---------------|--------------|
| `appointment` | Schedule / Prepare | `/advisor-v2/appointments/[id]` |
| `meeting_follow_up` | Follow-ups | Appointment detail |
| `client_service_request` | Client Requests | `/advisor-v2/service` |
| `service_commitment` | Service Due | `/advisor-v2/service` |
| `protection_extraction` | Protection | `/advisor-v2/relationships/[id]/protection` |
| `protection_policy_servicing` | Protection | Protection workspace |
| `relationship_moment` | Relationship Moments | `/advisor-v2/relationships/[id]/moments` |
| `crm_review_rhythm` / `review_due` | Reviews | Relationship 360 |
| `client_preference_update` | Relationship Moments | Relationship profile tab |
| `advocacy_event` | Follow-ups | Advocacy workspace |
| `communication_record` | Communications | Communications workspace |

---

## 3. Assignment enforcement

- `buildAdviserWorkQueue` filters to `advisor_user_id === authUserId`.
- Google Calendar status scoped to `authUserId`.
- No browser-supplied adviser ID.

---

## 4. Isolation

Adapter failures append to `sourceFailures` with safe messages. Other sections continue to render.

---

## 5. No writes

All adapters are read-only. Card actions route to authoritative workflow APIs.
