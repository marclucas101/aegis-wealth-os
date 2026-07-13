# CRM V2 Phase 06 — Service Architecture

**Branch:** `crm-v2-06-service-commitments`  
**Feature keys:** `crm_v2_service` (adviser), `crm_v2_client_service` (client) — both default **disabled**.

---

## 1. Canonical authorities

| Authority | Table | Purpose |
|-----------|-------|---------|
| Service commitments | `service_commitments` | Explicit promises/actions (adviser, client, shared, document, follow-up) |
| Client service requests | `client_service_requests` | Client-initiated asks to adviser/firm |
| Commitment audit | `service_commitment_events` | Immutable lifecycle history |
| Request audit | `client_service_request_events` | Immutable request history |

**Not authoritative:** Service workspace views, client Actions/Requests UI, Relationship 360 service projection, work-queue items, timeline entries.

---

## 2. Operating flow

```mermaid
flowchart LR
  subgraph authorities [Authoritative writes]
    SC[service_commitments]
    CSR[client_service_requests]
  end

  subgraph adviser [Adviser CRM V2]
    SW[/advisor-v2/service]
    API_A[/api/advisor-v2/service/**]
  end

  subgraph client [Client portal]
    ACT[/actions]
    REQ[/requests]
    API_C[/api/actions /api/requests]
  end

  subgraph projections [Read-only projections]
    R360[Relationship 360 Service tab]
    WQ[Phase 10.2 work queue]
    TL[Engagement timeline]
  end

  SC --> API_A --> SW
  CSR --> API_A --> SW
  SC --> API_C --> ACT
  CSR --> API_C --> REQ
  SC --> R360
  CSR --> R360
  SC --> WQ
  CSR --> WQ
  SC --> TL
  CSR --> TL
```

---

## 3. Service layer modules

| Module | Path | Role |
|--------|------|------|
| Core service | `lib/crm-v2/service/service.ts` | CRUD, transitions, DTO mapping |
| Commitment lifecycle | `lib/crm-v2/service/commitmentLifecycle.ts` | State machine |
| Request lifecycle | `lib/crm-v2/service/requestLifecycle.ts` | Request state machine |
| Workspace queries | `lib/crm-v2/service/listQueries.ts` | My Work, reviews, documents, completed |
| Notifications | `lib/crm-v2/service/notifications.ts` | In-app only, non-blocking |
| Types | `lib/crm-v2/service/types.ts` | Adviser/client DTOs |
| Access | `lib/crm-v2/access.ts` | `assertCrmV2ServiceAccess`, `assertCrmV2ClientServiceAccess` |

---

## 4. Commitment types

| `commitment_type` | Owner typical | Client visible when |
|-------------------|---------------|---------------------|
| `adviser_commitment` | adviser | `client_visible = false` (default) |
| `client_commitment` | client | `client_visible = true` (explicit) |
| `shared_commitment` | shared | `client_visible = true` |
| `document_request` | varies | `client_visible = true` |
| `appointment_follow_up_item` | varies | explicit flag |

Types **not** implemented as commitment rows: `client_service_request` (separate table), `review_workflow_step`, `appointment_preparation_item`.

---

## 5. Non-duplication rules

| Prohibited duplicate | Authoritative instead |
|---------------------|----------------------|
| Second task table | `advisor_tasks` |
| Second request table on commitments | `client_service_requests` |
| Checklist-as-commitment | `crm_appointment_checklist_items` |
| Roadmap-as-commitment (automatic) | `roadmap_items` |
| Review-as-commitment | Review pipeline on `clients` + `annual_reviews` |
| Document-as-request-row in vault | `documents` |
| Queue-owned records | Source tables |
| Copied source payloads | `source_type` + `source_id` link only |

**Idempotency:** `idx_service_commitments_idempotency` (adviser + key), `idx_service_commitments_source_dedup` (source + type), `idx_client_service_requests_idempotency` (client + key).

---

## 6. Integration boundaries

| Domain | Integration | Authority unchanged |
|--------|-------------|---------------------|
| Appointments | `appointment_id` FK; follow-up projection | `adviser_appointments` |
| Meeting Studio | `source_type = meeting_session` | `meeting_sessions` |
| Documents | Document request → vault upload | `documents` |
| Relationship 360 | `serviceProjection.ts` bounded read | `clients.id` |
| Notifications | `client_notifications` delivery | Existing infra |
| Legacy adviser portal | Deep links to `/advisor/clients/...` tasks | Unchanged |

---

## 7. Feature gating

**Adviser Service workspace** requires, in order:

```text
requireAdvisorAccess()
  → crm_v2_master
  → crm_v2_pilot_mode + CRM_V2_PILOT_USER_IDS
  → crm_v2_service
```

**Client Actions/Requests** requires:

```text
ensureUserClientProfile() — role = client
  → crm_v2_client_service (enabled + client_visible)
```

Client flag does **not** grant adviser CRM access.

---

## 8. RLS pattern

All Phase 06 tables use assignment-scoped policies:

```sql
USING (is_assigned_advisor(client_id) OR is_admin())
WITH CHECK (is_assigned_advisor(client_id) OR is_admin())
```

Client-facing APIs use service-role reads with `client_id` scoped to session-derived client row — not broad client RLS on service tables in Phase 06.
