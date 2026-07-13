# CRM V2 Phase 07 — Completion Report

**Branch:** `crm-v2-07-protection-portfolio`  
**Date:** 2026-06-30  
**Scope:** Phase 07 only — structured protection portfolio with adviser verification  
**Migrations applied:** No  
**Features enabled:** No  

---

## 1. Repository state

- Branch `crm-v2-07-protection-portfolio` checked out; `main` untouched.
- Additive implementation: domain layer, APIs, UI, work-queue adapters, migrations (unapplied), diagnostics, documentation, QA script.
- Legacy protection report generator (`/advisor/protection-report`), document vault, binder lineage, Google Calendar, Meeting Studio, and Phase 9F.4 observation unchanged.
- Production build succeeds with new routes: `/advisor-v2/relationships/[relationshipId]/protection`, `/protection`, `/protection/[policyId]`, and protection API routes.

## 2. Existing protection audit

Completed in `docs/CRM_V2_PHASE_07_EXISTING_PROTECTION_AUDIT.md`.

| Component | Classification |
|-----------|----------------|
| Protection report generator (`/advisor/protection-report`) | Reusable extraction source; unchanged |
| Vault `documents` + save-protection-report | Authoritative source document |
| Discover / Shield Score | Compatibility projection; isolated from portfolio tables |
| Published outputs / binder | Reusable analysis/report; confirmed versions only for future feed |
| No pre-existing structured policy table | **SOT NEW** — `protection_policies` + versions |

No duplicate document authority created. No existing structured policy table evolved (none existed).

## 3. Exact feature keys

| Key | Scope | Default | Persistence |
|-----|-------|---------|-------------|
| `crm_v2_protection_portfolio` | Adviser portfolio + client summary (`client_visible=true`) | `enabled=false` | Seeded disabled in `202606290010` |

**No separate `crm_v2_client_protection` key** — client gate uses `assertCrmV2ClientProtectionAccess()` on the same key with `client_visible` check.

Gates: `crm_v2_master` → `crm_v2_pilot_mode` → pilot allowlist → `crm_v2_protection_portfolio`. Client correction writes additionally require `crm_v2_client_service`.

## 4. Migration files

| File | Purpose |
|------|---------|
| `supabase/migrations/202606290010_phase07_crm_v2_protection_feature_control.sql` | Seed `crm_v2_protection_portfolio` disabled |
| `supabase/migrations/202606290011_phase07_crm_v2_protection_core.sql` | Policy, version, extraction, domain-event tables; service-request category extension |

Diagnostics (preflight / verify / discrepancies) for both migrations under `supabase/diagnostics/`.

## 5. Canonical authorities

| Table | Role |
|-------|------|
| `protection_policies` | Stable logical policy identity per client/relationship |
| `protection_policy_versions` | Versioned confirmed/corrected coverage and premium fields |
| `protection_extractions` | Provisional machine/report extraction awaiting adviser review |
| `protection_domain_events` | Immutable protection-domain audit (safe metadata only) |

Coverage components and riders: versioned JSON with allowlisted categories (`lib/crm-v2/protection/types.ts`).

## 6. Source-document authority

- Vault `documents` remains authoritative for uploaded policy PDFs and saved protection reports.
- Structured policies link via `source_document_id` FK only — no duplicate blob storage.
- Raw storage paths and signed URLs never appear in public DTOs.

## 7. Extraction architecture

```
source document / protection report JSON
  → POST .../protection/extractions (idempotent)
  → protection_extractions (provisional | awaiting_review)
  → adviser review workspace
  → confirm | correct | reject | match existing
  → protection_policy_versions (confirmed)
```

- Mapper: `lib/crm-v2/protection/extractionMapper.ts` — uses structured report output; no repeated OCR.
- Extraction failures do not mutate confirmed policies.
- Duplicate extraction prevented via `(client_id, idempotency_key)` unique constraint.

## 8. Verification lifecycle

States: `provisional`, `awaiting_review`, `confirmed`, `corrected`, `rejected`, `superseded`, `archived`.

