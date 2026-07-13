# CRM V2 Phase 09 — Client Advocacy Preferences

**Route:** `/preferences/advocacy` (client portal)  
**API:** `/api/preferences/advocacy`, `/api/preferences/advocacy/withdraw`  
**Feature key:** `crm_v2_advocacy` — **single key** for both adviser and client surfaces

---

## 1. Feature gate

`assertCrmV2ClientAdvocacyAccess()` in `lib/crm-v2/access.ts`:

```text
ensureUserClientProfile()
  → role === client
  → platform_feature_controls row for crm_v2_advocacy
  → enabled === true
  → client_visible === true
```

| Check | Result if failed |
|-------|------------------|
| Unauthenticated | 401 |
| Non-client role | 403 `forbidden` |
| Flag disabled or `client_visible = false` | 403 `feature_disabled` |

**Important:** There is no `crm_v2_client_advocacy` separate key. Client advocacy preferences share `crm_v2_advocacy` with the adviser workspace.

**Client gate does not require:** `crm_v2_master`, `crm_v2_pilot_mode`, or pilot allowlist (same pattern as `crm_v2_client_profile`).

---

## 2. Data authority

| Store | Role |
|-------|------|
| `crm_client_advocacy_preferences` | SOT for client consent aggregate |
| `advocacy_domain_events` | Immutable acknowledgement history (safe subset exposed) |
| `adviser_feedback` | Separate SOT for structured feedback — not replaced |

Lazy create: first PATCH upserts preference row with `version = 1`.

---

## 3. Client DTO

`ClientAdvocacyPreferencesDto`:

```json
{
  "testimonialConsent": "unknown",
  "referralAskOptOut": false,
  "permissionToMention": false,
  "doNotAsk": false,
  "safeAcknowledgementHistory": [
    {
      "eventType": "consent_granted",
      "occurredAt": "2026-07-01T10:00:00.000Z",
      "safeTitle": "Testimonial consent granted"
    }
  ],
  "version": 1
}
```

History is capped at 20 domain events of types: `consent_granted`, `consent_withdrawn`, `testimonial_permission_updated`, `do_not_ask_recorded`.

---

## 4. API operations

### GET `/api/preferences/advocacy`

Returns current preferences. No side effects.

### PATCH `/api/preferences/advocacy`

**Body:** `UpdateClientAdvocacyPreferencesInput`

```json
{
  "expectedVersion": 1,
  "testimonialConsent": "granted",
  "referralAskOptOut": false,
  "permissionToMention": true,
  "doNotAsk": false,
  "idempotencyKey": "optional"
}
```

**Concurrency:** Stale `expectedVersion` → 409 `conflict`

**Side effects:** Domain event, optional notifications, audit log

### POST `/api/preferences/advocacy/withdraw`

**Body:** `{ "expectedVersion": 1 }`

Shortcut for withdraw: sets `testimonialConsent = withdrawn`, `permissionToMention = false`.

---

## 5. UI route

| Path | Component (when implemented) | Gate |
|------|------------------------------|------|
| `/preferences/advocacy` | Client advocacy preferences panel | `crm_v2_advocacy` + `client_visible` |

Href builder: `buildClientAdvocacyPreferencesHref()` → `/preferences/advocacy`

Distinct from Phase 08 `/preferences` (profile/ethnicity) which uses `crm_v2_client_profile`. Both may coexist; advocacy section is additive under advocacy flag.

---

## 6. Adviser visibility of client choices

Adviser workspace summary reflects client preferences:

- `consentStatus` ← `testimonial_consent`
- `doNotAsk`, `referralAskOptOut`, `permissionToMention`

Adviser cannot PATCH client preferences via adviser APIs — client-owned writes only.

---

## 7. RLS

`crm_client_advocacy_preferences_assignment` policy:

- SELECT/INSERT/UPDATE: assigned adviser, admin, or owning client (`clients.user_id = auth.uid()`)

---

## 8. Privacy summary

| Field | Client | Adviser | Public |
|-------|--------|---------|--------|
| `testimonialConsent` | Read/write | Read (summary) | No |
| `referralAskOptOut` | Read/write | Read | No |
| `permissionToMention` | Read/write | Read | No |
| `doNotAsk` | Read/write | Read | No |
| `yearlyScore` | **No** | Yes (workspace) | No |
| Event notes | **No** | Yes | No |

---

## 9. Failure modes

| Scenario | Behaviour |
|----------|-----------|
| Flag off | 403 — no preference data loaded |
| `client_visible` false while `enabled` true | 403 for client; adviser may still access if adviser gate passes |
| Version conflict | 409 — client must refresh and retry |
| Invalid consent enum | 400 validation |
