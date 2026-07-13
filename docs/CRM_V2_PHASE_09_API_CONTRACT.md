# CRM V2 Phase 09 — API Contract

**Namespace:** `/api/advisor-v2/relationships/[relationshipId]/advocacy` (adviser), `/api/preferences/advocacy` (client)  
**Cache:** All routes `dynamic = "force-dynamic"`, `Cache-Control: private, no-store`  
**Tracing:** `X-Request-Id` on every response

---

## 1. Feature gates

| Surface | Gate function | Required flags |
|---------|---------------|----------------|
| Adviser advocacy APIs | `assertCrmV2AdvocacyAccess()` | `crm_v2_master`, `crm_v2_pilot_mode`, pilot allowlist, `crm_v2_advocacy` |
| Client advocacy APIs | `assertCrmV2ClientAdvocacyAccess()` | `crm_v2_advocacy` (`enabled` + `client_visible`) |

**Single feature key:** `crm_v2_advocacy` — no separate client key.

---

## 2. Adviser — advocacy workspace

### GET `/api/advisor-v2/relationships/[relationshipId]/advocacy`

**Response 200:**

```json
{
  "ok": true,
  "workspace": {
    "relationshipId": "uuid",
    "summary": "AdviserAdvocacySummaryDto",
    "history": ["AdviserAdvocacyEventDto"],
    "introductions": ["AdviserAdvocacyEventDto"],
    "referrals": ["AdviserAdvocacyEventDto"],
    "testimonials": ["AdviserAdvocacyEventDto"],
    "followUpNeeded": ["AdviserAdvocacyEventDto"],
    "bounded": false
  }
}
```

**Errors:** 401, 403 (`feature_disabled` / `forbidden`), 404 (`not_found`)  
**Side effects:** None

---

### POST `/api/advisor-v2/relationships/[relationshipId]/advocacy`

**Body:** `CreateAdvocacyEventInput`

```json
{
  "eventType": "referral_received",
  "eventDate": "2026-07-13",
  "safeTitle": "Referral from client dinner",
  "notes": "Optional bounded note",
  "consentState": "not_required",
  "visibility": "adviser_only",
  "referredPersonLabel": "J. Lee",
  "hasContactDetails": false,
  "followUpStatus": "pending",
  "nextFollowUpDate": "2026-07-20",
  "linkedAppointmentId": null,
  "linkedServiceRequestId": null,
  "linkedRelationshipMomentId": null,
  "sourceType": "manual",
  "idempotencyKey": "optional-key"
}
```

**Response 201:** `{ "ok": true, "event": AdviserAdvocacyEventDto }`

**Validation:**

- `eventType` allowlisted
- `safeTitle` required, max 200 chars
- `introduction_offered` blocked when client `do_not_ask`
- Duplicate `idempotencyKey` returns existing event (200 semantics via idempotent create)

**Errors:** 400 validation, 403 forbidden, 404 not_found, 409 conflict

---

### GET `/api/advisor-v2/relationships/[relationshipId]/advocacy/summary`

**Response 200:**

```json
{
  "ok": true,
  "summary": "AdviserAdvocacySummaryDto",
  "yearlyScore": {
    "calendarYear": 2026,
    "totalPoints": 5,
    "eventCount": 3,
    "cappedScore": 5,
    "explanation": "Event-based score for 2026: 3 eligible events, 5 points after caps."
  }
}
```

---

### PATCH `/api/advisor-v2/relationships/[relationshipId]/advocacy/[eventId]`

**Body:** `UpdateAdvocacyEventInput`

```json
{
  "expectedVersion": 1,
  "safeTitle": "Updated title",
  "notes": null,
  "consentState": "granted",
  "visibility": "adviser_only",
  "followUpStatus": "completed",
  "nextFollowUpDate": null,
  "referredPersonLabel": "J. Lee"
}
```

**Response 200:** `{ "ok": true, "event": AdviserAdvocacyEventDto }`  
**Concurrency:** Stale `expectedVersion` → 409

---

### POST `/api/advisor-v2/relationships/[relationshipId]/advocacy/[eventId]/transition`

**Body:** `TransitionAdvocacyEventInput`

```json
{
  "expectedVersion": 1,
  "transition": "consent_granted",
  "idempotencyKey": "optional"
}
```

**Allowed transitions:** `deactivate`, `consent_granted`, `consent_withdrawn`, `thank_you_sent`

