# CRM V2 Phase 07 — Client Protection Summary

**Feature key:** `crm_v2_protection_portfolio` (same key as adviser — `client_visible` must be true)  
**Principle:** Clients see only adviser-confirmed or adviser-corrected policy versions. No provisional data, no extraction queue, no internal adviser notes.

---

## 1. Routes

| Route | Component | Gate |
|-------|-----------|------|
| `/protection` | `app/protection/page.tsx` → `ClientProtectionClient.tsx` | `assertCrmV2ClientProtectionAccess` |
| `/protection/[policyId]` | Policy detail view (embedded in client component) | Same + policy ownership |

**Not client routes:**

- `/advisor-v2/relationships/[id]/protection` — adviser only
- `/advisor/protection-report` — adviser only

---

## 2. Access gate

`assertCrmV2ClientProtectionAccess()` in `lib/crm-v2/access.ts`:

1. User authenticated with role `client`
2. Load `platform_feature_controls` for `crm_v2_protection_portfolio`
3. Require `enabled = true` AND `client_visible = true`
4. Return session-derived `client` row — **no** `clientId` from request body

**Separate gate for write actions:**

- Correction and review requests also require `assertCrmV2ClientServiceAccess()` (`crm_v2_client_service`) because they create `client_service_requests`.

---

## 3. API endpoints

| Method | Path | Loader |
|--------|------|--------|
| GET | `/api/protection` | `loadClientProtectionPortfolio` |
| GET | `/api/protection/[policyId]` | `getClientProtectionPolicyDetail` |
| POST | `/api/protection/[policyId]/correction-request` | `createClientProtectionCorrectionRequest` |
| POST | `/api/protection/review-request` | `createClientProtectionReviewRequest` |

All GET responses: `Cache-Control: private, no-store`, `X-Request-Id` header.

---

## 4. Confirmed-only filter (critical)

`loadClientProtectionPortfolio()`:

```typescript
// Load current_confirmed_version_id for each policy
.from("protection_policy_versions")
.in("id", versionIds)
.in("verification_state", ["confirmed", "corrected"])
```

Policies without eligible current version are **omitted** from client list (not shown as "pending").

`getClientProtectionPolicyDetail()`:

```typescript
if (!version || !isPortfolioEligibleState(version.verification_state)) {
  return { ok: false, reason: "not_found" };
}
```

Returns 404 for unconfirmed policies — prevents IDOR enumeration signal difference minimised via uniform not_found.

---

## 5. Client DTOs

### 5.1 `ClientProtectionPortfolioDto`

| Field | Description |
|-------|-------------|
| `policies` | `ClientProtectionPolicySummaryDto[]` |
| `lastPortfolioVerifiedAt` | Max `confirmed_at` across visible policies |
| `bounded` | True if > `CRM_V2_PROTECTION_MAX_POLICIES` |

### 5.2 `ClientProtectionPolicySummaryDto`

| Field | Exposed | Notes |
|-------|---------|-------|
| `policyId` | Yes | UUID |
| `insurer` | Yes | |
| `displayName` | Yes | |
| `policyCategoryLabel` | Yes | Human label only |
| `policyOwner` | Yes | |
| `lifeAssured` | Yes | |
| `policyStatusLabel` | Yes | |
| `coverageSummary` | Yes | Aggregated category labels |
| `premium` | Yes | From confirmed version |
| `premiumFrequencyLabel` | Yes | |
| `lastVerifiedAt` | Yes | `confirmed_at` |
| `sourceDocumentAvailable` | Yes | Boolean — not document ID |
| `detailHref` | Yes | `/protection/{policyId}` |

**Excluded from client DTOs:**

- `policyRefMasked` (even masked ref hidden on client summary list — detail may omit)
- `verificationState` raw enum
- `extractionId`, `confidenceWarnings`
- `duplicateCandidatePolicyIds`
- `sourceDocumentId`, storage paths, filenames
- `adviser_reviewer_id`
- `structured_snapshot`, `version_hash`
- Internal stale flags

### 5.3 `ClientProtectionPolicyDetailDto`

