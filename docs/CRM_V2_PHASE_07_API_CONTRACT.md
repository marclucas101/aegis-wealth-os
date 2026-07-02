# CRM V2 Phase 07 — API Contract

**Cache:** `private, no-store` on all routes  
**Request ID:** `X-Request-Id` header on all responses  
**Write rate limit:** `writeHeavy` bucket on POST mutations

---

## Feature gates

| Surface | Gate function | Required flags |
|---------|---------------|----------------|
| Adviser protection APIs | `assertCrmV2ProtectionPortfolioAccess()` | `crm_v2_master`, `crm_v2_pilot_mode`, pilot allowlist, `crm_v2_protection_portfolio` |
| Client protection GET | `assertCrmV2ClientProtectionAccess()` | `crm_v2_protection_portfolio` enabled + `client_visible` |
| Client correction/review POST | Above + `assertCrmV2ClientServiceAccess()` | `crm_v2_client_service` enabled + `client_visible` |

**Rejected on all routes:** browser-supplied `clientId`, `adviserUserId`, `client_id`, `adviser_user_id` in JSON body (`rejectUnexpectedFields`).

---

## Adviser APIs

### GET /api/advisor-v2/relationships/[relationshipId]/protection

Load adviser protection portfolio for assigned relationship.

**Auth:** `assertCrmV2ProtectionPortfolioAccess`

**Response 200:**

```json
{
  "ok": true,
  "portfolio": {
    "relationshipId": "uuid",
    "clientDisplayName": "string",
    "portfolioSummary": {
      "confirmedPolicyCount": 0,
      "provisionalExtractionCount": 0,
      "awaitingVerificationCount": 0,
      "missingSourceDocumentCount": 0,
      "pendingCorrectionRequestCount": 0,
      "lastPortfolioVerifiedAt": "ISO|null",
      "upcomingExpiryCount": 0
    },
    "policies": [ "AdviserProtectionPolicySummaryDto" ],
    "awaitingVerification": [ "AdviserProtectionExtractionSummaryDto" ],
    "missingDocuments": [ "AdviserProtectionPolicySummaryDto" ],
    "bounded": false
  }
}
```

**Errors:** 401 unauthenticated, 403 forbidden/feature_disabled, 404 not_found

---

### POST /api/advisor-v2/relationships/[relationshipId]/protection/extractions

Create provisional extractions from protection report JSON.

**Auth:** `assertCrmV2ProtectionPortfolioAccess` + rate limit

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `report` | `ProtectionReportInput` | Yes — must include `policies` array |
| `idempotencyKey` | string | No — defaults `report_{timestamp}` |
| `sourceDocumentId` | UUID | No — vault document link |

**Response 201:**

```json
{ "ok": true, "extractionIds": ["uuid"], "skipped": 0 }
```

**Errors:** 400 invalid payload, 404 relationship, 403 forbidden

---

### GET /api/advisor-v2/protection/extractions/[extractionId]

Load extraction detail for adviser review.

**Auth:** `assertCrmV2ProtectionPortfolioAccess`

**Response 200:**

```json
{
  "ok": true,
  "extraction": {
    "extractionId": "uuid",
    "relationshipId": "uuid",
    "reviewStatus": "provisional",
    "reviewStatusLabel": "Provisional",
    "extractionMethod": "protection_report",
    "extractedFields": { },
    "confidenceWarnings": ["string"],
    "duplicateCandidatePolicyIds": ["uuid"],
    "sourceDocumentId": "uuid|null",
    "sourceDocumentTitle": "string|null",
    "sourceDocumentAvailable": true,
    "resultingPolicyId": "uuid|null",
    "resultingVersionId": "uuid|null",
    "version": 1,
    "createdAt": "ISO",
    "reviewedAt": "ISO|null",
    "rejectionReason": "string|null"
  }
}
```

**Errors:** 404 not_found, 403 forbidden

---

### POST /api/advisor-v2/protection/extractions/[extractionId]/confirm

Confirm extraction — creates or updates policy + version.

**Auth:** `assertCrmV2ProtectionPortfolioAccess` + rate limit

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `expectedVersion` | number ≥1 | Yes |
| `matchPolicyId` | UUID | No — link to existing policy |
| `correctionReason` | string ≤500 | No |

**Response 200:**

```json
{ "ok": true, "policyId": "uuid", "versionId": "uuid" }
```

**Errors:** 409 conflict (stale version), 400 validation, 404 not_found

---

### POST /api/advisor-v2/protection/extractions/[extractionId]/correct

Confirm with adviser field corrections.

**Auth:** Same as confirm

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `expectedVersion` | number | Yes |
| `correctedFields` | `Partial<AdviserProtectionExtractedFieldsDto>` | Yes |
| `matchPolicyId` | UUID | No |
| `correctionReason` | string | No — defaults "Adviser correction" |

**Response 200:** Same as confirm; version state `corrected`

---

### POST /api/advisor-v2/protection/extractions/[extractionId]/reject

Reject extraction — does not create policy.

**Auth:** `assertCrmV2ProtectionPortfolioAccess` + rate limit

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `expectedVersion` | number | Yes |
| `rejectionReason` | string | Yes — non-empty |

**Response 200:**

```json
{ "ok": true, "extractionId": "uuid" }
```

