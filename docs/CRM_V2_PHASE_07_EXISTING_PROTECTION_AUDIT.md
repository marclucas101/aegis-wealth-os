# CRM V2 Phase 07 — Existing Protection Audit

**Purpose:** Classify every pre-Phase-07 protection-related source before introducing canonical CRM V2 protection portfolio authorities.  
**Rule:** One authoritative record per domain; projections, queues, and report outputs are never SOT for structured policy data.

---

## Classification legend

| Label | Meaning |
|-------|---------|
| **Authoritative** | Existing SOT — mutations stay here |
| **Reuse** | Read or link without copying payload into a duplicate table |
| **Projection** | Assembled read model only |
| **New** | Greenfield canonical table introduced Phase 07 |
| **Deferred** | Out of Phase 07 scope |
| **Rejected** | Duplicate authority — must not create |

---

## 1. Protection report generator

| Item | Detail |
|------|--------|
| Route | `/advisor/protection-report` |
| UI | `components/aegis/advisor/protection-report/ProtectionReportClient.tsx` |
| Domain | `src/features/advisor-console/protection-report/*` |
| Input type | `ProtectionReportInput` — household, persons, policies, ILP allocations |
| Output | Browser-rendered A4 preview; structured in-memory object; optional PDF via print |
| Classification | **Authoritative** (adviser workflow tool for drafting portfolio summaries) |
| Phase 07 decision | **Reuse** — report generator remains the adviser-facing authoring surface. Phase 07 adds `mapProtectionReportToExtractions()` in `lib/crm-v2/protection/extractionMapper.ts` to translate report JSON into provisional `protection_extractions` rows. Generator logic, calculations (`summarizeProtectionReport`), and draft persistence are **unchanged**. No automatic promotion to portfolio without adviser confirmation. |

**Non-goals confirmed:**

- No replacement of the report UI with CRM V2 portfolio editor in Phase 07
- No insurer API pull
- No OCR pipeline attachment to report save

---

## 2. Document Vault (protection PDF save)

| Item | Detail |
|------|--------|
| API | `POST /api/advisor/clients/[clientId]/documents/save-protection-report` |
| Client helper | `src/features/document-vault/saveProtectionReportToVault.ts` |
| Persistence | `uploadAdvisorProtectionReport()` in `lib/supabase/advisorDocumentPersistence.ts` |
| Storage SOT | `documents` table + Supabase storage bucket |
| Tags / source | `ADVISOR_PROTECTION_REPORT_SOURCE = "advisor_protection_report"`; tag `protection_portfolio_summary` |
| Classification | **Authoritative** (document storage) |
| Phase 07 decision | **Reuse** — vault remains the only document authority. `protection_policies.source_document_id` FK links a confirmed policy to an existing vault row. Phase 07 migration explicitly does **not** create a `documents` duplicate table. PDF bytes are not parsed for structured extraction in Phase 07. |

**Linkage pattern:**

```text
Adviser generates report → saves PDF to vault → optional sourceDocumentId on extraction POST
  → adviser confirms extraction → policy.source_document_id set from extraction row
```

---

## 3. Discover module (financial discovery)

| Item | Detail |
|------|--------|
| Routes | Discover flows under adviser client workspace |
| Components | `components/aegis/discover/*`, `FinancialInput` primitives reused by protection report |
| Data | Discovery captures household financial facts; not a policy registry |
| Classification | **Authoritative** (discovery intake domain) |
| Phase 07 decision | **Reuse / no merge** — Discover data does not auto-populate `protection_policies`. Adviser may manually align report draft with discovery facts offline. Future phase may add explicit "import from discovery" bridge; **deferred**. Discover Shield Score and protection benchmarks remain display-only aggregates. |

---

## 4. Protection scoring / benchmarks

| Item | Detail |
|------|--------|
| Modules | `src/lib/scoring/protectionBenchmarks.ts`, `calculateProtectionCore.ts`, `protectionCoreTypes.ts` |
| UI | `components/aegis/advisor/AdvisorClientScorePanel.tsx` — classification display |
| Purpose | Display-only protection core aggregate for adviser conversation support |
| Classification | **Authoritative** (scoring display layer) |
| Phase 07 decision | **Reuse / projection** — Shield Score and protection benchmarks are **not** fed from `protection_policy_versions` in Phase 07. Confirmed CRM portfolio is a separate adviser-verified authority. Scoring weights explicitly documented as "not used in Shield Score" for protection core. No queue prioritisation from protection scores. |

---

## 5. OCR / document classification

| Item | Detail |
|------|--------|
| Roadmap | `docs/BETA_ROADMAP_AFTER_LAUNCH.md` — OCR/classification spike deferred post-launch |
| Vault classification | `preliminary_classification` on documents (Phase 9F.x) — general document typing |
| Phase 07 code | `extractionMapper.ts` contains **no** OCR references; validation script asserts absence |
| Classification | **Deferred** (OCR); **Reuse** (existing preliminary classification column on documents) |
| Phase 07 decision | **Rejected** — no OCR extraction path, no new classification table for policies. `protection_extractions.extraction_method` allowlist: `protection_report`, `document_vault`, `manual` only. `document_vault` method reserved for future adviser-initiated manual link; Phase 07 does not parse PDF text. |

---

## 6. Classification table (audit summary)

