# CRM V2 Phase 06 — Work Queue Integration

**Principle:** Work queue remains **virtual**, **read-only**, and **non-authoritative** per Phase 10.2.

---

## 1. New adapters

| Adapter | File | `sourceType` |
|---------|------|--------------|
| Service commitment | `lib/work-queue/adapters/serviceCommitmentAdapter.ts` | `service_commitment` |
| Client service request | `lib/work-queue/adapters/clientServiceRequestAdapter.ts` | `client_service_request` |

Registered in `lib/work-queue/adapters/index.ts` and `lib/work-queue/sourceRegistry.ts`.

Batch data loaded via `lib/work-queue/batchData.ts` (`serviceCommitments`, `clientServiceRequests`).

---

## 2. Service commitment adapter

**Includes rows when:**

- `lifecycle_status` in `open`, `in_progress`, `waiting_on_client`, `waiting_on_adviser`, `blocked`
- Client in adviser assignment scope
- **Skips** client-owned items in `waiting_on_client` (client's turn, not adviser queue noise)

**Maps to `AdviserWorkItem`:**

- `category`: `task`
- `actionOwner`: `client` if owner is client, else `adviser`
- `actionHref`: `/advisor-v2/service?view=commitments`
- `reasonCodes`: `task_open`, `task_overdue` when due or `waiting_on_adviser`
- `blocking`: true when overdue
- `dismissible`: false

Queue completion does **not** mutate `service_commitments` — adviser must use Service workspace or API.

---

## 3. Client service request adapter

**Includes rows when:**

- `lifecycle_status` in `submitted`, `acknowledged`, `in_progress`, `waiting_on_client`
- Client in assignment scope

**Maps to `AdviserWorkItem`:**

- `actionOwner`: `adviser` (always)
- `priority`: `high` when `urgency = high`
- `blocking`: true when urgency high
- `actionHref`: `/advisor-v2/service?view=client_requests`
- `timing`: `no_due_date`; `occurredAt` = created time

---

## 4. Read-only guarantees

| Prohibited | Enforced by |
|------------|-------------|
| Queue writes to source tables | Adapter `load()` only — no persistence API |
| Queue-owned work records | No `advisor_work_items` table |
| GET side effects | Service list APIs read-only |
| Client wealth / revenue / advocacy / ethnicity in items | Adapter field allowlist |

---

## 5. Coexistence with legacy adapters

Phase 06 does not remove:

- `advisorTaskAdapter` — legacy tasks remain authoritative
- Appointment adapters — unchanged
- Review projections — via Service workspace Reviews view (not a separate queue source in Phase 06)

My Work workspace aggregates commitments, requests, tasks, and follow-ups — this is a **UI projection**, not a second queue authority.

---

## 6. href allowlist

Service adapter hrefs use `/advisor-v2/service?...` — within Phase 11 extended allowlist (`/advisor-v2/**`).

Legacy task links continue to use `/advisor/clients/[clientId]/...` where appropriate.

---

## 7. Feature gating

Work-queue assembly requires `adviser_work_queue` flag (Phase 11). Phase 06 registers adapters and batch loaders; full Today integration is Phase 11. Adapters are inert until queue feature enabled.