**Errors:** 409 conflict, 400 invalid transition

---

### GET /api/advisor-v2/protection/policies/[policyId]

Load adviser policy detail with current confirmed version.

**Auth:** `assertCrmV2ProtectionPortfolioAccess`

**Response 200:**

```json
{
  "ok": true,
  "policy": {
    "policyId": "uuid",
    "relationshipId": "uuid",
    "insurer": "string",
    "displayName": "string",
    "policyCategory": "term_life",
    "policyCategoryLabel": "term life",
    "policyOwner": "string",
    "lifeAssured": "string",
    "policyStatus": "in_force",
    "policyStatusLabel": "in force",
    "policyRefMasked": "***1234|null",
    "policyStartDate": "date|null",
    "maturityOrExpiryDate": "date|null",
    "sourceDocumentId": "uuid|null",
    "sourceDocumentTitle": "string|null",
    "sourceDocumentAvailable": true,
    "currentConfirmedVersion": "AdviserProtectionVersionDto|null",
    "version": 1
  }
}
```

---

### GET /api/advisor-v2/protection/policies/[policyId]/versions

List version history for policy (includes superseded).

**Auth:** `assertCrmV2ProtectionPortfolioAccess`

**Response 200:**

```json
{
  "ok": true,
  "versions": [ "AdviserProtectionVersionDto" ],
  "bounded": false
}
```

---

## Client APIs

### GET /api/protection

Client protection portfolio — confirmed policies only.

**Auth:** `assertCrmV2ClientProtectionAccess`

**Response 200:**

```json
{
  "ok": true,
  "portfolio": {
    "policies": [ "ClientProtectionPolicySummaryDto" ],
    "lastPortfolioVerifiedAt": "ISO|null",
    "bounded": false
  }
}
```

---

### GET /api/protection/[policyId]

Client policy detail — confirmed/corrected only.

**Auth:** `assertCrmV2ClientProtectionAccess`

**Response 200:** `{ "ok": true, "policy": ClientProtectionPolicyDetailDto }`

**404:** Policy missing, wrong client, or version not portfolio-eligible

---

### POST /api/protection/[policyId]/correction-request

Submit correction via service request.

**Auth:** `assertCrmV2ClientProtectionAccess` + `assertCrmV2ClientServiceAccess` + rate limit

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `category` | allowlisted correction category | Yes |
| `explanation` | string 1–2000 | Yes |
| `supportingDocumentId` | UUID | No |
| `idempotencyKey` | string | No |

**Response 201:** `{ "ok": true, "requestId": "uuid" }`

**400:** Invalid category, missing explanation, no adviser assigned

---

### POST /api/protection/review-request

Request portfolio review via service request.

**Auth:** Same dual gate as correction

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `explanation` | string | No — default message used |
| `idempotencyKey` | string | No |

**Response 201:** `{ "ok": true, "requestId": "uuid" }`

---

## Legacy API (unchanged, related)

### POST /api/advisor/clients/[clientId]/documents/save-protection-report

Saves protection report PDF to vault. **Not gated** by `crm_v2_protection_portfolio`.

Multipart form: `file` (PDF), `metadata` (JSON).

**Response:** `{ "ok": true, "document": { "id", "file_name", ... } }`

Does not create `protection_extractions`.

---

## DTO type reference

Types defined in `lib/crm-v2/protection/types.ts`:

- `AdviserProtectionPortfolioDto`
- `AdviserProtectionPolicySummaryDto`
- `AdviserProtectionPolicyDetailDto`
- `AdviserProtectionExtractionSummaryDto`
- `AdviserProtectionExtractionDetailDto`
- `AdviserProtectionVersionDto`
- `AdviserProtectionExtractedFieldsDto`
- `ClientProtectionPortfolioDto`
- `ClientProtectionPolicySummaryDto`
- `ClientProtectionPolicyDetailDto`

Allowlists:

- `CRM_PROTECTION_POLICY_CATEGORIES`
- `CRM_PROTECTION_POLICY_STATUSES`
- `CRM_PROTECTION_PREMIUM_FREQUENCIES`
- `CRM_PROTECTION_COVERAGE_CATEGORIES`
- `CRM_PROTECTION_CORRECTION_CATEGORIES`

---

## HTTP status summary

| Status | When |
|--------|------|
| 200 | Successful GET / confirm / reject |
| 201 | Created extractions / service request |
| 400 | Validation, invalid JSON, unexpected fields |
| 401 | Unauthenticated |
| 403 | Forbidden, feature_disabled |
| 404 | not_found (assignment-scoped) |
| 409 | Optimistic version conflict |
| 429 | Rate limit (writeHeavy) |
| 500 | Unhandled server error (sanitised message) |

---

## Security notes

- All adviser routes resolve client via `relationshipId` or extraction/policy FK + `resolveAccessibleClient`
- GET routes perform no writes
- No storage paths in any DTO
- HTML stripped from text fields via `sanitizeText` in service layer

---

## Cross-references

- Security: `docs/CRM_V2_PHASE_07_SECURITY_REVIEW.md`
- Privacy: `docs/CRM_V2_PHASE_07_VISIBILITY_AND_PRIVACY.md`
- Client UX: `docs/CRM_V2_PHASE_07_CLIENT_PROTECTION_SUMMARY.md`
