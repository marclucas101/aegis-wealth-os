# CRM V2 Phase 06 — Existing Servicing Audit

**Purpose:** Classify every pre-Phase-06 servicing source before introducing canonical CRM V2 service authorities.  
**Rule:** One authoritative record per domain; projections and queues are never SOT.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **Authoritative** | Existing SOT — mutations stay here |
| **Reuse** | Read or link without copying payload |
| **Projection** | Assembled read model only |
| **New** | Greenfield canonical table introduced Phase 06 |
| **Deferred** | Out of Phase 06 scope |
| **Rejected** | Duplicate authority — must not create |

---

## 1. `advisor_tasks`

| Item | Detail |
|------|--------|
| Table | `advisor_tasks` |
| APIs | `GET/POST /api/advisor/tasks`, client-scoped task routes under `/api/advisor/clients/[clientId]/...` |
| Code | `lib/supabase/advisorTasksPersistence.ts`, work-queue `advisorTaskAdapter` |
| Classification | **Authoritative** (legacy adviser tasks) |
| Phase 06 decision | **Reuse** — retain as SOT for general adviser tasks (birthday reminders, ad-hoc tasks). Service workspace My Work projects open tasks via `listQueries.ts`. Work-queue adapter unchanged. Do **not** migrate rows into `service_commitments`. |

---

## 2. Roadmap items / actions

| Item | Detail |
|------|--------|
| Table | `roadmap_items` |
| APIs | `/api/advisor/clients/[clientId]/roadmap-actions`, `/api/client/roadmap`, `/api/roadmap/**` |
| Code | `lib/crm-v2/relationships/serviceProjection.ts` |
| Classification | **Authoritative** (planning domain) |
| Phase 06 decision | **Reuse / projection** — Relationship 360 Service tab and roadmap APIs remain authoritative. Service workspace does not duplicate roadmap rows. Optional `source_type` + `source_id` link on commitments when adviser explicitly ties a commitment to a roadmap item. |

---

## 3. Annual / periodic reviews

| Item | Detail |
|------|--------|
| Tables | `annual_reviews`, `clients.last_review_at`, `clients.next_review_due` |
| APIs | `/api/advisor/review-pipeline`, `/api/annual-review/current` |
| Code | `lib/supabase/advisorReviewPipeline.ts`, `loadServiceWorkspaceReviews` |
| Classification | **Authoritative** (review workflow) |
| Phase 06 decision | **Reuse / projection** — Reviews view in Service workspace projects due/overdue clients from existing pipeline. No `review_workflow_step` table created. Blueprint type `review_workflow_step` **rejected** as duplicate authority. |

---

## 4. Appointment checklist items

| Item | Detail |
|------|--------|
| Table | `crm_appointment_checklist_items` |
| APIs | Phase 03/04 appointment APIs |
| Classification | **Authoritative** (appointment preparation) |
| Phase 06 decision | **Reuse** — Preparation checklist remains appointment-native. Do **not** copy checklist rows into `service_commitments`. Type `appointment_preparation_item` from blueprint **rejected** as duplicate. |

---

## 5. Appointment follow-up

| Item | Detail |
|------|--------|
| Column | `adviser_appointments.follow_up_state` |
| APIs | Phase 03 transition APIs set follow-up state |
| Code | `listQueries.loadServiceWorkspaceMyWork` projects `follow_up_state = required` |
| Classification | **Authoritative** (appointment lifecycle) |
| Phase 06 decision | **Reuse / projection** — Follow-up-required appointments appear in My Work. Explicit agreed follow-up actions may be created as `service_commitments` with `commitment_type = appointment_follow_up_item` and `appointment_id` link. Idempotency via `idx_service_commitments_source_dedup`. |

---

## 6. Document requests

| Item | Detail |
|------|--------|
| Prior authority | No standalone `document_requests` table existed |
| Vault | `documents` remains SOT for uploaded files |
| Classification | **New** (within commitments) |
| Phase 06 decision | **New** — `service_commitments` with `commitment_type = document_request` is the request authority. Upload completion remains vault-governed. Checklist completion is separate from document request completion. |

---

## 7. Client notifications

