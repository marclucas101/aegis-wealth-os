# CRM V2 Phase 07 — Visibility and Privacy

**Scope:** DTO field exposure, policy number masking, document path exclusion, adviser vs client surfaces.

---

## 1. Design principles

1. **Minimum necessary disclosure** — clients see confirmed coverage summaries, not extraction machinery.
2. **No storage paths** — Supabase storage keys never appear in API JSON.
3. **Masked policy identifiers** — full policy numbers never stored unmasked or returned in ordinary DTOs.
4. **Separate DTO types** — adviser and client types in `lib/crm-v2/protection/types.ts`; no shared "god object".
5. **Boolean document signals** — `sourceDocumentAvailable` replaces document IDs on client list views.

---

## 2. Policy number masking

**Function:** `maskPolicyNumber()` in `lib/crm-v2/protection/deduplication.ts`

| Input | Stored / displayed |
|-------|-------------------|
| Empty | `null` |
| ≤4 chars | `***{full}` |
| Longer | `***{last4}` |

**Application points:**

- Report mapper masks on extraction create
- Confirm/correct re-masks if `correctedFields.policyRefMasked` supplied
- `protection_policies.policy_ref_masked` column max 32 chars
- Deduplication compares normalized masked values only

**Never exposed:**

- Full policy number in client DTOs
- Full policy number in `protection_domain_events.safe_metadata`
- Full policy number in work queue summaries

**Adviser DTO:** `policyRefMasked` may appear on adviser policy summary/detail for verification context — still masked format only.

---

## 3. Document vault privacy

| Field | Adviser API | Client API |
|-------|-------------|------------|
| `sourceDocumentId` | Yes (detail) | **No** |
| `sourceDocumentTitle` | Yes (title only) | **No** |
| `sourceDocumentAvailable` | Yes | Yes (boolean) |
| Storage path | Never | Never |
| `file_name` | Never in protection DTOs | Never |
| Bucket key | Never | Never |

Vault upload route returns document metadata to adviser save flow only — protection portfolio APIs do not echo `storage_path` or signed URLs in JSON.

**Supporting document on correction request:** `supportingDocumentId` accepted in POST body but not echoed back in GET portfolio responses.

---

## 4. Adviser-only fields

The following appear in adviser DTOs only:

| Field | Reason |
|-------|--------|
| `verificationState` / `verificationStateLabel` | Internal workflow |
| `confidenceWarnings` | Extraction quality signals |
| `duplicateCandidatePolicyIds` | Dedup decision support |
| `extractionId`, `extractionMethod` | Review queue |
| `hasProvisionalExtraction` | Workflow badge |
| `isStale` | Adviser servicing signal |
| `workflowHref` | Internal navigation |
| `correctionReason` on version | Adviser audit |
| `supersededAt` | Version history |
| `structured_snapshot` | DB only — not in DTO |
| `version_hash` | DB only |
| `rejectionReason` | Rejected extraction detail |
| `pendingCorrectionRequestCount` | Adviser summary (placeholder 0 Phase 07) |

---

## 5. Client-visible fields

### 5.1 Portfolio list

- Insurer, display name, category label (humanised)
- Policy owner, life assured, status label
- Coverage summary string (aggregated labels, max 4 categories)
- Premium + frequency label
- `lastVerifiedAt` (confirmation timestamp)
- `sourceDocumentAvailable`
- `detailHref`

### 5.2 Policy detail

- Coverage components as `{ categoryLabel, amountLabel, durationLabel }`
- `policyTerm`
- `correctionRequestHref` query hint
- No masked policy ref on client detail Phase 07 spec

---

## 6. Provisional data firewall

```typescript
// Client portfolio loader
.in("verification_state", ["confirmed", "corrected"])

// Client detail guard
if (!isPortfolioEligibleState(version.verification_state)) {
  return { ok: false, reason: "not_found" };
}
```

Extractions with status `provisional`, `awaiting_review`, `rejected` never cross client API boundary.

**UI implication:** Client cannot infer pending review count from API — intentional opacity reduces anxiety and prevents acting on unverified data.

---

## 7. Event and audit metadata

`protection_domain_events.safe_metadata` constraints (operational):

| Allowed | Prohibited |
|---------|------------|
| `policyId`, `extractionId` UUIDs | Full policy numbers |
| `method` enum string | Document paths |
| `warnings` count integer | Client PII beyond IDs |
| Counts | Premium amounts (use version table) |

`writeAuditLog` on extraction batch: `{ count, skipped }` only.

---

## 8. HTML and injection

`sanitizeText()` strips HTML tags and enforces max lengths on:

- Insurer, names, display name
- Correction/rejection reasons
- Client explanation on service request bridge

API layer uses `parseJsonBodySafely` and schema validation on enums.

---

## 9. Work queue visibility

Work items expose:

- Client display name (existing queue pattern)
- Summary text without policy numbers
- `actionHref` to adviser portfolio route

No extraction `extracted_fields` JSON in queue card.

---

## 10. Appointment preparation DTO

`CrmProtectionAppointmentPreparationDto` — counts and booleans only:

- `provisionalExtractionsAwaitingReview` (integer)
- `missingSourceDocuments` (integer)
- `clientCorrectionRequests` (integer)
- `upcomingPolicyExpiryOrMaturity` (integer)
- `protectionReportAvailable` (boolean)
- `portfolioLastVerifiedAt` (ISO|null)
- `protectionReviewRequested` (boolean)

No per-policy breakdown in appointment embed — adviser opens portfolio for detail.

---

## 11. Relationship 360

`loadCrmProtectionFinancialPlanLink` returns:

- `label`: "Protection portfolio"
- `href`: adviser route
- `statusLabel`: e.g. "3 confirmed policies · 1 awaiting verification"

No client ethnicity, wealth, or score data in protection link.

---

## 12. Feature flag visibility

| Flag field | Effect |
|------------|--------|
| `enabled` | Master switch for protection portfolio features |
| `adviser_visible` | UI shell may show adviser nav item |
| `client_visible` | Required for client `/protection` access |

Single key `crm_v2_protection_portfolio` — no separate client flag to avoid desync.

---

## 13. Error response uniformity

404 `not_found` for:

- Wrong book policy access
- Unconfirmed policy on client detail
- Missing extraction

Prevents cross-tenant existence leaks. Messages sanitised via `toPublicErrorMessage`.

---

## 14. Rate limiting

Write endpoints use `writeHeavy` bucket — reduces brute-force UUID probing on confirm/reject.

---

## 15. Compliance notes

- Structured portfolio is adviser-verified representation — not insurer certificate
- Client correction path creates auditable service request, not silent edit
- Historical superseded versions retained for adviser audit — not client visible
- PDF in vault may differ from confirmed structured data until adviser aligns

---

## 16. Verification checklist for implementers

- [ ] Client components use `/api/protection` only — not adviser APIs
- [ ] No `storage_path` in React props from protection APIs
- [ ] Print views do not echo full policy numbers from CRM DTOs
- [ ] Browser devtools network tab shows masked refs only on adviser routes
- [ ] Correction form does not expose other clients' policy IDs

---

## 17. Cross-references

- API contract: `docs/CRM_V2_PHASE_07_API_CONTRACT.md`
- Security: `docs/CRM_V2_PHASE_07_SECURITY_REVIEW.md`
- Client summary: `docs/CRM_V2_PHASE_07_CLIENT_PROTECTION_SUMMARY.md`
