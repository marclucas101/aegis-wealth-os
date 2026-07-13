# CRM V2 Phase 10 — Visibility and Privacy

**Scope:** Distinct adviser vs client DTOs, field redactions, preference warning exposure, and cross-surface privacy boundaries for CRM V2 communications.

---

## 1. Visibility tiers (communications extension)

| Tier | Communications examples |
|------|-------------------------|
| **Adviser-only** | Draft bodies, pending review content, call logs, external drafts, `preferenceWarnings` context, follow-up internals |
| **Client-visible** | `sent`/`logged`/`received` records with `client_visibility` IN (`client_visible`, `both`) |
| **Audit-only** | `crm_communication_domain_events.safe_metadata`, `idempotency_key`, actor user IDs |
| **Never client** | Template internals, source IDs, thread IDs, delivery state, consent basis |

---

## 2. Adviser DTO — `AdviserCommunicationRecordDto`

### Included

- `safeSubject`, `safeBodyPreview` (120-char preview, not full body in list)
- `channel`, `direction`, `lifecycleStatus`
- `clientVisibility`, `followUpStatus`, `nextFollowUpDate`
- `sourceType`, `sourceId` (assigned book only)
- `templateKey`, `templateVersion` (not template body)
- `labels` — `draft`, `pending_review`, `client_visible`, `preference_conflict`, `follow_up_due`, etc.
- `preferenceWarnings` — string codes only
- `version`, timestamps

### Redacted from list DTO

| Field | Reason |
|-------|--------|
| Full `safe_body` | Use PATCH/detail if extended; list uses preview |
| `governed_content_id` | Internal linkage |
| `idempotency_key` | Operational |
| `created_by_user_id` | Audit domain |
| Raw preference row | Mapped to warnings only |

### Adviser preferences — `AdviserCommunicationPreferencesDto`

| Field | Visible |
|-------|---------|
| All preference flags | Yes — assigned adviser only |
| `preferenceWarnings` | Yes |
| Other clients' preferences | **No** |

---

## 3. Client DTO — `ClientMessageDto`

### Included

- `messageId`, `safeSubject`, `safeBody`
- `direction`, `occurredAt`, `canReply`, `version`

### Redacted

| Field | Reason |
|-------|--------|
| `threadId`, `sourceType`, `sourceId` | Adviser CRM context |
| `templateKey`, `templateVersion`, `templateId` | Template internals |
| `lifecycleStatus` (draft/review) | Client sees only delivered states via query filter |
| `followUpStatus`, `nextFollowUpDate` | Adviser workflow |
| `preferenceWarnings` per message | Inbox-level only |
| Other clients' messages | Assignment/session scope |
| Adviser notes on call logs | `adviser_only` visibility |

---

## 4. Client preferences — `ClientCommunicationPreferencesDto`

### Included

- `preferredChannel`, `doNotContact`, `marketingOptOut`
- `festiveAcknowledgementOptOut`, `adviserMessagesEnabled`
- `version`

### Redacted

| Field | Reason |
|-------|--------|
| `client_message_visibility` | Adviser-side inbox management (Phase 10 adviser DTO only) |
| Other clients' preferences | Session scoped |
| Communication record history | Client inbox separate from preferences |

---

## 5. Relationship list and 360

| Surface | Communications data |
|---------|---------------------|
| Relationship list | **No message bodies, no draft counts** |
| Relationship 360 overview | Safe engagement link: label + status text via `loadCrmCommunicationsEngagementLink` |
| Relationship 360 engagement tab | Link to `/advisor-v2/communications?clientId=` — no message content in tab |
| Timeline projection | Future: safe domain event titles only — no `safe_body` |

---

## 6. Work queue DTO — `AdviserWorkItem`

| Field | Communication adapter value |
|-------|----------------------------|
| `title` | Record `safe_subject` |
| `summary` | Generic: "Communication requires adviser action" |
| `priority` | `normal` — never score-derived |
| `metadata` | Empty `{}` |
| `actionHref` | Communications workspace with `clientId` |

**Excluded:** full body, template content, preference details, source metadata

---

## 7. Record visibility column

| `client_visibility` | Client API behaviour |
|-----------------------|---------------------|
| `adviser_only` | Never returned from `/api/messages` |
| `client_visible` | Returned when lifecycle delivered |
| `both` | Returned; includes thread with inbound replies |

**Lifecycle gate:** Even with `client_visible`, client query requires `lifecycle_status` IN (`sent`, `logged`, `received`).

---

## 8. Redaction rules summary

```text
Client API  → delivered messages only; no template/source internals
Adviser API → full workspace with previews; preference warnings as codes
Queue       → subject + generic summary; priority normal
List/360    → link + status text only
Audit       → full metadata in crm_communication_domain_events (assignment-scoped SELECT)
```

---

## 9. PII and safe text

| Field | Handling |
|-------|----------|
| `safe_subject` | Trimmed, max 200 chars |
| `safe_body` | Trimmed, max 8000 chars |
| Template variables | HTML-escaped on render |
| Provider errors | `toPublicErrorMessage` — no raw stack/provider text to client |

---

## 10. Cross-phase privacy boundaries

| Data domain | Visible in communications DTO? |
|-------------|-------------------------------|
| Advocacy score | **No** |
| Protection gap analysis | **No** |
| Ethnicity (client profile) | **No** — not used for targeting |
| Wealth segmentation | **No** |
| Promotions content | **No** — separate legacy surface |

---

## 11. RLS client-visible policy

Policy `crm_communication_records_client_visible` grants SELECT to owning client user when:

- `client_visibility` IN (`client_visible`, `both`)
- `lifecycle_status` IN (`sent`, `logged`, `received`)
- `client_id` matches `auth.uid()` via `clients.user_id`

Server APIs also enforce filters — defence in depth.

**Branch:** `crm-v2-10-communications`
