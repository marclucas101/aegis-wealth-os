# CRM V2 Phase 08 — Client Preferences

**Feature key:** `crm_v2_client_profile`  
**Routes:** `/preferences` (client UI), `/api/preferences` (API)  
**Gate:** `assertCrmV2ClientProfileAccess()` in `lib/crm-v2/access.ts`

---

## 1. Purpose

Provide a safe client portal surface for relationship preferences: important dates visibility, acknowledgement opt-outs, greeting preferences, ethnicity self-identification (festive-only use), and review requests — without granting client access to adviser CRM V2.

---

## 2. Feature control

Seeded in `supabase/migrations/202606290012_phase08_crm_v2_relationship_moments_feature_control.sql`:

| Key | enabled | client_visible | adviser_visible |
|-----|---------|----------------|-----------------|
| `crm_v2_client_profile` | false | **true** | false |

TypeScript: `CRM_V2_CLIENT_PROFILE_FEATURE_KEY` in `lib/crm-v2/constants.ts`, `FEATURE_DEFAULTS` in `lib/compliance/featureFlags.ts`.

**Gate logic:**

```text
ensureUserClientProfile() — authenticated client session
  → role === client
  → crm_v2_client_profile.enabled AND client_visible
```

**Does not require** `crm_v2_master` or pilot allowlist — client portal is independent of adviser V2 shell gates.

**Important:** `crm_v2_client_profile` enabled does **not** grant adviser CRM access. Adviser moments require separate `crm_v2_relationship_moments` + master + pilot.

---

## 3. Client UI

| Item | Detail |
|------|--------|
| Route | `/preferences` |
| Page | `app/preferences/page.tsx` |
| Component | `components/aegis/client/ClientPreferencesClient.tsx` |
| Href helper | `buildClientPreferencesHref()` in `lib/crm-v2/moments/routes.ts` |

**UI capabilities (implemented):**

- View important dates (client-visible moments)
- Opt out of birthday acknowledgement
- Opt out of festive acknowledgement
- Greeting preference selection
- Ethnicity self-identification (allowlisted values)
- Request a review (links to review-request API)
- Pending updates count badge

---

## 4. API contract

### GET `/api/preferences`

**Auth:** Client session + `crm_v2_client_profile`

**Response:**

```json
{
  "ok": true,
  "preferences": {
    "importantDates": [{ "label": "...", "date": "YYYY-MM-DD", "confirmed": true }],
    "birthdayAcknowledgementOptOut": false,
    "festiveAcknowledgementOptOut": false,
    "greetingPreference": null,
    "ethnicity": "chinese",
    "pendingUpdates": 0
  }
}
```

**Loader:** `loadClientRelationshipPreferences()` — reads `clients.date_of_birth`, `clients.ethnicity`, client-visible active moments, pending `crm_client_preference_updates` count.

**Excluded:** `sensitivity_class`, adviser notes, festive suggestion internals, review rhythm adviser fields.

### PATCH `/api/preferences`

**Body:** `ClientPreferenceUpdateInput`

```json
{
  "preferenceType": "ethnicity_correction",
  "proposedValue": { "ethnicity": "malay" },
  "idempotencyKey": "optional-uuid"
}
```

**Allowlisted `preferenceType` values:**

- `important_date`
- `birthday_acknowledgement_opt_out`
- `festive_acknowledgement_opt_out`
- `greeting_preference`
- `communication_preference`
- `ethnicity_correction`
- `review_request`

**Behaviour:** Inserts `crm_client_preference_updates` row (`status: pending_review`). Does not mutate `clients` directly. Idempotent on `(client_id, idempotency_key)` for pending rows.

**Side effects:** `relationship_moment_events` (`client_preference_submitted`), in-app notification via `notifyClientPreferenceUpdateSubmitted`.

### POST `/api/preferences/review-request`

**Body:** `{ "idempotencyKey"?: string }`

**Behaviour:** Creates `client_service_requests` with `request_category = review_request` via `createClientServiceRequest()` (Phase 06). Requires `crm_v2_client_service` for service request write authority.

**Side effects:** `notifyClientRequestedReview`, domain event `review_requested`.

---

## 5. Pending review model

Table: `crm_client_preference_updates`

| Column | Purpose |
|--------|---------|
| `preference_type` | Allowlisted type |
| `proposed_value` | JSONB payload |
| `previous_value` | Optional snapshot |
| `status` | `pending_review`, `approved`, `rejected` |
| `reviewed_by_user_id` | Set on adviser approval (future UI) |

Adviser sees pending count in moments workspace `data_quality` warnings and Client Preferences view. Work-queue `clientPreferenceUpdateAdapter` surfaces pending items.

---

## 6. Ethnicity on client surface

- Client may view and propose ethnicity correction
- Stored value on `clients.ethnicity` only after adviser approval workflow
- `prefer_not_to_say` valid — suppresses festive suggestions server-side
- Ethnicity never shown in generic client notifications text

See `docs/CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md`.

---

## 7. Dependencies

| Dependency | Required for |
|------------|--------------|
| `crm_v2_client_profile` | `/preferences` read/write |
| `crm_v2_client_service` | Review request POST (service request creation) |
| Phase 08 core migration `202606290013` | `crm_client_preference_updates` table, `clients.ethnicity` column |
| `client_service_requests` (Phase 06) | Review request category extension |

---

## 8. Error responses

| Condition | Status | reason |
|-----------|--------|--------|
| Unauthenticated | 401 | `unauthenticated` |
| Non-client role | 403 | `forbidden` |
| Flag off | 403 | `feature_disabled` |
| Invalid preference type | 400 | validation |
| Duplicate idempotency | 200/409 | returns existing `updateId` when pending |

All responses include `X-Request-Id` and `Cache-Control: private, no-store`.

---

## 9. Relationship to adviser moments

| Client action | Adviser surface |
|---------------|-----------------|
| Preference PATCH | Moments workspace → Client Preferences view |
| Review request POST | Service workspace → Client Requests + moments data quality |
| Opt-out flags | Adviser sees in preferences projection; affects acknowledgement UX (future) |

Adviser moments workspace is gated by `crm_v2_relationship_moments` — separate from client profile flag.