| Source | Table / module | Classification | Phase 07 action |
|--------|----------------|----------------|-----------------|
| Protection report generator | In-memory + local draft storage | Authoritative (tool) | Reuse → map to extractions |
| Report PDF in vault | `documents` | Authoritative | Reuse via FK |
| Structured policy identity | — | — | **New** `protection_policies` |
| Versioned coverage/premium | — | — | **New** `protection_policy_versions` |
| Provisional machine/report extract | — | — | **New** `protection_extractions` |
| Protection audit trail | — | — | **New** `protection_domain_events` |
| Discover intake | Discovery tables | Authoritative | Reuse, no auto-sync |
| Protection benchmarks | Scoring modules | Authoritative (display) | Reuse, isolated |
| Shield Score | Scoring pipeline | Authoritative | Reuse, no portfolio feed |
| Document OCR | — | Deferred | Rejected Phase 07 |
| Policy classification ML table | — | Deferred | Rejected |
| `advisor_tasks` for verification | `advisor_tasks` | Authoritative | Reuse — work queue projects extractions instead |
| Duplicate `protection_documents` | — | Rejected | Must not create |
| Client-visible unverified rows | — | Rejected | Client API filters confirmed only |

---

## 7. Legacy adviser protection-report workflow

| Item | Detail |
|------|--------|
| Print | `runBrowserPrint` / A4 CSS (`app/report-a4-print.css`) |
| Annual review print | `app/annual-review/print/page.tsx` — separate print surface |
| Classification | **Authoritative** (legacy print paths) |
| Phase 07 decision | **Reuse unchanged** — legacy report print and vault save continue to work with feature disabled. CRM V2 protection portfolio is additive. Binder integration documented separately; unconfirmed extractions excluded from binder SOT. |

---

## 8. Relationship 360 / financial plan tab

| Item | Detail |
|------|--------|
| Module | `lib/crm-v2/relationships/protectionProjection.ts` |
| Output | `CrmFinancialPlanLink` with href to adviser portfolio route |
| Classification | **Projection** |
| Phase 07 decision | **Projection only** — counts confirmed policies and pending extractions; does not mutate protection tables. Wired in `readModel.ts`. |

---

## 9. Appointment preparation

| Item | Detail |
|------|--------|
| Loader | `loadProtectionAppointmentPreparation()` in `protection.ts` |
| DTO | `CrmProtectionAppointmentPreparationDto` on appointment types |
| Classification | **Projection** |
| Phase 07 decision | **Projection** — safe counts only (provisional extractions, missing source docs, correction requests, expiry horizon). No client PII expansion beyond existing appointment context. |

---

## 10. Work queue sources (pre-existing)

| Item | Detail |
|------|--------|
| Registry | `lib/work-queue/sourceRegistry.ts` |
| Classification | **Projection** |
| Phase 07 decision | **New adapters** — `protectionExtractionAdapter`, `protectionPolicyServicingAdapter` read batch data only. No `advisor_work_items` table. |

---

## 11. Client portal (pre-Phase-07)

| Item | Detail |
|------|--------|
| Vault client view | Clients see saved protection summary PDFs in document vault |
| Structured portfolio | None before Phase 07 |
| Classification | Vault **Authoritative**; structured portfolio **New** |
| Phase 07 decision | Client route `/protection` shows **confirmed** policies only via `loadClientProtectionPortfolio()`. Vault PDFs remain separate consumer experience until binder/report integration phase. |

---

## 12. Service requests (Phase 06 dependency)

| Item | Detail |
|------|--------|
| Table | `client_service_requests` |
| Categories extended | `protection_correction`, `protection_review` |
| Classification | **Authoritative** (client-initiated servicing) |
| Phase 07 decision | **Reuse** — client correction/review flows create service requests; protection tables are not mutated by client POST. |

---

## 13. Feature control (existing platform)

| Item | Detail |
|------|--------|
| Table | `platform_feature_controls` |
| Phase 07 key | `crm_v2_protection_portfolio` (single key — no separate client flag) |
| Classification | **Authoritative** |
| Phase 07 decision | **Reuse** — seed migration `202606290010` adds row default `enabled = false`, `client_visible = true`, `adviser_visible = true`. Client gate checks same key with `client_visible`. |

---

## 14. Rejected duplications (explicit)

| Proposed duplicate | Rejection reason |
|--------------------|------------------|
| `protection_documents` table | `documents` is vault SOT |
| Auto-confirm on report save | Violates adviser verification mandate |
| OCR → `protection_policies` direct insert | No OCR in Phase 07 |
| Client confirmation API | `assertClientCannotVerify()` |
| Silent dedup merge | `findDuplicateCandidates` surfaces IDs only |
| Protection rows in `advisor_tasks` | Use extraction adapter instead |
| Separate `crm_v2_client_protection` flag | Single `crm_v2_protection_portfolio` key |

---

## 15. Operator implications

1. Enable `crm_v2_protection_portfolio` only after Gate G8 approval (see feature control plan).
2. Existing report generator and vault workflows remain available during pilot.
3. No data backfill from historical PDFs — advisers create extractions from current report JSON or future manual entry.
4. Discover scores and CRM portfolio may diverge until adviser verifies; this is intentional.

---

## 16. Cross-references

- Architecture: `docs/CRM_V2_PHASE_07_PROTECTION_ARCHITECTURE.md`
- Extraction lifecycle: `docs/CRM_V2_PHASE_07_EXTRACTION_AND_VERIFICATION.md`
- SOT matrix: `docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md` §3.4
- Blueprint: `docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md` §5.5
