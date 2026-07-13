# CRM V2 Phase 10 — Source Integration

**Scope:** Allowlisted `source_type` / `source_id` linkage on threads and records; contextual deep links from CRM V2 domains; explicit prohibition of auto-outreach triggers.

---

## 1. Principle

Source links provide **read-context** for advisers — they do not trigger automatic message creation, scheduling, or external send. Every communication record is adviser-initiated (or client reply on existing thread).

```text
Source event occurs (appointment, service request, moment, etc.)
  → NO automatic communication created
  → Adviser may manually create draft with sourceType + sourceId
  → Thread created as source_linked when source provided
```

---

## 2. Source type allowlist

Defined in `CRM_COMMUNICATION_SOURCE_TYPES` and enforced by DB CHECK on `crm_communication_threads` and `crm_communication_records`.

| `source_type` | Authoritative table | Link purpose |
|---------------|---------------------|--------------|
| `relationship` | `clients` | General relationship context |
| `appointment` | `adviser_appointments` | Meeting-related communication |
| `service_commitment` | `service_commitments` | Commitment follow-up |
| `client_service_request` | `client_service_requests` | Service request update |
| `protection_policy` | `protection_policies` | Protection portfolio context |
| `protection_correction_request` | `protection_correction_requests` | Correction workflow |
| `relationship_moment` | `relationship_moments` | Moment acknowledgement |
| `review_rhythm` | `review_rhythm` | Review cycle communication |
| `advocacy_event` | `advocacy_events` | Advocacy consent/thank-you context |
| `document_request` | Document workflow | Document collection |

`source_id` is optional UUID referencing the authoritative row. No FK constraints in Phase 10 migration — integrity enforced at application layer via `resolveAccessibleClient` and optional existence checks.

---

## 3. Thread typing

| `thread_type` | When set |
|---------------|----------|
| `relationship` | Default when no `sourceType` on create |
| `source_linked` | When `sourceType` (and optionally `sourceId`) provided |
| `client_inbox` | Reserved for client-initiated inbox threads (inbound replies use parent thread) |

---

## 4. Create draft with source

**POST `/api/advisor-v2/communications`**

```json
{
  "clientId": "uuid",
  "channel": "internal_client_message",
  "safeSubject": "Follow-up on your service request",
  "safeBody": "…",
  "sourceType": "client_service_request",
  "sourceId": "uuid",
  "clientVisibility": "client_visible"
}
```

**Effects:**

- `ensureThread()` creates `source_linked` thread with matching `source_type`/`source_id`
- Record stores same `source_type`/`source_id`
- No mutation on linked service request or appointment

---

## 5. Per-domain integration notes

### 5.1 Appointments (Phase 03)

- Link for prep/follow-up drafts
- **No** auto email on appointment create
- **No** sync to appointment `crm_lifecycle_status`
- Google Calendar integration unchanged

### 5.2 Service requests and commitments (Phase 06)

- `service_request_update` template category aligns with service context
- Service request lifecycle remains on `client_service_requests`
- Communications do not auto-close or auto-advance service requests

### 5.3 Protection portfolio (Phase 07)

- `protection_correction_request` source for correction-related messages
- **No** `protection_gap_trigger` automated outreach
- Portfolio tables unchanged

### 5.4 Relationship moments (Phase 08)

- `relationship_moment_acknowledgement` template category
- **No** automatic birthday/festive messages on moment dates
- `festive_acknowledgement_opt_out` respected via preference warnings

### 5.5 Advocacy (Phase 09)

- `advocacy_consent_acknowledgement` template category
- `advocacy_event` source link for thank-you/consent context
- **No** advocacy score → communication suggestion
- **No** ranking or priority from advocacy events

### 5.6 Governed content (Phase 9E)

- Optional `governed_content_id` on record for cross-reference
- **No** auto-publish from CRM V2 draft to insights feed
- `governed_content` publication workflow unchanged

---

## 6. Relationship 360 projection

**File:** `lib/crm-v2/relationships/communicationsProjection.ts`

| Output | Content |
|--------|---------|
| Label | "Communications" |
| `href` | `/advisor-v2/communications?clientId={clientId}` |
| `statusLabel` | Summary text from `loadCrmCommunicationsEngagementSummary` |

Read-only link — no embedded message bodies in R360 card.

---

## 7. Prohibited automation patterns

From `COMMUNICATION_PROHIBITED_USES` — none implemented:

| Pattern | Status |
|---------|--------|
| Auto draft on appointment booked | **Not implemented** |
| Auto message on moment date | **Not implemented** |
| Auto outreach on advocacy event | **Not implemented** |
| Protection gap trigger email | **Not implemented** |
| Campaign batch from segment | **Not implemented** |
| Promotions table write | **Not implemented** |

---

## 8. Work queue relationship

Source links do **not** cause queue items by themselves. Queue items appear only when record has `requiresAction` (pending review, failed, overdue follow-up) — see `CRM_V2_PHASE_10_WORK_QUEUE_INTEGRATION.md`.

---

## 9. Timeline (future)

`crm_communication_domain_events` may feed safe timeline projection with event titles only — no `safe_body` in timeline DTO. Phase 10 primary read surfaces are adviser workspace and client `/messages`.

---

## 10. Validation

| Check | Error |
|-------|-------|
| Invalid `sourceType` string | 400 validation |
| `sourceId` without `sourceType` | Allowed (nullable source_type) |
| Cross-client `sourceId` | Forbidden via client access resolution |

**Branch:** `crm-v2-10-communications`