**Response 200:** `{ "ok": true, "event": AdviserAdvocacyEventDto }`

---

## 3. DTO reference — adviser

### `AdviserAdvocacyEventDto`

| Field | Type | Notes |
|-------|------|-------|
| `eventId` | string | UUID |
| `clientId` | string | |
| `eventType` | enum | Allowlisted |
| `eventDate` | string | ISO date |
| `safeTitle` | string | |
| `consentState` | enum | |
| `visibility` | enum | |
| `followUpStatus` | enum | |
| `nextFollowUpDate` | string \| null | |
| `referredPersonLabel` | string \| null | Adviser-only |
| `hasContactDetails` | boolean | |
| `labels` | string[] | UI badges |
| `linkedAppointmentId` | string \| null | |
| `linkedServiceRequestId` | string \| null | |
| `linkedRelationshipMomentId` | string \| null | |
| `active` | boolean | |
| `version` | number | |
| `createdAt`, `updatedAt` | string | ISO timestamps |

**Excluded:** `notes` (adviser PATCH only), raw `points`, `idempotency_key`

### `AdviserAdvocacySummaryDto`

| Field | Type |
|-------|------|
| `relationshipId` | string |
| `calendarYear` | number |
| `eventCount` | number |
| `yearlyScore` | number \| null |
| `scoreExplanation` | string \| null |
| `consentStatus` | enum |
| `doNotAsk` | boolean |
| `referralAskOptOut` | boolean |
| `permissionToMention` | boolean |
| `followUpDueCount` | number |

---

## 4. Client — advocacy preferences

### GET `/api/preferences/advocacy`

**Response 200:** `{ "ok": true, "preferences": ClientAdvocacyPreferencesDto }`

### PATCH `/api/preferences/advocacy`

**Body:** `UpdateClientAdvocacyPreferencesInput`

```json
{
  "expectedVersion": 1,
  "testimonialConsent": "granted",
  "referralAskOptOut": false,
  "permissionToMention": true,
  "doNotAsk": false
}
```

**Response 200:** `{ "ok": true, "preferences": ClientAdvocacyPreferencesDto }`  
**Errors:** 409 stale version, 400 validation

### POST `/api/preferences/advocacy/withdraw`

**Body:** `{ "expectedVersion": 1 }`

**Response 200:** `{ "ok": true, "preferences": ClientAdvocacyPreferencesDto }`

---

## 5. DTO reference — client

### `ClientAdvocacyPreferencesDto`

| Field | Type |
|-------|------|
| `testimonialConsent` | enum |
| `referralAskOptOut` | boolean |
| `permissionToMention` | boolean |
| `doNotAsk` | boolean |
| `safeAcknowledgementHistory` | `{ eventType, occurredAt, safeTitle }[]` |
| `version` | number |

**Excluded:** `yearlyScore`, advocacy event list, `notes`, referral labels

---

## 6. Common error envelope

```json
{
  "ok": false,
  "reason": "forbidden",
  "error": "Optional human-readable message"
}
```

| Status | `reason` values |
|--------|-----------------|
| 401 | `unauthenticated` |
| 403 | `forbidden`, `feature_disabled`, `pilot_not_eligible` |
| 404 | `not_found` |
| 409 | `conflict` |
| 400 | `validation` |
| 500 | `error` message (sanitized) |

---

## 7. Audit actions

| Action | Trigger |
|--------|---------|
| `crm_v2_advocacy_event_created` | POST event |
| `crm_v2_client_advocacy_preferences_updated` | Client PATCH/withdraw |

Domain events recorded in `advocacy_domain_events` separately.

---

## 8. Route file map

| Route | File |
|-------|------|
| `.../advocacy` GET/POST | `app/api/advisor-v2/relationships/[relationshipId]/advocacy/route.ts` |
| `.../advocacy/summary` GET | `app/api/advisor-v2/relationships/[relationshipId]/advocacy/summary/route.ts` |
| `.../advocacy/[eventId]` PATCH | `app/api/advisor-v2/relationships/[relationshipId]/advocacy/[eventId]/route.ts` |
| `.../advocacy/[eventId]/transition` POST | `app/api/advisor-v2/relationships/[relationshipId]/advocacy/[eventId]/transition/route.ts` |
| `/api/preferences/advocacy` GET/PATCH | `app/api/preferences/advocacy/route.ts` |
| `/api/preferences/advocacy/withdraw` POST | `app/api/preferences/advocacy/withdraw/route.ts` |
