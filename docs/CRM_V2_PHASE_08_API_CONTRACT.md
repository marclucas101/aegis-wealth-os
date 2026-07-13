# CRM V2 Phase 08 — API Contract

**Namespace:** `/api/advisor-v2/relationships/[relationshipId]/...` (adviser), `/api/preferences` (client)  
**Cache:** All routes `dynamic = "force-dynamic"`, `Cache-Control: private, no-store`  
**Tracing:** `X-Request-Id` on every response

---

## 1. Feature gates

| Surface | Gate function | Required flags |
|---------|---------------|----------------|
| Adviser moments APIs | `assertCrmV2RelationshipMomentsAccess()` | `crm_v2_master`, `crm_v2_pilot_mode`, pilot allowlist, `crm_v2_relationship_moments` |
| Client preferences APIs | `assertCrmV2ClientProfileAccess()` | `crm_v2_client_profile` (enabled + `client_visible`) |
| Review request POST | `assertCrmV2ClientProfileAccess()` + service layer | Above + `crm_v2_client_service` for `createClientServiceRequest` |

---

## 2. Adviser — moments workspace

### GET `/api/advisor-v2/relationships/[relationshipId]/moments`

**Response 200:**

```json
{
  "ok": true,
  "workspace": {
    "relationshipId": "uuid",
    "upcomingMoments": [ "AdviserRelationshipMomentDto" ],
    "importantDates": [ "AdviserRelationshipMomentDto" ],
    "reviewRhythm": [ "AdviserReviewRhythmDto" ],
    "clientPreferences": [ "ClientSafePreferenceDto" ],
    "festiveSuggestions": [ "AdviserFestiveSuggestionDto" ],
    "pastAcknowledgements": [ "AdviserRelationshipMomentDto" ],
    "dataQualityWarnings": [ "string" ],
    "bounded": false
  }
}
```

**Errors:** 401 unauthenticated, 403 forbidden/feature_disabled, 404 not_found

**Side effects:** None (GET performs no writes)

---

### POST `/api/advisor-v2/relationships/[relationshipId]/moments`

**Body:** `CreateMomentInput`

```json
{
  "momentType": "custom_adviser_reminder",
  "title": "Follow up on relocation",
  "momentDate": "2026-08-01",
  "timezone": "Asia/Singapore",
  "visibility": "adviser_only",
  "reminderPreference": "in_app",
  "idempotencyKey": "optional-key"
}
```

**Response 201:** `{ "ok": true, "moment": AdviserRelationshipMomentDto }`

**Validation:**

- `momentType` must be allowlisted
- `title` required, max 200 chars (sanitized)
- `idempotencyKey` duplicate returns 200 with existing moment (idempotent)

**Errors:** 400 validation, 409 conflict (version), 404/403 assignment

---

### PATCH `/api/advisor-v2/relationships/[relationshipId]/moments/[momentId]`

**Body:** `UpdateMomentInput`

```json
{
  "title": "Updated title",
  "momentDate": "2026-08-15",
  "visibility": "both",
  "reminderPreference": "none",
  "expectedVersion": 1
}
```

**Response 200:** `{ "ok": true, "moment": AdviserRelationshipMomentDto }`

**Concurrency:** `expectedVersion` required; stale → 409 `conflict`

---

### POST `/api/advisor-v2/relationships/[relationshipId]/moments/[momentId]/acknowledge`

**Body:** none

**Response 200:** `{ "ok": true, "moment": AdviserRelationshipMomentDto }`

**Rules:** Active moment; not `rejected`. Sets `last_acknowledged_at`. Idempotent within acknowledgement window per `isIdempotentAcknowledgement`.

---

### POST `/api/advisor-v2/relationships/[relationshipId]/moments/[momentId]/deactivate`

**Body:**

```json
{ "expectedVersion": 2 }
```

**Response 200:** `{ "ok": true, "momentId": "uuid" }`

**Behaviour:** Soft deactivate (`active = false`, `deactivated_at` set). Requires matching version.

---

## 3. Adviser — review rhythm

### GET `/api/advisor-v2/relationships/[relationshipId]/review-rhythm`

**Response 200:** `{ "ok": true, "reviewRhythm": [ AdviserReviewRhythmDto ] }`

