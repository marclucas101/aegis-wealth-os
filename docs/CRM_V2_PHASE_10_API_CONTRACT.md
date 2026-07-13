# CRM V2 Phase 10 — API Contract

**Namespace:** `/api/advisor-v2/communications` (adviser), `/api/messages` and `/api/preferences/communications` (client)  
**Cache:** All routes `dynamic = "force-dynamic"`, `Cache-Control: private, no-store`  
**Tracing:** `X-Request-Id` on every response

---

## 1. Feature gates

| Surface | Gate function | Required flags |
|---------|---------------|----------------|
| Adviser communications APIs | `assertCrmV2CommunicationsAccess()` | `crm_v2_master`, `crm_v2_pilot_mode`, pilot allowlist, `crm_v2_communications` |
| Client messages APIs | `assertCrmV2ClientMessagesAccess()` | `crm_v2_communications` (`enabled` + `client_visible`) |

**Single feature key:** `crm_v2_communications` — no separate client key.

---

## 2. Adviser — workspace

### GET `/api/advisor-v2/communications`

**Query params:**

| Param | Type | Default |
|-------|------|---------|
| `view` | `CrmCommunicationWorkspaceView` | `drafts` |
| `clientId` | UUID (optional) | Filter to one client |

**Response 200:**

```json
{
  "ok": true,
  "workspace": {
    "view": "drafts",
    "drafts": ["AdviserCommunicationRecordDto"],
    "needsReview": ["AdviserCommunicationRecordDto"],
    "recent": ["AdviserCommunicationRecordDto"],
    "followUps": ["AdviserCommunicationRecordDto"],
    "actionRequired": ["AdviserCommunicationRecordDto"],
    "templates": ["AdviserCommunicationTemplateDto"],
    "bounded": false
  }
}
```

**Errors:** 401, 403 (`feature_disabled` / `forbidden`), 404 (`not_found` for invalid `clientId` filter)  
**Side effects:** None (read-only)

---

### POST `/api/advisor-v2/communications`

**Body:** `CreateCommunicationDraftInput`

```json
{
  "clientId": "uuid",
  "channel": "internal_client_message",
  "safeSubject": "Service update",
  "safeBody": "Optional body",
  "sourceType": "client_service_request",
  "sourceId": "uuid",
  "clientVisibility": "adviser_only",
  "templateKey": "service_request_update_v1",
  "templateVariables": {
    "client_name": "Alex",
    "request_reference": "SR-1001",
    "update_summary": "We have received your documents.",
    "adviser_name": "Jordan"
  },
  "idempotencyKey": "optional-key"
}
```

**Response 201:** `{ "ok": true, "record": AdviserCommunicationRecordDto }`

**Validation:**

- `channel` allowlisted; must support drafts (except log-only channels)
- `sourceType` allowlisted when provided
- `do_not_contact` blocks create
- Template must be approved/active; variables must pass allowlist
- `phone_call_log` / `external_message_log` create as `lifecycle_status=logged`
- Duplicate `idempotencyKey` per client returns existing record

**Errors:** 400 validation, 403 forbidden, 404 not_found, 409 conflict

---

### PATCH `/api/advisor-v2/communications/[communicationId]`

**Body:** `UpdateCommunicationRecordInput`

```json
{
  "expectedVersion": 1,
  "safeSubject": "Updated subject",
  "safeBody": "Updated body",
  "clientVisibility": "client_visible"
}
```

**Response 200:** `{ "ok": true, "record": AdviserCommunicationRecordDto }`

**Validation:** Record must be `draft` or `pending_review`; stale version → 409

**Errors:** 400, 403, 404, 409

---

### POST `/api/advisor-v2/communications/[communicationId]/transition`

**Body:** `TransitionCommunicationInput`

```json
{
  "expectedVersion": 1,
  "transition": "mark_sent"
}
```

**Transitions:** `submit_review`, `approve`, `mark_sent`, `mark_logged`, `mark_received`, `mark_failed`, `cancel`, `archive`

**Response 200:** `{ "ok": true, "record": AdviserCommunicationRecordDto }`

**Validation:**

