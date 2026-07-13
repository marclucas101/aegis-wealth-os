# CRM V2 Phase 07 — Report and Binder Integration

**Principle:** Legacy protection report generator and vault save remain unchanged. Structured CRM portfolio is additive. Binder and future reports consume **confirmed** versions only.

---

## 1. Legacy protection report (unchanged)

| Aspect | Location | Phase 07 status |
|--------|----------|-----------------|
| Adviser UI | `/advisor/protection-report` | **Unchanged** |
| Component | `ProtectionReportClient.tsx` | **Unchanged** |
| Calculations | `summarizeProtectionReport`, ILP validation | **Unchanged** |
| Print | `runBrowserPrint`, A4 CSS | **Unchanged** |
| Draft persistence | localStorage draft helpers | **Unchanged** |
| Sample data loader | `draftFromSampleReport` | **Unchanged** |

Feature flag `crm_v2_protection_portfolio` does **not** gate legacy report access. Advisers may generate reports with flag disabled.

---

## 2. Vault save path (unchanged)

```text
handleSaveToVault()
  → saveProtectionReportToVault({ clientId, reportRootElement, metadata })
  → POST /api/advisor/clients/[clientId]/documents/save-protection-report
  → uploadAdvisorProtectionReport()
  → documents row + storage upload
```

**Metadata stored:**

- `householdName`, `primaryContact`, `statementPeriod`
- `adviserName`, `adviserCompany`
- `policyCount`, `totalCoverage`, `monthlyPremium`

**Document tagging:**

- Source: `ADVISOR_PROTECTION_REPORT_SOURCE = "advisor_protection_report"`
- Tag: `PROTECTION_PORTFOLIO_SUMMARY_TAG = "protection_portfolio_summary"`

Audit action: `advisor_protection_report_saved`.

Phase 07 does not modify this route's request/response contract.

---

## 3. New bridge: report → extractions (additive)

Optional CRM V2 workflow **after** report is ready:

```text
Adviser completes ProtectionReportInput in generator
  → (optional) saves PDF to vault → obtains sourceDocumentId
  → navigates to Relationship protection workspace OR uses API directly
  → POST /api/advisor-v2/relationships/[relationshipId]/protection/extractions
      body: { report, idempotencyKey, sourceDocumentId? }
  → createProtectionExtractionsFromReport()
  → protection_extractions rows (provisional)
```

**Key points:**

- Report JSON is the extraction source — not PDF parsing
- Vault document link is optional FK on extraction
- Saving PDF does **not** auto-create extractions
- Same report can be re-posted with idempotency — skipped duplicates

---

## 4. Extraction mapper contract

`mapProtectionReportToExtractions(report: ProtectionReportInput)`:

| Report field | Extraction field |
|--------------|------------------|
| `policy.insurer` | `insurer` |
| `policy.planName` | `displayName` |
| `policy.policyNumber` | `policyRefMasked` (masked) |
| `policy.sumAssured` | `sumAssured` |
| `policy.monthlyPremium` / `annualPremium` | `premium`, `premiumFrequency` |
| `policy.policyTerm` | `policyTerm`, coverage duration |
| `policy.whatItCovers` | coverage category inference |
| Person names | `policyOwner`, `lifeAssured` |
| Entity id | `sourcePolicyKey` |

ILP policies mapped with investment-linked category where detected.

---

## 5. Binder integration (confirmed versions only)

### 5.1 Current state (Phase 07)

- Annual review binder (`app/annual-review/print/page.tsx`) does **not** yet read `protection_policy_versions`
- Legacy binder continues using existing data sources
- No regression introduced — binder code paths untouched

### 5.2 Future integration contract

When binder consumes CRM portfolio:

| Rule | Rationale |
|------|-----------|
| Only `verification_state IN ('confirmed', 'corrected')` | Client-facing accuracy |
| Use `current_confirmed_version_id` join | Single active version per policy |
| Exclude `superseded`, `rejected`, `provisional` | Audit noise |
| Prefer `structured_snapshot` on version row | Point-in-time accuracy |
| Fall back to legacy report PDF in vault if no CRM policies | Migration period |