Subset of full workspace — review rhythm rows only.

### PATCH `/api/advisor-v2/relationships/[relationshipId]/review-rhythm`

**Body:** `UpdateReviewRhythmInput`

```json
{
  "cadence": "annual",
  "nextDueDate": "2027-01-15",
  "lastCompletedDate": "2026-01-10",
  "status": "scheduled",
  "clientVisibility": false,
  "expectedVersion": 1
}
```

**Response 200:** `{ "ok": true, "reviewRhythm": AdviserReviewRhythmDto }`

**Lazy create:** First PATCH without existing `annual_review` row creates from `clients.next_review_due` / `last_review_at`.

---

## 4. Client — preferences

### GET `/api/preferences`

**Response 200:** `{ "ok": true, "preferences": ClientRelationshipPreferencesDto }`

### PATCH `/api/preferences`

**Body:** `ClientPreferenceUpdateInput`

```json
{
  "preferenceType": "greeting_preference",
  "proposedValue": { "style": "formal" },
  "idempotencyKey": "pref-001"
}
```

**Response 200:** `{ "ok": true, "updateId": "uuid" }`

### POST `/api/preferences/review-request`

**Body:** `{ "idempotencyKey"?: string }`

**Response 201:** `{ "ok": true, "requestId": "uuid" }` (service request id)

---

## 5. DTO reference

Types in `lib/crm-v2/moments/types.ts`:

### AdviserRelationshipMomentDto

| Field | Type | Notes |
|-------|------|-------|
| momentId | string | UUID |
| momentType | CrmMomentType | allowlisted |
| title | string | max 200 |
| momentDate | string \| null | ISO date |
| nextOccurrenceDate | string \| null | ISO date |
| visibility | CrmMomentVisibility | |
| confirmationState | CrmMomentConfirmationState | |
| sensitivityClass | CrmMomentSensitivityClass | adviser only |
| labels | AdviserMomentLabel[] | UI chips |
| version | number | optimistic concurrency |
| holidayKey | string \| null | festive moments |

### AdviserFestiveSuggestionDto

| Field | Type |
|-------|------|
| holidayKey | string |
| displayName | string |
| suggestedDate | string \| null |
| confirmationState | `"suggested"` |
| overrideAction | `include` \| `exclude` \| null |
| labels | includes `sensitive_use_restricted` |

### AdviserReviewRhythmDto

| Field | Type |
|-------|------|
| reviewRhythmId | string |
| reviewType | CrmReviewType |
| cadence | CrmReviewCadence |
| nextDueDate | string \| null |
| status | CrmReviewStatus |
| clientVisibility | boolean |
| version | number |

### ClientRelationshipPreferencesDto

| Field | Type | Client-visible |
|-------|------|----------------|
| importantDates | array | yes |
| birthdayAcknowledgementOptOut | boolean | yes |
| festiveAcknowledgementOptOut | boolean | yes |
| greetingPreference | string \| null | yes |
| ethnicity | CrmClientEthnicity \| null | yes |
| pendingUpdates | number | yes |

**Never in client DTO:** `sensitivity_class`, adviser_user_id, internal source ids, queue metadata.

---

## 6. Standard error envelope

```json
{
  "ok": false,
  "reason": "feature_disabled",
  "error": "optional human message"
}
```

| reason | Typical status |
|--------|----------------|
| unauthenticated | 401 |
| forbidden | 403 |
| feature_disabled | 403 |
| not_found | 404 |
| validation | 400 |
| conflict | 409 |

Public error messages via `toPublicErrorMessage()` — no stack traces.

---

## 7. Rejected request patterns

| Pattern | Response |
|---------|----------|
| Browser-supplied `clientId` in body | Ignored/rejected — resolved from session or route |
| Browser-supplied `adviserUserId` | Rejected |
| Client session on adviser moments API | 403 |
| Adviser session on `/api/preferences` | 403 |
| Unexpected JSON fields | Stripped or rejected per route validation |

---

## 8. Audit

Writes emit:

- `relationship_moment_events` (domain events, safe metadata)
- `writeAuditLog` for moment create (`crm_moment_created`)

Event metadata excludes ethnicity, full client PII, and policy financials.
