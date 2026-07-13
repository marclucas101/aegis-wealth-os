# CRM V2 Phase 06 — Commitment Lifecycle

**Module:** `lib/crm-v2/service/commitmentLifecycle.ts`  
**Persistence:** `service_commitments.lifecycle_status`, `service_commitment_events`

---

## 1. States

| Status | Meaning | Terminal |
|--------|---------|----------|
| `open` | Created, not yet started | No |
| `in_progress` | Active work | No |
| `waiting_on_client` | Blocked on client action | No |
| `waiting_on_adviser` | Blocked on adviser action | No |
| `blocked` | External/other blocker | No |
| `completed` | Fulfilled | **Yes** |
| `cancelled` | Withdrawn | **Yes** |

Terminal states: `completed`, `cancelled`. No silent reopen — would require explicit audited transition (not in initial allowlists).

---

## 2. Owner model

| Owner | Typical actor | Client can complete? |
|-------|---------------|---------------------|
| `adviser` | Adviser | **No** |
| `client` | Client | **Yes** (when visible) |
| `shared` | Either | **Yes** (client portion) |

`validateCommitmentTransition` enforces `owner_forbidden` when client attempts `completed` on adviser-owned commitment.

---

## 3. Adviser allowed transitions

From each state, adviser (or system) may transition to:

| From | To |
|------|-----|
| `open` | `in_progress`, `waiting_on_client`, `waiting_on_adviser`, `blocked`, `completed`, `cancelled` |
| `in_progress` | `waiting_on_client`, `waiting_on_adviser`, `blocked`, `completed`, `cancelled` |
| `waiting_on_client` | `in_progress`, `waiting_on_adviser`, `blocked`, `completed`, `cancelled` |
| `waiting_on_adviser` | `in_progress`, `waiting_on_client`, `blocked`, `completed`, `cancelled` |
| `blocked` | `in_progress`, `waiting_on_client`, `waiting_on_adviser`, `cancelled` |
| `completed` | — |
| `cancelled` | — |

---

## 4. Client allowed transitions

Client transitions respect owner:

| From | To | Notes |
|------|-----|-------|
| `open` | `in_progress`, `waiting_on_adviser`, `completed`, `cancelled` | `completed` only if owner ≠ adviser |
| `in_progress` | `waiting_on_adviser`, `completed`, `cancelled` | |
| `waiting_on_client` | `in_progress`, `completed` | |
| `waiting_on_adviser` | `waiting_on_client` | |
| `blocked` | — | Client cannot unblock |
| `completed` / `cancelled` | — | Terminal |

If `owner === adviser`, client transition set is empty (`getAllowedClientCommitmentTransitions` returns `[]`).

---

## 5. Reason codes

| Code | Use |
|------|-----|
| `adviser_created` | Adviser created commitment |
| `client_created` | Client-originated (if supported) |
| `adviser_progressed` | General adviser transition |
| `client_progressed` | General client transition |
| `waiting_on_client` | Explicit handoff to client |
| `waiting_on_adviser` | Explicit handoff to adviser |
| `blocked` | Blocked |
| `adviser_completed` / `client_completed` / `shared_completed` | Completion |
| `adviser_cancelled` / `client_cancelled` | Cancellation |
| `meeting_outcome_linked` | Created from meeting |
| `document_received` | Document fulfilment |
| `operator_override` | Admin override |

---

## 6. Transition rules

- **Same state:** `same_state_noop` — no write.
- **Terminal source:** `terminal_state` — no write.
- **Invalid edge:** `invalid_transition` — no write.
- **Owner violation:** `owner_forbidden` — no write.
- **Concurrency:** optimistic `version` check; stale update returns **409 conflict**.
- **Completion:** sets `completed_at`, `completed_by_user_id`; optional `completion_note`, `completion_evidence`.
- **History:** every transition appends `service_commitment_events` row (immutable).

---

## 7. Visibility interaction

- `client_visible` and `visibility` enum (`adviser_only`, `client_visible`, `shared`) control client DTO inclusion.
- Client APIs filter to `client_visible = true` AND owner in (`client`, `shared`) OR `commitment_type = document_request`.
- Adviser-only commitments never appear in `/api/actions`.

---

## 8. API surface

| Actor | Endpoint |
|-------|----------|
| Adviser | `POST /api/advisor-v2/service/commitments/[commitmentId]/transition` |
| Client | `PATCH /api/actions/[commitmentId]` |

Both require `toStatus`, `version`; adviser may supply `completionNote`, `completionEvidence`, `cancelReason`.
