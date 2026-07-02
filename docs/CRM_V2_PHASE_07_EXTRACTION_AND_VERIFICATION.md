# CRM V2 Phase 07 — Extraction and Verification

**Module:** `lib/crm-v2/protection/verificationLifecycle.ts`, `lib/crm-v2/protection/extractionMapper.ts`, `lib/crm-v2/protection/protection.ts`  
**Principle:** Unverified extraction is never authoritative. Adviser confirmation is mandatory for portfolio eligibility.

---

## 1. Shared verification vocabulary

Extraction rows (`protection_extractions.adviser_review_status`) and version rows (`protection_policy_versions.verification_state`) use the same state enum:

| State | Label | Portfolio eligible | Terminal |
|-------|-------|-------------------|----------|
| `provisional` | Provisional | No | No |
| `awaiting_review` | Awaiting review | No | No |
| `confirmed` | Confirmed | **Yes** | No |
| `corrected` | Corrected | **Yes** | No |
| `rejected` | Rejected | No | **Yes** |
| `superseded` | Superseded | No | **Yes** |
| `archived` | Archived | No | **Yes** |

Constants: `CRM_PROTECTION_VERIFICATION_STATES`, `CRM_PROTECTION_PORTFOLIO_ELIGIBLE_STATES`, `CRM_PROTECTION_TERMINAL_VERIFICATION_STATES`.

---

## 2. Extraction lifecycle

```text
                    ┌─────────────────┐
                    │  (create)       │
                    │  provisional    │
                    └────────┬────────┘
                             │ optional submit
                             ▼
                    ┌─────────────────┐
         ┌─────────│ awaiting_review │─────────┐
         │         └────────┬────────┘         │
         │                  │                 │
    reject│            confirm│           correct│
         ▼                  ▼                 ▼
  ┌────────────┐    ┌────────────┐    ┌────────────┐
  │  rejected  │    │ confirmed  │    │ corrected  │
  └────────────┘    └─────┬──────┘    └─────┬──────┘
                          │ new version      │
                          ▼                  ▼
                    ┌────────────┐
                    │ superseded │ (prior confirmed version)
                    └────────────┘
```

### 2.1 Creation paths

| Method | Trigger | Module |
|--------|---------|--------|
| `protection_report` | `POST .../protection/extractions` with `ProtectionReportInput` | `createProtectionExtractionsFromReport` |
| `document_vault` | Reserved — adviser manual link (future) | Not auto-OCR |
| `manual` | Reserved — adviser manual entry (future) | Not implemented UI Phase 07 |

Initial state: `initialExtractionReviewState()` → `provisional`.

### 2.2 Extraction row fields

| Column | Purpose |
|--------|---------|
| `extracted_fields` | JSONB — `AdviserProtectionExtractedFieldsDto` shape |
| `confidence_warnings` | String array from `buildExtractionConfidenceWarnings` |
| `source_document_id` | Optional vault document FK |
| `source_report_policy_key` | Stable key per policy in report input |
| `idempotency_key` | `{parentKey}:{sourcePolicyKey}` uniqueness per client |
| `version` | Optimistic concurrency on review actions |
| `resulting_policy_id` / `resulting_version_id` | Set on successful confirm |

### 2.3 Idempotent re-import

If `idempotency_key` already exists for client:

- Existing extraction ID returned
- `skipped` counter incremented
- No duplicate provisional rows

Parent idempotency key supplied by API caller (report import batch).

---

## 3. Adviser review is mandatory

### 3.1 Hard rules (enforced in code)

1. **No client confirm API** — `assertClientCannotVerify()` throws `client_forbidden`.
2. **No auto-confirm on report save** — vault save route unchanged; no extraction insert.
3. **No auto-confirm on extraction create** — status remains `provisional`.
4. **Client portfolio loader** filters versions: `.in("verification_state", ["confirmed", "corrected"])`.
5. **Rejected extractions** excluded from `loadExtractionsForClient` open queue and never create policy rows.

### 3.2 Adviser actions

| Action | API | Result state | Creates policy? |
|--------|-----|--------------|-----------------|
| Confirm | `POST .../confirm` | `confirmed` | Yes (new or match) |
| Correct | `POST .../correct` | `corrected` | Yes (with `correctedFields`) |
| Reject | `POST .../reject` | `rejected` | No |

Both confirm and correct call `confirmProtectionExtraction()` — correct supplies `correctedFields` and sets state to `corrected`.

### 3.3 Transition validation

`validateVerificationTransition({ fromState, toState, actorRole })`:

- Actor must be `adviser` or `system` (no `client`)
- Terminal states cannot transition outward
- Same-state transitions rejected (`same_state_noop`)
- Matrix defined in `ADVISER_TRANSITIONS` constant

Confirm flow tolerates `provisional → awaiting_review → confirmed` composite validation for UX flexibility.

---