Module: `lib/crm-v2/protection/verificationLifecycle.ts`

- Extraction begins provisional; adviser confirmation mandatory (`assertClientCannotVerify()`).
- Correction preserves original extraction snapshot.
- Rejected extraction cannot populate portfolio.
- Invalid transitions perform no write; stale review returns `409`.
- Repeated confirmation is idempotent.

## 9. Policy identity and deduplication

Module: `lib/crm-v2/protection/deduplication.ts`

Matching signals: client, insurer, masked policy number, policy type, commencement date, life assured, owner.

- Deterministic duplicate **candidates** only — adviser decides; no silent merge.
- Full policy numbers masked in UI/DTOs (`maskPolicyNumber`).
- Same report re-processed is idempotent via extraction idempotency key.

## 10. Versioning

- Monotonic `version_number` per policy.
- Re-confirmation supersedes prior confirmed version (retained, auditable).
- `structured_snapshot` + `version_hash` on confirm.
- Documented in `docs/CRM_V2_PHASE_07_POLICY_VERSIONING.md`.

## 11. Coverage and riders

Allowlisted categories: death, TPD, critical illness, early CI, hospitalisation, personal accident, disability income, long-term care, waiver, savings/endowment, investment-linked, other.

Stored in version JSON with confirmed amount/currency; insurer wording retained separately. No adequacy conclusions or recommendations.

## 12. Adviser protection portfolio

- Route: `/advisor-v2/relationships/[relationshipId]/protection`
- Component: `components/aegis/advisor-v2/protection/ProtectionPortfolioClient.tsx`
- Service: `lib/crm-v2/protection/protection.ts`
- Relationship 360 Financial Plan link via `lib/crm-v2/relationships/protectionProjection.ts`

Views: portfolio summary, policies, coverage, awaiting verification, missing documents, version history, review activity. Provisional values clearly labelled.

## 13. Verification workspace

Adviser can open provisional extraction, compare with source, select/create policy, edit bounded fields, confirm/reject, record correction reason, view duplicate candidates and validation warnings.

Server-side assignment enforcement, optimistic concurrency (`version` column), audited transitions, no automatic client publication.

## 14. Client protection summary

- Routes: `/protection`, `/protection/[policyId]`
- Component: `components/aegis/client/ClientProtectionClient.tsx`
- Confirmed/corrected client-visible versions only — no provisional data, confidence scores, or raw policy numbers.

## 15. Client correction requests

- `POST /api/protection/[policyId]/correction-request`
- `POST /api/protection/review-request`
- Creates `client_service_requests` with categories `protection_correction` / `protection_review` (Phase 06 authority).
- Does not mutate active confirmed version. Requires `crm_v2_client_service` for writes.

## 16. Appointment integration

`loadProtectionAppointmentPreparation()` in `lib/crm-v2/protection/protection.ts` projects safe counts onto `CrmAppointmentDetail.protectionPreparation`:

- Awaiting verification count
- Missing source documents
- Client correction requests
- Portfolio last verified date
- Upcoming expiry/maturity flags

No private policy values in generic appointment cards; no automatic status transitions.

## 17. Service and work-queue integration

- Work-queue adapters (read-only): `protectionExtractionAdapter`, `protectionPolicyServicingAdapter`
- Registered in `sourceRegistry`, `batchData`, `loadWorkQueueBatchData`, fixtures
- Servicing projections: provisional extraction review, client correction, missing source, stale verification, expiry/maturity, unconfirmed status, protection review requested
- No prioritization by premium, sum assured, commission, wealth, or ethnicity

## 18. Report and binder integration

- Legacy report generator and vault save **unchanged**
- Optional bridge: POST extractions from report JSON after adviser action
- Binder/meeting pack future contract: confirmed versions only; provisional excluded
- Documented in `docs/CRM_V2_PHASE_07_REPORT_AND_BINDER_INTEGRATION.md`

## 19. APIs

**Adviser**

