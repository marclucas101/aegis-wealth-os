# Phase 10 — Architectural Debt Register

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

Classification: **Must fix before Phase 10** | **Fix within Phase 10** | **Defer** | **Accept**

---

## Debt items

| ID | Item | Evidence | Classification | Rationale |
|----|------|----------|----------------|-----------|
| D01 | Dual client lifecycle enums (`clients.status` vs `relationship_stage`) | `advisorReviewPipeline.ts`, `activeClientAccess.ts` | **Fix within Phase 10** | Queue queries must canonicalize; full migration defer |
| D02 | Duplicated public error sanitization | `lib/ops/errorReporting.ts` vs `lib/security/apiGuards.ts` | Defer | Consolidate when touching error paths in 10.6 |
| D03 | Duplicated `AdvisorTaskStatus` types | `advisorTasks.ts` + `AdvisorTaskComposer.tsx` | **Fix within Phase 10** | Queue UI will import shared types |
| D04 | Duplicated job status unions | `lib/jobs/types.ts` vs `automationJobPersistence.ts` | Defer | Low risk |
| D05 | Overlapping publication status enums | `PublicationStatus`, `BinderPublicationStatus`, `BinderExportStatus` | Defer | Document mapping in queue layer |
| D06 | Service-role–heavy persistence | `docs/SERVICE_ROLE_USAGE_REVIEW.md`, widespread `createAdminSupabaseClient()` | Accept | Mitigated by security scripts; new routes must use gates |
| D07 | Oversized components (>700 LOC) | `ProtectionReportClient.tsx`, `DiscoverWizard.tsx`, `localProfile.ts` | Defer | Not blocking queue; split when editing |
| D08 | `src/` vs `lib/` scoring split | `@/src/lib/scoring` imports from `lib/supabase` | Accept | Documented pattern |
| D09 | API route inventory stale | `docs/API_ROUTE_INVENTORY.md` vs 159+ routes | **Fix within Phase 10** | Update during 10.1 doc checkpoint |
| D10 | Missing indexes for queue queries | Task due_date, review due — verify in migration review | **Fix within Phase 10** | Add indexes if explain plans warrant |
| D11 | Weak audit read coverage | No admin audit viewer | Defer to 10.6 ops panel | Writes comprehensive |
| D12 | Stale feature controls without UI | API-only feature flags | **Fix within Phase 10** | Ops panel in 10.6 |
| D13 | Migration diagnostic fragility | `diagnostic-sql-analyzer.ts` used in 9F.4 QA | Accept | Continue QA scripts |
| D14 | Synchronous binder PDF generation timeout risk | `binderGenerationService.ts` | Accept | Existing retry/status; monitor in ops |
| D15 | Ephemeral adviser notifications | `advisorNotifications.ts` computed only | **Fix within Phase 10** | Optional persist for SLA in Track A |
| D16 | Roadmap ↔ task linkage gap | Separate tables, loose related_entity | **Fix within Phase 10** | Virtual queue dedup first; FK optional later |
| D17 | Test fixtures for queue aggregation | Limited integration tests for command center | Defer | Add in 10.8 acceptance |
| D18 | Client roadmap legacy fallback | `RoadmapClient` dual API path | Defer | Remove after active envelope stable |
| D19 | Transaction gaps in multi-step publication | `publicationWorkflow.ts` | Accept | Existing pattern; don't refactor broadly |
| D20 | Inaccessible UX: notifications under Insights | `lib/navigation.ts` | Defer to client track B | Note in client journey |
| D21 | `captureServerError` unused in most routes | Grep evidence ~1 adoption | Defer | Adopt in new queue APIs only |
| D22 | Scheduled publishing not in vercel.json | `vercel.json` vs job route | **Fix within Phase 10** | Operator decision in 10.6 |
| D23 | Budget vs Discover dual SOT | `client_budgets` independent | Accept for Phase 10 | Track E scope |
| D24 | Goals dual SOT | `client_goals` vs Discover | Accept for Phase 10 | Don't automate merge |
| D25 | No normalized policy/investment tables | JSONB only | Accept | Track E defer |
| D26 | Virtual work queue not in UI yet | `lib/work-queue` domain complete 10.2 | **Fix within Phase 10** | 10.3 UI |
| D27 | Shared work-item types centralized | `lib/work-queue/types.ts` | **Fix within Phase 10** | Done in 10.2 |

---

## Must fix before Phase 10 implementation coding

None blocking **discovery**. Before **10.3 Adviser workflow** coding starts:

1. **Canonical servicing state query** — document mapping `relationship_stage` + `status` for queue filters (D01).
2. **Shared work-item type** — define in `lib/` without migration (D03, D16).

---

## Fix within Phase 10 (by checkpoint)

| Checkpoint | Debt IDs |
|------------|----------|
| 10.1 | D09 (doc inventory) |
| 10.2 | D01, D03, D16 (domain model) |
| 10.3 | D15 (notification persist decision) |
| 10.6 | D11, D12, D22 (ops panel, cron) |
| 10.7 | D02, D21 (logging in new routes) |

---

## Explicitly not a refactor programme

The following are **out of scope** for Phase 10:

- Full service-role to RLS migration (D06)
- Component splits over 1000 LOC (D07)
- Normalized financial schema (D23–D25)
- Repo-wide logger adoption (D21)
- Legacy Promotions Stage 6 schema drop (9F.4 observation)

---

## Blockers for specific tracks

| Track | Blocking debt |
|-------|---------------|
| A | D01, D15, D16 — addressable within phase |
| B | D01, D18, D20 — client visibility |
| E | D23, D24, D25 — **blocks Track E entirely** |
| G | D23, regulatory — **blocks implementation** |
