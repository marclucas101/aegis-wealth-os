# CRM V2 Phase 06 — API Contract

**Cache:** `private, no-store` on all routes  
**Request ID:** `X-Request-Id` header on all responses

---

## Adviser APIs

**Gate:** `assertCrmV2ServiceAccess()` — master + pilot + `crm_v2_service`

### GET /api/advisor-v2/service/commitments

List commitments for assigned relationships (adviser book-scoped).

**Response:** `{ ok: true, commitments: AdviserCommitmentDto[] }`

### POST /api/advisor-v2/service/commitments

Create commitment.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `relationshipId` | string (UUID) | Yes |
| `owner` | `adviser` \| `client` \| `shared` | Yes |
| `title` | string (≤200) | Yes |
| `description` | string (≤2000) | No |
| `dueAt` | ISO string | No |
| `clientVisible` | boolean | Yes |
| `internalNote` | string (≤2000) | No |
| `appointmentId` | string (UUID) | No |
| `sourceType` | string | No |
| `sourceId` | string (UUID) | No |
| `idempotencyKey` | string | No |

**Rejects:** browser-supplied adviser ID, invalid owner, HTML in text.

**Response 201:** `{ ok: true, commitment: AdviserCommitmentDto }`  
**409:** idempotency or source dedup conflict

### GET /api/advisor-v2/service/commitments/[commitmentId]

**Response:** `{ ok: true, commitment: AdviserCommitmentDto, events: CrmCommitmentEventDto[] }`  
**404:** `not_found` (no cross-book leakage)

### POST /api/advisor-v2/service/commitments/[commitmentId]/transition

**Body:** `toStatus`, `reasonCode`, `version` (number), optional `completionNote`, `completionEvidence`, `cancelReason`

**Response:** `{ ok: true, commitment: AdviserCommitmentDto }`  
**409:** version conflict  
**400:** invalid transition (no write)

### GET /api/advisor-v2/service/requests

Query open client service requests for adviser book.

**Response:** `{ ok: true, requests: AdviserServiceRequestDto[] }`

### POST /api/advisor-v2/service/requests/[requestId]/transition

**Body:** `toStatus`, `reasonCode`, `version`, optional `resolutionSummary`

**Response:** `{ ok: true, request: AdviserServiceRequestDto }`

---

## Client APIs

**Gate:** `assertCrmV2ClientServiceAccess()` — client role + `crm_v2_client_service` enabled and `client_visible`

### GET /api/actions

List client-visible commitments (client/shared/document actions).

**Response:** `{ ok: true, actions: ClientCommitmentActionDto[] }`

### PATCH /api/actions/[commitmentId]

Client transition on eligible commitment.

**Body:** `toStatus`, `version`, optional `completionNote`

**Response:** `{ ok: true, action: ClientCommitmentActionDto }`

### GET /api/requests

**Response:** `{ ok: true, requests: ClientServiceRequestDto[] }`

### POST /api/requests

Submit service request.

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `category` | allowlisted category | Yes |
| `summary` | string (≤200) | Yes |
| `details` | string (≤2000) | No |
| `urgency` | `low` \| `normal` \| `high` | No (default normal) |
| `idempotencyKey` | string | No |

**Response 201:** `{ ok: true, request: ClientServiceRequestDto }`

### GET /api/requests/[requestId]

**Response:** `{ ok: true, request: ClientServiceRequestDto, events: CrmServiceRequestEventDto[] }`  
**404:** not found for other clients' IDs

### POST /api/requests/[requestId]/respond

**Body:** `responseText` (string), `version` (number)

Transitions `waiting_on_client` → `in_progress` when valid.

### POST /api/requests/[requestId]/cancel

**Body:** `version` (number)

Only valid from `submitted` for client actor.

---

## DTO reference

See `lib/crm-v2/service/types.ts`:

- `AdviserCommitmentDto` — full adviser fields incl. `internalNote`, `allowedTransitions`
- `ClientCommitmentActionDto` — excludes internal notes, includes `canComplete`
- `AdviserServiceRequestDto` — includes `nextExpectedAction`, urgency
- `ClientServiceRequestDto` — includes `canRespond`, `canCancel`; excludes urgency internals

---

## Error envelope

```json
{ "ok": false, "reason": "not_found" | "forbidden" | "validation" | "conflict", "error": "safe message" }
```

**401:** unauthenticated  
**403:** forbidden / feature disabled  
**404:** not found (IDOR-safe)  
**409:** version or idempotency conflict  
**429:** rate limit (write routes)

---

## Write protections

- Rate limit bucket `writeHeavy` on POST/PATCH
- `rejectUnexpectedFields` on all bodies
- HTML stripped from text fields
- Optimistic concurrency via `version`
- Assignment enforced in service layer before admin client