| Method | Route |
|--------|-------|
| GET | `/api/advisor-v2/relationships/[relationshipId]/protection` |
| POST | `/api/advisor-v2/relationships/[relationshipId]/protection/extractions` |
| GET | `/api/advisor-v2/protection/extractions/[extractionId]` |
| POST | `/api/advisor-v2/protection/extractions/[extractionId]/confirm` |
| POST | `/api/advisor-v2/protection/extractions/[extractionId]/correct` |
| POST | `/api/advisor-v2/protection/extractions/[extractionId]/reject` |
| GET | `/api/advisor-v2/protection/policies/[policyId]` |
| GET | `/api/advisor-v2/protection/policies/[policyId]/versions` |

**Client**

| Method | Route |
|--------|-------|
| GET | `/api/protection` |
| GET | `/api/protection/[policyId]` |
| POST | `/api/protection/[policyId]/correction-request` |
| POST | `/api/protection/review-request` |

Contract: `docs/CRM_V2_PHASE_07_API_CONTRACT.md`

## 20. DTO and visibility controls

Distinct DTOs in `lib/crm-v2/protection/types.ts` for adviser portfolio, provisional extraction, version history, client summary, correction request.

Never exposed: raw DB rows, AI/OCR payloads, storage paths, persistent signed URLs, unmasked policy numbers, internal adviser notes, unconfirmed data in client DTOs.

Documented in `docs/CRM_V2_PHASE_07_VISIBILITY_AND_PRIVACY.md`.

## 21. Event and audit history

- `protection_domain_events` with bounded `safe_metadata` JSONB
- `writeAuditLog` on extraction batch create and verification transitions
- No raw document content, full policy numbers, or provider tokens in audit summaries

## 22. Concurrency and idempotency

- Optimistic `version` on extractions and policy headers
- Extraction idempotency: `(client_id, idempotency_key)` unique
- Confirm idempotent when already confirmed
- Duplicate client correction requests prevented
- Safe `409` on stale review

## 23. Security and IDOR

- Assignment-scoped access + RLS (`is_assigned_advisor(client_id)`) on all four tables
- Client cannot confirm or edit policy versions
- Forged IDs return safe not-found
- Feature-disabled paths perform no business loading
- Queue adapters cannot mutate policies
- 30-case IDOR list in `docs/CRM_V2_PHASE_07_SECURITY_REVIEW.md`

## 24. Performance

- Bounds: `CRM_V2_PROTECTION_MAX_POLICIES` (50), `MAX_VERSIONS` (30), `MAX_EXTRACTIONS` (50)
- Indexes on client_id, adviser_id, review status, idempotency
- Portfolio list batched — no per-policy N+1 API calls
- `Cache-Control: private, no-store`; no automatic polling

## 25. Files changed (summary)

| Area | Paths |
|------|-------|
| Domain | `lib/crm-v2/protection/*` |
| Access / flags | `lib/crm-v2/access.ts`, `lib/crm-v2/constants.ts`, `lib/compliance/featureFlags.ts`, `lib/compliance/types.ts` |
| Relationships | `lib/crm-v2/relationships/protectionProjection.ts`, `readModel.ts` |
| Appointments | `lib/crm-v2/appointments/service.ts`, types |
| Service | `lib/crm-v2/service/requestLifecycle.ts` |
| Work queue | `lib/work-queue/adapters/protection*.ts`, `batchData.ts`, `loadWorkQueueBatchData.ts`, `sourceRegistry.ts`, fixtures |
| APIs | `app/api/advisor-v2/protection/**`, `app/api/advisor-v2/relationships/[id]/protection/**`, `app/api/protection/**` |
| UI | `app/advisor-v2/relationships/[id]/protection/page.tsx`, `app/protection/**`, protection client components |
| Nav | `lib/navigation.ts` |
| Migrations | `supabase/migrations/202606290010_*`, `202606290011_*` + diagnostics |
| QA | `scripts/run-crm-v2-protection-validation.ts`, `scripts/run-crm-v2-relationship-360-validation.ts` (Phase 07 exclusions) |
| Docs | 13 Phase 07 docs + rollout/route/migration/feature-control updates |

## 26. Exact QA results (executed 2026-06-30)