- Transition must be valid for current `lifecycle_status`
- `mark_sent` blocked when `isCampaignStyleBlocked()` (marketing opt-out or do-not-contact)
- Client-visible sent/logged triggers in-app notification (non-blocking)

**Errors:** 400, 403, 404, 409

---

### POST `/api/advisor-v2/communications/[communicationId]/follow-up`

**Body:** `CommunicationFollowUpInput`

```json
{
  "expectedVersion": 1,
  "action": "schedule",
  "nextFollowUpDate": "2026-07-20"
}
```

**Actions:** `schedule` (sets `follow_up_status=pending`), `complete` (sets `completed`)

**Response 200:** `{ "ok": true, "record": AdviserCommunicationRecordDto }`

**Errors:** 400, 403, 404, 409

---

### GET `/api/advisor-v2/communications/templates`

**Response 200:**

```json
{
  "ok": true,
  "templates": ["AdviserCommunicationTemplateDto"]
}
```

Returns `active=true` AND `compliance_status=approved` only.

---

### GET `/api/advisor-v2/communications/preferences/[relationshipId]`

**Response 200:**

```json
{
  "ok": true,
  "preferences": "AdviserCommunicationPreferencesDto"
}
```

**Errors:** 403/404 when relationship not in adviser book

---

## 3. Client — messages

### GET `/api/messages`

**Response 200:**

```json
{
  "ok": true,
  "inbox": "ClientMessagesInboxDto"
}
```

---

### GET `/api/messages/[messageId]`

**Response 200:**

```json
{
  "ok": true,
  "message": "ClientMessageDto"
}
```

**Errors:** 404 when not client-visible or wrong client

---

### POST `/api/messages/[messageId]/reply`

**Body:** `ClientMessageReplyInput`

```json
{
  "safeBody": "Thank you.",
  "expectedVersion": 1
}
```

**Response 201:** `{ "ok": true, "message": ClientMessageDto }`

**Validation:** `adviser_messages` must be enabled; body required

---

## 4. Client — preferences

### GET `/api/preferences/communications`

**Response 200:** `{ "ok": true, "preferences": ClientCommunicationPreferencesDto }`

### PATCH `/api/preferences/communications`

**Body:** `UpdateClientCommunicationPreferencesInput`

```json
{
  "expectedVersion": 1,
  "doNotContact": false,
  "adviserMessagesEnabled": true,
  "marketingOptOut": true,
  "festiveAcknowledgementOptOut": false,
  "preferredChannel": "in_app"
}
```

**Response 200:** `{ "ok": true, "preferences": ClientCommunicationPreferencesDto }`

**Errors:** 409 on stale version

---

## 5. DTO reference (abbreviated)

### `AdviserCommunicationRecordDto`

`recordId`, `threadId`, `clientId`, `clientDisplayName`, `channel`, `direction`, `lifecycleStatus`, `safeSubject`, `safeBodyPreview`, `sourceType`, `sourceId`, `clientVisibility`, `followUpStatus`, `nextFollowUpDate`, `templateKey`, `templateVersion`, `labels`, `preferenceWarnings`, `version`, `createdAt`, `updatedAt`

### `AdviserCommunicationTemplateDto`

`templateId`, `templateKey`, `category`, `channel`, `title`, `bodyPreview`, `variableSchema`, `complianceStatus`, `version`, `active`

### `ClientMessageDto`

`messageId`, `safeSubject`, `safeBody`, `direction`, `occurredAt`, `canReply`, `version`

---

## 6. Error reason codes

| `reason` | Typical HTTP |
|----------|--------------|
| `unauthenticated` | 401 |
| `forbidden` | 403 |
| `feature_disabled` | 403 |
| `not_found` | 404 |
| `validation` | 400 |
| `conflict` | 409 |

Public error messages via `toPublicErrorMessage` — no raw provider/stack traces.

---

## 7. Routes explicitly not in Phase 10

| Route | Status |
|-------|--------|
| Auto-send webhook | **Not implemented** |
| Campaign batch API | **Not implemented** |
| Promotions write | **Retired** (`legacy_promotions_write=false`) |
| External SMS/WhatsApp dispatch | **Not implemented** |

**Branch:** `crm-v2-10-communications`