| Item | Detail |
|------|--------|
| Table | `client_notifications` |
| APIs | `/api/client/notifications` |
| Code | `lib/crm-v2/service/notifications.ts` |
| Classification | **Authoritative** (delivery record) |
| Phase 06 decision | **Reuse** — Phase 06 emits in-app notifications only via `dbCreateClientNotification`. Notification failure is non-blocking and must not corrupt service transitions. |

---

## 8. Client service / support requests (pre-Phase 06)

| Item | Detail |
|------|--------|
| Prior state | No `client_service_requests` table; client portal had no dedicated service-request workflow |
| Classification | **New** |
| Phase 06 decision | **New** — `client_service_requests` + `client_service_request_events` as separate authority from commitments. Blueprint type `client_service_request` on commitments **rejected** in favour of dedicated request table. |

---

## 9. Meeting actions / outcomes

| Item | Detail |
|------|--------|
| Tables | `meeting_sessions`, `meeting_session_events` |
| Classification | **Authoritative** (Meeting Studio) |
| Phase 06 decision | **Reuse** — Meeting outcomes may propose commitments via `source_type` / `source_id` (e.g. `meeting_session`). Private meeting notes are never copied into client-visible commitment descriptions. |

---

## 10. Client portal action views

| Item | Detail |
|------|--------|
| Routes (new) | `/actions`, `/requests`, `/requests/[requestId]` |
| APIs | `/api/actions`, `/api/requests/**` |
| Classification | **Projection** (UI over canonical APIs) |
| Phase 06 decision | **New views** gated by `crm_v2_client_service`. Existing `/dashboard`, `/my-plan`, `/roadmap`, `/appointments` unchanged. |

---

## 11. Phase 10.2 work-queue adapters

| Item | Detail |
|------|--------|
| Model | Virtual `AdviserWorkItem` — not persisted |
| Existing adapters | `advisorTaskAdapter`, appointment adapters, etc. |
| Classification | **Projection** |
| Phase 06 decision | **Reuse pattern** — add `serviceCommitmentAdapter` and `clientServiceRequestAdapter`. Queue remains read-only; completion routes to authoritative workflow. |

---

## 12. Adviser–client assignment

| Item | Detail |
|------|--------|
| Column | `clients.advisor_user_id` |
| Helpers | `is_assigned_advisor(client_id)`, `resolveAccessibleClient`, `assertCrmV2ServiceAccess` |
| Classification | **Authoritative** (assignment) |
| Phase 06 decision | **Reuse** — all service RLS and API guards derive assignment server-side. No browser-supplied adviser or client IDs. |

---

## Summary matrix

| Source | Classification | Phase 06 action |
|--------|----------------|-----------------|
| `advisor_tasks` | Authoritative | Reuse; project in My Work + queue |
| `roadmap_items` | Authoritative | Reuse; project in Relationship 360 |
| Review pipeline | Authoritative | Reuse; project in Reviews view |
| `crm_appointment_checklist_items` | Authoritative | Reuse; no commitment duplicate |
| Appointment follow-up state | Authoritative | Project; optional explicit commitment link |
| Document requests | None prior | **New** `document_request` commitment type |
| `client_notifications` | Authoritative | Reuse delivery infra |
| Client service requests | None prior | **New** `client_service_requests` table |
| Meeting sessions | Authoritative | Reuse; optional commitment source link |
| Work queue | Projection | Extend adapters only |
| `service_commitments` | **New** | Canonical CRM commitments |
| Generic `advisor_work_items` | Rejected | Must not create |
| Second review table | Rejected | Must not create |
| Commitment-as-request duplicate | Rejected | Separate request authority |

---

## Where `service_commitments` is required

- Explicit adviser, client, or shared promises with lifecycle and optional due date.
- Document requests when no prior request authority existed.
- Explicit appointment follow-up items when converted from meeting/appointment workflow.
- Linked items via `source_type` / `source_id` without copying source payloads.

## Where `service_commitments` must not duplicate

- `advisor_tasks` rows
- `roadmap_items` planning actions
- Review pipeline state
- Appointment preparation checklist items
- Vault `documents` (upload authority)
- Work-queue virtual items
- Client service requests (separate table)