| Command | Result |
|---------|--------|
| `npm run qa:crm-v2-blueprint` | **219/219** ✓ |
| `npm run qa:crm-v2-shell` | **149/149** ✓ |
| `npm run qa:crm-v2-relationship-360` | **270/270** ✓ |
| `npm run qa:crm-v2-appointments-adviser` | **451/451** ✓ |
| `npm run qa:crm-v2-appointments-client` | **285/285** ✓ |
| `npm run qa:crm-v2-google-calendar` | **338/338** ✓ |
| `npm run qa:crm-v2-service` | **405/405** ✓ |
| `npm run qa:crm-v2-protection` | **463/463** ✓ |
| `npm run qa:phase10-discovery` | **118/118** ✓ |
| `npm run qa:phase10-work-queue-core` | **135/135** ✓ |
| `npm run qa:phase9f4-app-retirement` | **115/115** ✓ |
| `npm run qa:phase9f3-binder-client-vault` | **198/198** ✓ |
| `npm run qa:phase9e-communications` | **87/87** ✓ |
| `npm run qa:migration-readiness` | **101/101** ✓ |
| `npm run qa:diagnostic-sql-syntax` | **69/69** ✓ (21 self-tests + 48 file parses) |
| `npm run security:api` | **OK** (199 routes scanned; pre-existing warnings only) |
| `npm run security:advisor-access` | **11/11** ✓ |
| `npm run security:service-role` | **OK** (34 REVIEW items; no critical unsafe imports) |
| `npm run final:check` | **7/7** ✓ |
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** (0 errors, 8 pre-existing warnings) |
| `npm run build` | **PASS** |

## 27. Dry-run result

`npx supabase db push --dry-run` was attempted twice; CLI stalled at `Initialising login role...` for >5 minutes without completing (likely requires operator network/session to linked project `aegis-wealth-os`).

**Local migration chain verification (executed):**

- CRM V2 chain ends at `202606290011_phase07_crm_v2_protection_core.sql`
- Phase 07 adds exactly two files: `202606290010` (feature control) and `202606290011` (core)
- `qa:migration-readiness` confirms ordered chain, diagnostic coverage, and no automated push
- **Operator action:** run dry-run from connected environment; expect pending migrations `202606290010` + `202606290011` only (after Phase 06 applied on target)

## 28. Manual tests remaining

39 runtime acceptance items documented in `docs/CRM_V2_PHASE_07_MANUAL_TESTS.md` — **not executed in this delivery** (per spec: do not mark runtime tests passed unless actually run).

Key operator scenarios: feature-disabled blocks, assignment scoping, extraction → confirm flow, stale conflict, client correction via service request, appointment prep safe counts, queue read-only projection.

## 29. Operator decisions required

1. Approve Gate G8 protection core apply (`202606290010` then `202606290011`)
2. Confirm Phase 06 `client_service_requests` applied on target database
3. Run `npx supabase db push --dry-run` from connected CLI session
4. Execute 39 manual acceptance tests on staging with pilot adviser + test client
5. Enable sequence: `crm_v2_master` → `crm_v2_pilot_mode` → `crm_v2_protection_portfolio` (and `crm_v2_client_service` if testing client corrections)

## 30. Confirmation — prohibited changes did NOT occur

- ✓ No automatic advice or adequacy recommendations
- ✓ No insurer API integration
- ✓ No duplicate `documents` authority
- ✓ No moments or advocacy schema
- ✓ No feature activation or remote enablement
- ✓ No deployment or destructive migration
- ✓ No migration apply (`db push` not executed)
- ✓ Phase 9F.4 observation unchanged
- ✓ Legacy protection report generator operational
- ✓ No Promotions Stage 6

## 31. Verdict

### **`READY TO APPLY CRM V2 PROTECTION PORTFOLIO`**

All automated gates pass (463 protection checks + full acceptance suite). Migrations and feature controls remain unapplied/disabled pending operator apply, dry-run confirmation, and manual acceptance.

**Next phase gate after operator apply + pilot QA:** `READY FOR CRM V2 RELATIONSHIP MOMENTS` (Phase 08)
