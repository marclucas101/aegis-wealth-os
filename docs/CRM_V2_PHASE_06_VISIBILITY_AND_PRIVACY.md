# CRM V2 Phase 06 — Visibility and Privacy

**Companion:** `docs/CRM_V2_VISIBILITY_MODEL.md` §2.4 (updated)

---

## 1. Adviser DTO includes

`AdviserCommitmentDto` / `AdviserServiceRequestDto`:

- Relationship ID and display name
- Full lifecycle status and labels
- `internalNote` (adviser-only column)
- `completionNote`, `completionEvidence`
- `sourceType`, `sourceId`, `appointmentId`
- `allowedTransitions`
- Urgency on requests
- Event history on detail endpoints

---

## 2. Client DTO excludes

Never present in `ClientCommitmentActionDto` / `ClientServiceRequestDto`:

| Excluded | Reason |
|----------|--------|
| `internalNote` | Adviser-only |
| `relationshipId` (on actions list) | Minimisation where not needed for action |
| Raw audit events | Audit-only tier |
| Work-queue priority / reason codes | Operational |
| Private appointment context | Appointment adviser fields |
| Financial amounts, NRIC, policy numbers | Advice domain |
| Storage paths, signed URLs | Vault security |
| `adviser_user_id`, service-role metadata | Identity minimisation |
| Internal error details | Safe public errors only |
| Request urgency (client view) | Prevents operational signalling |
| Other clients' data | IDOR prevention |

---

## 3. Client DTO includes

| Field | Notes |
|-------|-------|
| Safe title / summary | Bounded length |
| Bounded description / details | HTML stripped |
| `lifecycleStatus` + `lifecycleLabel` / `clientVisibleStatus` | Safe labels only |
| `dueAt`, `completedAt` | When client-visible |
| `resolutionSummary` | When resolved |
| `allowedTransitions` | Client-permitted only |
| `canComplete`, `canRespond`, `canCancel` | Capability flags |
| `version` | Concurrency |

---

## 4. Visibility enforcement

- `client_visible` boolean is **explicit** — not inferred from owner alone
- Client list queries filter `client_visible = true` AND eligible owner/type
- Adviser-only commitments never returned by `/api/actions`
- Forged commitment/request IDs return `not_found` without existence disclosure
- `visibility` enum synced with `client_visible` on create

---

## 5. Document requests

- Client sees category and due date, not vault paths
- Upload uses existing vault authorization
- Request row is not the document — `documents` remains SOT after upload

---

## 6. Meeting / appointment context

- Commitment may link `appointment_id` for adviser detail
- Client DTOs do not include `private_adviser_note`, adviser agenda, or unpublished outcomes
- Meeting transcript content never copied to commitment description

---

## 7. Notifications

In-app notification payloads:

- Safe title and summary only
- `referenceType` + `referenceId` for deep link
- No financial data, private notes, or full request body

Notification failure must not corrupt authoritative transition (`notifications.ts` try/catch).
