# CRM V2 Phase 06 — Service Request Lifecycle

**Module:** `lib/crm-v2/service/requestLifecycle.ts`  
**Persistence:** `client_service_requests.lifecycle_status`, `client_service_request_events`

---

## 1. States

| Status | Client-visible label | Terminal |
|--------|---------------------|----------|
| `submitted` | Submitted | No |
| `acknowledged` | Acknowledged | No |
| `in_progress` | In progress | No |
| `waiting_on_client` | Information requested | No |
| `resolved` | Resolved | **Yes** (may close) |
| `closed` | Closed | **Yes** |
| `cancelled` | Cancelled | **Yes** |

`client_visible_status` column stores safe display string; updated on transitions.

---

## 2. Categories (allowlist)

`general_enquiry`, `document_help`, `appointment_scheduling`, `account_update`, `plan_question`, `other`

No free-form category strings accepted by API validation.

---

## 3. Urgency (allowlist)

`low`, `normal`, `high` — default `normal`. High urgency elevates work-queue priority only; no wealth or advocacy prioritisation.

---

## 4. Adviser allowed transitions

| From | To |
|------|-----|
| `submitted` | `acknowledged`, `in_progress`, `cancelled` |
| `acknowledged` | `in_progress`, `waiting_on_client`, `resolved`, `cancelled` |
| `in_progress` | `waiting_on_client`, `resolved`, `closed`, `cancelled` |
| `waiting_on_client` | `in_progress`, `resolved`, `closed` |
| `resolved` | `closed` |
| `closed` | — |
| `cancelled` | — |

Acknowledgement sets `acknowledged_at`, `acknowledged_by_user_id`. Resolution sets `resolution_summary`, `resolved_at`, `resolved_by_user_id`.

---

## 5. Client allowed transitions

| From | To | Action |
|------|-----|--------|
| `submitted` | `cancelled` | Cancel while early |
| `acknowledged` | `waiting_on_client` | Rare — typically adviser-driven |
| `in_progress` | `waiting_on_client` | |
| `waiting_on_client` | `in_progress` | Respond via `/respond` API |

Client **cannot** mark `resolved`, `closed`, or `acknowledged`. Client **cannot** rewrite original `summary`/`details` — responses recorded as events.

---

## 6. Permissions summary

| Action | Client | Adviser |
|--------|--------|---------|
| Submit request | Yes | No |
| View own request | Yes | Assigned only |
| Acknowledge | No | Yes |
| Request information | No | Yes (`waiting_on_client`) |
| Respond to information | Yes | No |
| Resolve | No | Yes |
| Close | No | Yes |
| Cancel (early) | Yes (`submitted` only) | Yes (broader) |
| Edit original submission | No | No (audit trail retained) |

---

## 7. Reason codes

`client_submitted`, `adviser_acknowledged`, `adviser_progressed`, `information_requested`, `client_responded`, `adviser_resolved`, `client_cancelled`, `adviser_closed`, `operator_override`

---

## 8. Transition enforcement

- Invalid transition → no write, safe 400.
- Terminal source → `terminal_state`.
- Stale `version` → 409 conflict.
- `canClientCancelServiceRequest` — only when status is `submitted`.

---

## 9. API surface

| Actor | Endpoint | Method |
|-------|----------|--------|
| Client | `/api/requests` | POST (submit), GET (list) |
| Client | `/api/requests/[requestId]` | GET |
| Client | `/api/requests/[requestId]/respond` | POST |
| Client | `/api/requests/[requestId]/cancel` | POST |
| Adviser | `/api/advisor-v2/service/requests` | GET |
| Adviser | `/api/advisor-v2/service/requests/[requestId]/transition` | POST |
