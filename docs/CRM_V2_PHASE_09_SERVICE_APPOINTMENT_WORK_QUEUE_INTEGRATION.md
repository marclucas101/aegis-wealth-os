# CRM V2 Phase 09 — Service, Appointment, and Work Queue Integration

**Scope:** FK links from advocacy events to appointments and service requests; work-queue `advocacyEventAdapter`; explicit non-use of advocacy score for priority.

---

## 1. Appointment linkage

| Field | `advocacy_events.linked_appointment_id` |
|-------|----------------------------------------|
| FK | `adviser_appointments(id)` ON DELETE SET NULL |
| Purpose | Contextual link when advocacy action discussed in a meeting |
| Direction | Advocacy → appointment reference only |
| Mutations | Creating/updating advocacy event does not change appointment lifecycle |

**Example:** Adviser records `referral_received` after review meeting — sets `linked_appointment_id` to that appointment UUID.

**Non-goals:** No auto-creation of appointments from referrals; no sync of advocacy follow-up to appointment `crm_lifecycle_status`.

---

## 2. Service request linkage

| Field | `advocacy_events.linked_service_request_id` |
|-------|------------------------------------------|
| FK | `client_service_requests(id)` ON DELETE SET NULL |
| Purpose | Link advocacy event to related client service ask |
| Direction | Advocacy → service request reference only |

Phase 06 `client_service_requests` remains authoritative for request lifecycle. Advocacy does not replace `preference_update` or `review_request` categories.

---

## 3. Relationship moment linkage

| Field | `advocacy_events.linked_relationship_moment_id` |
|-------|------------------------------------------------|
| FK | `relationship_moments(id)` ON DELETE SET NULL |
| Purpose | Tie thank-you or testimonial offer to a specific moment |

Phase 08 moments authority unchanged.

---

## 4. Source type enumeration

`advocacy_events.source_type` allowlist:

| Value | Meaning |
|-------|---------|
| `manual` | Adviser-entered (default) |
| `adviser_feedback` | Linked to `adviser_feedback.id` via `source_id` |
| `service_request` | Originated from service context |
| `appointment` | Originated from appointment context |
| `relationship_moment` | Originated from moment context |
| `client_preference` | Originated from client preference change |

---

## 5. Work queue — `advocacyEventAdapter`

**File:** `lib/work-queue/adapters/advocacyEventAdapter.ts`  
**Source type:** `advocacy_event`  
**Registry:** `lib/work-queue/sourceRegistry.ts`

### Load criteria

Batch loader (`loadWorkQueueBatchData` → `loadAdvocacyEvents`):

- `active = true`
- `follow_up_status` IN (`pending`, `overdue`)
- Scoped to adviser book `clientIds`
- Advisor role filters `adviser_user_id`

### Action detection (`requiresAction`)

True when:

- `follow_up_status` is `pending` or `overdue`, OR
- `consent_state` is `withdrawn` and follow-up not completed, OR
- `consent_state` is `pending` and follow-up not completed

### Work item shape

| Field | Value |
|-------|-------|
| `category` | `task` |
| `priority` | **`normal` always** — never derived from score |
| `actionOwner` | `adviser` |
| `title` | `safe_title` from event |
| `summary` | `"Advocacy follow-up requires adviser action"` |
| `actionHref` | `/advisor-v2/relationships/{clientId}/advocacy?eventId={id}` |
| `blocking` | `false` |
| `dismissible` | `false` |
| `metadata` | `{}` — no score, no referral PII |

### Queue behaviour rules

| Rule | Detail |
|------|--------|
| Read-only adapter | `load()` only — no in-queue complete mutates advocacy |
| No score input | Adapter never calls `computeAdvocacyYearScore` |
| No priority boost | `applyPriorityToItem` receives fixed `normal` |
| Completion | Adviser navigates to advocacy workspace; transitions happen in advocacy API |

---

## 6. Batch data pipeline

```text
loadWorkQueueBatchData()
  → loadAdvocacyEvents(adviserUserId, role, clientIds)
  → context.batchData.advocacyEvents
  → advocacyEventAdapter.load(context)
  → AdviserWorkItem[]
```

Registered in `lib/work-queue/adapters/index.ts` alongside Phase 08 moment adapters.

---

## 7. Integration diagram

```text
adviser_appointments ──linked_appointment_id──► advocacy_events ◄──linked_service_request_id── client_service_requests
relationship_moments ──linked_relationship_moment_id──┘
                                                      │
                                                      ▼
                                        advocacyEventAdapter (priority: normal)
                                                      │
                                                      ▼
                                           AdviserWorkItem (virtual)
```

---

## 8. Explicit prohibitions

- Advocacy yearly score must not affect work-queue sort order
- Queue must not expose `referred_person_label` in metadata to unscoped consumers
- No automatic service request creation on `referral_received`
- No Promotions or campaign triggers from queue items
- Phase 11 Today layout uses same adapter — still no score-based sections

---

## 9. Testing checklist (integration)

1. Seed advocacy event with `follow_up_status = overdue` — queue item appears with `priority: normal`
2. High `points` event does not change queue priority
3. Click queue `actionHref` — lands on advocacy workspace with `eventId` query
4. Queue load does not increment `advocacy_events.version`
5. Linked appointment deleted — advocacy row retains with `linked_appointment_id = null` (SET NULL)