| Field | Description |
|-------|-------------|
| `coverageComponents` | Client-safe shape: `categoryLabel`, `amountLabel`, `durationLabel` |
| `policyTerm` | From version |
| `correctionRequestHref` | `/protection/{id}?action=correction` |
| Premium fields | Same as summary |

Amount labels formatted: `{currency} {amount.toLocaleString()}` or "On file".

---

## 6. UI behavior (`ClientProtectionClient.tsx`)

Expected UX contract:

- Empty state when no confirmed policies — friendly message, not error
- Portfolio-level `lastPortfolioVerifiedAt` displayed when available
- Link to request portfolio review (POST review-request)
- Per-policy correction action when detail open
- No adviser workflow controls (confirm/reject)
- No provisional badge
- Mobile-responsive layout consistent with client portal shell

---

## 7. Client correction flow

```text
Client opens policy detail → correction form
  → POST /api/protection/[policyId]/correction-request
  → createClientProtectionCorrectionRequest()
  → createClientServiceRequest({ category: "protection_correction", ... })
  → Adviser sees request in Service workspace (Phase 06)
```

**Categories** (`CRM_PROTECTION_CORRECTION_CATEGORIES`):

- Allowlisted enum validated at API boundary
- Examples: premium mismatch, coverage mismatch, policy status, personal details, other

**Body fields:**

| Field | Required |
|-------|----------|
| `category` | Yes |
| `explanation` | Yes, ≤2000 chars |
| `supportingDocumentId` | No — vault document UUID if client uploads evidence |
| `idempotencyKey` | Recommended |

Protection policy rows are **not** mutated by this POST.

---

## 8. Client review request flow

```text
POST /api/protection/review-request
  → createClientProtectionReviewRequest()
  → client_service_requests category protection_review
```

Default explanation if omitted: "Client requested protection portfolio review".

Requires assigned `advisor_user_id` on client row.

---

## 9. Relationship to document vault

Clients may still view protection summary **PDFs** in vault (tag `protection_portfolio_summary`) independently of structured portfolio.

Structured `/protection` route is additive — does not replace vault navigation.

`sourceDocumentAvailable: true` indicates linked vault doc exists without exposing ID in list DTO.

---

## 10. Feature disabled behavior

When `crm_v2_protection_portfolio` disabled or `client_visible = false`:

- `/protection` page shows feature unavailable (or redirect per shell pattern)
- API returns 403 `feature_disabled`
- Vault PDFs remain visible if uploaded under legacy paths

---

## 11. Privacy summary

| Data class | Client can see |
|------------|----------------|
| Confirmed coverage amounts | Yes (formatted) |
| Masked policy ref | No (Phase 07 client DTO) |
| Full policy number | Never |
| Extraction warnings | Never |
| Adviser correction reason | No |
| Rejected extractions | Never |
| Superseded version history | Never |

See `docs/CRM_V2_PHASE_07_VISIBILITY_AND_PRIVACY.md`.

---

## 12. Error handling

| Condition | HTTP | Client message |
|-----------|------|----------------|
| Unauthenticated | 401 | Standard auth |
| Not client role | 403 | Forbidden |
| Feature off | 403 | feature_disabled |
| Policy not found / unconfirmed | 404 | not_found |
| No adviser assigned | 400 | Adviser not assigned |

---

## 13. Caching and polling

- `dynamic = "force-dynamic"` on API routes
- No client-side polling loops in specification
- Refresh on navigation/focus only

---

## 14. Navigation integration

Client shell should link to `/protection` when:

- `crm_v2_protection_portfolio` enabled
- `client_visible = true`

No separate `crm_v2_client_protection` flag exists.

---

## 15. Testing checklist references

Manual tests 2, 4, 12, 13, 31–33 in `docs/CRM_V2_PHASE_07_MANUAL_TESTS.md`.

---

## 16. Cross-references

- API contract: `docs/CRM_V2_PHASE_07_API_CONTRACT.md`
- Service integration: `docs/CRM_V2_PHASE_07_SERVICE_AND_WORK_QUEUE_INTEGRATION.md`
- Architecture: `docs/CRM_V2_PHASE_07_PROTECTION_ARCHITECTURE.md`
