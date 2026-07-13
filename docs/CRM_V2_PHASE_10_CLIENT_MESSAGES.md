# CRM V2 Phase 10 — Client Messages

**Feature key:** `crm_v2_communications` (`enabled` + `client_visible` required)  
**Routes:** `/messages` (UI), `/api/messages` (inbox), `/api/messages/[messageId]` (detail), `/api/messages/[messageId]/reply` (reply), `/api/preferences/communications` (preferences)

---

## 1. Purpose

Provide a dedicated client portal inbox for adviser messages that have been explicitly marked client-visible and transitioned to a delivered/logged/received state. Separate from the Phase 9E `/insights` governed content feed.

**Invariant:** Clients never see drafts, pending review items, or adviser-only logs.

---

## 2. Feature gate

`assertCrmV2ClientMessagesAccess()`:

```text
ensureUserClientProfile()
  → role === client
  → crm_v2_communications.enabled AND client_visible
```

Does **not** require `crm_v2_master` or pilot allowlist — client surface is independent of adviser CRM V2 shell gates.

Disabled → `/messages` shows friendly message; APIs return 403 `feature_disabled`.

---

## 3. Page — `/messages`

**File:** `app/messages/page.tsx`

| Behaviour | Detail |
|-----------|--------|
| Server component | Loads inbox via `loadClientMessages({ clientId })` |
| Gate failure | Static message — no data fetch |
| Component | `ClientMessagesClient` with `initialInbox` |

No client-side feature flag bypass — gate enforced server-side before render.

---

## 4. Inbox API — `GET /api/messages`

**Response 200:**

```json
{
  "ok": true,
  "inbox": {
    "messages": ["ClientMessageDto"],
    "preferenceWarnings": ["string"],
    "bounded": false
  }
}
```

### Query rules (server-side)

| Filter | Value |
|--------|-------|
| `client_id` | Session client only |
| `active` | true |
| `client_visibility` | IN (`client_visible`, `both`) |
| `lifecycle_status` | IN (`sent`, `logged`, `received`) |
| Order | `updated_at DESC` |
| Limit | `CRM_V2_COMMUNICATIONS_MAX_ITEMS` (+1 for bounded flag) |

---

## 5. Message detail — `GET /api/messages/[messageId]`

Returns single `ClientMessageDto` with same visibility filters plus `messageId` and `client_id` match.

**Errors:** 401, 403, 404 (`not_found` for hidden or other client's message)

---

## 6. Client reply — `POST /api/messages/[messageId]/reply`

**Body:** `ClientMessageReplyInput`

```json
{
  "safeBody": "Thank you for the update.",
  "expectedVersion": 1
}
```

**Behaviour:**

1. Validate parent message exists, is client-visible, belongs to session client
2. Reject if `adviser_messages=false`
3. Insert new record: `direction=inbound`, `lifecycle_status=received`, `channel=internal_client_message`, `client_visibility=both`
4. Domain event: `client_replied`
5. In-app notification (non-blocking)

**Response 201:** `{ "ok": true, "message": ClientMessageDto }`

**Note:** `expectedVersion` on parent is accepted in input; reply creates new record (version on new row).

---

## 7. Client DTO — `ClientMessageDto`

### Included

| Field | Purpose |
|-------|---------|
| `messageId` | Record UUID |
| `safeSubject` | Trimmed subject (max 200) |
| `safeBody` | Full body (client-visible content only) |
| `direction` | `outbound`, `inbound`, `internal` |
| `occurredAt` | `updated_at` ISO timestamp |
| `canReply` | true when parent is outbound AND `adviser_messages` enabled |
| `version` | Optimistic concurrency hint |

### Excluded (never in client DTO)

| Field | Reason |
|-------|--------|
| `threadId` | Internal grouping |
| `templateId`, `templateKey`, `templateVersion` | Template internals |
| `sourceType`, `sourceId` | Adviser CRM context |
| `followUpStatus`, `nextFollowUpDate` | Adviser workflow |
| `created_by_user_id`, `reviewed_by_user_id` | Identity |
| `consent_basis`, `delivery_state` | Operational |
| `preferenceWarnings` per message | Aggregate on inbox only |
| Draft/review status | Not exposed |

---

## 8. Client preferences — `/api/preferences/communications`

### GET

Returns `ClientCommunicationPreferencesDto`:

```json
{
  "ok": true,
  "preferences": {
    "preferredChannel": "in_app",
    "doNotContact": false,
    "marketingOptOut": true,
    "festiveAcknowledgementOptOut": false,
    "adviserMessagesEnabled": true,
    "version": 1
  }
}
```

### PATCH

**Body:** `UpdateClientCommunicationPreferencesInput` with `expectedVersion`.

| Updatable field | Notes |
|-----------------|-------|
| `preferredChannel` | Allowlisted channel values |
| `doNotContact` | Client-initiated opt-out |
| `marketingOptOut` | Maps to `promotional_content` inverse |
| `festiveAcknowledgementOptOut` | Festive acknowledgement opt-out |
| `adviserMessagesEnabled` | Maps to `adviser_messages` |

**Concurrency:** Stale `expectedVersion` → 409.

**Side effect:** In-app `communication_preference_updated` notification; domain event on preference entity.

---

## 9. Visibility rules summary

```text
Client sees record IFF:
  client_visibility IN (client_visible, both)
  AND lifecycle_status IN (sent, logged, received)
  AND client_id = session client
  AND active = true
```

| Adviser state | Client `/messages` |
|---------------|-------------------|
| `draft` | Hidden |
| `pending_review` | Hidden |
| `approved` (not yet sent/logged) | Hidden |
| `sent` + `client_visible` | **Visible** |
| `logged` + `adviser_only` | Hidden |
| `phone_call_log` + `adviser_only` | Hidden |

---

## 10. Notifications

| Event | Notification type | Channel |
|-------|-------------------|---------|
| Adviser marks client-visible message sent/logged | `crm_client_message` | In-app only |
| Client updates preferences | `communication_preference_updated` | In-app only |
| Client sends reply | `crm_client_reply_received` | In-app only |

No email/SMS push from CRM V2 client message flow.

---

## 11. IDOR protections

| Attack | Mitigation |
|--------|------------|
| Guessed `messageId` for other client | Query filters `client_id = session.client.id` → 404 |
| Adviser calls client API | `role !== client` → 403 |
| Client calls adviser API | Separate gate with master/pilot → 403 |

---

## 12. Relationship to insights feed

| Surface | Content source | Gate |
|---------|----------------|------|
| `/insights` | `governed_content` (9E) | 9E feature keys |
| `/messages` | `crm_communication_records` (Phase 10) | `crm_v2_communications` |

Clients may use both surfaces independently when respective features are enabled.

**Branch:** `crm-v2-10-communications`