### 5.3 Explicit exclusion list for binder SOT

**Must NOT appear in binder as structured facts:**

- `protection_extractions` provisional rows
- `confidence_warnings` arrays
- Unmatched duplicate candidates
- Adviser-internal correction reasons (optional footnote only if operator configures)

```text
Binder structured section (future):
  SELECT p.display_name, v.sum_assured, v.coverage_components, ...
  FROM protection_policies p
  JOIN protection_policy_versions v ON v.id = p.current_confirmed_version_id
  WHERE v.verification_state IN ('confirmed', 'corrected')
    AND p.archived_at IS NULL
```

---

## 6. Future report regeneration

Phase 07 lays groundwork for **regenerating** protection reports from confirmed versions:

| Data source | Use |
|-------------|-----|
| `protection_policies` | Header: insurer, names, status |
| `protection_policy_versions.structured_snapshot` | Coverage/premium at confirm time |
| `documents` via `source_document_id` | Optional "original schedule on file" link in adviser UI only |

**Not in Phase 07 scope:**

- Auto-sync generator draft from CRM portfolio
- Overwriting legacy PDF in vault on confirm
- Client-triggered report regeneration

---

## 7. Appointment preparation cross-link

`loadProtectionAppointmentPreparation()` checks vault for protection reports:

```typescript
.from("documents")
.contains("tags", ["protection_portfolio_summary"])
```

`protectionReportAvailable` boolean — safe signal for meeting prep without exposing document IDs to client appointment views.

---

## 8. Relationship 360 display

Financial plan link shows:

- Count of confirmed policies (max label capped)
- Pending extraction count suffix for **adviser** R360 only

Client R360 equivalent deferred to client portal routes.

---

## 9. Compatibility matrix

| Workflow | Flag off | Flag on, no confirm | Flag on, confirmed |
|----------|----------|---------------------|-------------------|
| Generate report | Works | Works | Works |
| Save PDF vault | Works | Works | Works |
| Client sees PDF in vault | Works | Works | Works |
| POST extractions | 403 | Works | Works |
| Client `/protection` structured | 403 | Empty / partial | Shows confirmed |
| Binder structured (future) | Legacy | Legacy only | CRM + legacy fallback |

---

## 10. Annual review print surface

`app/annual-review/print/page.tsx` — separate from protection report generator.

Phase 07: no modification. Document integration when binder phase wires confirmed versions.

---

## 11. Discover / scoring isolation

Protection benchmarks (`calculateProtectionCore`) do not read CRM tables.

Report generator totals (`summarizeProtectionReport`) remain independent of confirmed portfolio.

Adviser may see divergent numbers until verification — documentation advises confirm workflow.

---

## 12. Audit trail across systems

| Event | System |
|-------|--------|
| PDF saved | `audit_logs` `advisor_protection_report_saved` |
| Extractions created | `audit_logs` `crm_protection_extractions_created` |
| Version confirmed | `protection_domain_events` |
| Vault document | `documents` row immutable metadata |

---

## 13. Operator guidance

1. Train advisers: **Save to vault** and **Import to CRM portfolio** are separate deliberate steps.
2. Pilot clients may have vault PDFs but empty `/protection` until adviser confirms.
3. Do not delete legacy report route during CRM V2 rollout.
4. Binder project should schedule after Gate G8 QA confirms version data quality.

---

## 14. Rejected integrations

| Integration | Reason |
|-------------|--------|
| OCR vault PDF → extraction | No OCR Phase 07 |
| Auto-extract on vault save | Violates mandatory review |
| Binder reads provisional extraction | Client risk |
| Replace vault PDF on confirm | Document immutability |
| Generator reads unconfirmed extraction | Wrong authority |

---

## 15. Cross-references

- Extraction: `docs/CRM_V2_PHASE_07_EXTRACTION_AND_VERIFICATION.md`
- Audit: `docs/CRM_V2_PHASE_07_EXISTING_PROTECTION_AUDIT.md`
- Client summary: `docs/CRM_V2_PHASE_07_CLIENT_PROTECTION_SUMMARY.md`