## 4. Confirm workflow (detailed)

```text
1. Load extraction by ID
2. resolveAccessibleClient — assignment check
3. expectedVersion === row.version else 409 conflict
4. Idempotent return if already confirmed with resulting_version_id
5. Merge correctedFields; mask policy ref if supplied
6. validateVerificationTransition
7. If matchPolicyId: load policy, supersedeCurrentVersion
   Else: INSERT protection_policies
8. INSERT protection_policy_versions (version_number = count+1)
9. UPDATE protection_policies header + current_confirmed_version_id (optimistic version)
10. UPDATE extraction review status + resulting IDs
11. recordProtectionEvent + audit log
```

### 4.1 Match existing policy

Adviser may pass `matchPolicyId` when duplicate candidates surfaced. System **never** auto-selects candidate.

`supersedeCurrentVersion()` sets prior confirmed version to `superseded` + `superseded_at` timestamp.

### 4.2 Correction reason

Optional `correctionReason` (≤500 chars) stored on version row. Required semantically on correct endpoint (defaults to "Adviser correction").

---

## 5. Reject workflow

```text
1. Load extraction + access check
2. Version conflict check → 409
3. validateVerificationTransition → rejected
4. UPDATE adviser_review_status, rejection_reason, reviewed_by, reviewed_at
5. recordProtectionEvent extraction_rejected
```

Rejected rows remain in database for audit but drop from adviser "awaiting verification" lists.

---

## 6. Report → extraction mapping

`mapProtectionReportToExtractions(report)`:

- One extraction per policy in `report.policies`
- `sourcePolicyKey` from report entity IDs
- Category inference from plan name / type strings
- Coverage components from `whatItCovers` text heuristics
- Premium frequency from monthly vs annual fields
- Policy status defaults to `in_force` (adviser may correct)
- Policy number masked via `maskPolicyNumber` before storage

**No OCR** — mapping reads structured report JSON only.

### 6.1 Confidence warnings

`buildExtractionConfidenceWarnings(fields, mapperWarnings)` adds human-readable flags, e.g.:

- Missing sum assured
- Unknown premium frequency
- Empty coverage components
- Ambiguous category mapping

Warnings appear in adviser UI; they do not block confirm.

---

## 7. Concurrency

| Entity | Mechanism | Error |
|--------|-----------|-------|
| `protection_extractions` | `version` column | 409 `conflict` |
| `protection_policies` | `version` column on header update | implicit mismatch → update fails |

Client must send `expectedVersion` on confirm/reject/correct POST bodies.

---

## 8. Domain events on verification

| event_type | entity_type | When |
|------------|-------------|------|
| `extraction_created` | extraction | Batch create from report |
| `version_confirmed` | version | Confirm without field changes |
| `extraction_corrected` | version | Correct with field changes |
| `extraction_rejected` | extraction | Reject |

`safe_metadata` may include `policyId`, `extractionId`, `method`, `warnings` count — never full policy numbers or storage paths.

---

## 9. UI surfaces

**Adviser:** `ProtectionPortfolioClient.tsx`

- Portfolio summary counts (confirmed, provisional, awaiting, missing source, expiry)
- Policy list with verification badges and stale indicator (`CRM_V2_PROTECTION_STALE_DAYS`)
- Awaiting Verification panel with duplicate candidate policy IDs
- Deep links: `?policyId=`, `?extractionId=`

**Client:** No extraction visibility — only confirmed portfolio (see client summary doc).

---

## 10. Work queue projection

Extractions in `provisional` or `awaiting_review` appear as work items:

- sourceType: `protection_extraction`
- actionHref: portfolio route with `extractionId` query param
- Adapter does not change review status

---

## 11. Error codes (API mapping)

| Service reason | HTTP | Meaning |
|----------------|------|---------|
| `not_found` | 404 | Extraction/policy missing or wrong book |
| `forbidden` | 403 | Not assigned adviser |
| `validation` | 400 | Invalid transition or payload |
| `conflict` | 409 | Stale `expectedVersion` |

---

## 12. Testing references

- Unit: `lib/crm-v2/protection/verificationLifecycleTests.ts`
- Validation: `scripts/run-crm-v2-protection-validation.ts`
- Manual: `docs/CRM_V2_PHASE_07_MANUAL_TESTS.md` items 5–12, 32–33

---

## 13. Deferred (not Phase 07)

- Bulk auto-submit to `awaiting_review`
- Client upload → extraction without adviser
- OCR from vault PDF
- System actor auto-confirm rules
- ML confidence thresholds blocking confirm

---

## 14. Cross-references

- Versioning: `docs/CRM_V2_PHASE_07_POLICY_VERSIONING.md`
- Architecture: `docs/CRM_V2_PHASE_07_PROTECTION_ARCHITECTURE.md`
- API: `docs/CRM_V2_PHASE_07_API_CONTRACT.md`
