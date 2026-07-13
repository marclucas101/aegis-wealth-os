# CRM V2 Phase 12 — Existing Reports and Operations Audit

**Branch:** `crm-v2-12-reports-operations`  
**Date:** 2026-07-13

---

## Summary

Phase 12 introduces projection-only Reports and Operations workspaces. No new reporting authority tables. Existing placeholders and partial operations surfaces are classified below.

**Confirmed:**

- Reports are **projection-only**.
- Operations are **projection-only**, except feature-control visibility from existing `platform_feature_controls` (read-only).
- No reporting table becomes a source of truth.
- No ranking, sales-priority, opportunity or advice table is created.

---

## Classification

| Source | Classification | Phase 12 action |
|--------|----------------|-----------------|
| `/advisor-v2/reports` placeholder | **New report projection required** | Replaced with `loadAdviserReportsProjection` |
| `/advisor-v2/operations` placeholder | **New operations projection required** | Replaced with `loadAdviserOperationsProjection` |
| `/advisor-v2/operations/google-calendar` partial page | **Reusable diagnostic source** | Gated by `crm_v2_operations`; reuses `loadGoogleCalendarIntegrationStatus` |
| Legacy `/advisor` dashboard reports | **Existing authority to retain** | Unchanged — not migrated |
| `platform_feature_controls` | **Reusable diagnostic source** | Read-only ops visibility |
| Phase 11 Today projection | **Reusable projection** | Operations Today source health |
| Phase 10.2 work queue | **Reusable projection** | Reports + Operations queue summaries |
| Google Calendar service status | **Reusable diagnostic source** | Safe counts only |
| Supabase diagnostics SQL | **Reusable diagnostic source** | Manual-runbook driven |
| Feature-control admin (platform) | **Existing authority to retain** | No new authority added |
| Migration runbooks | **Reusable diagnostic source** | Manual apply — no runtime CLI |
| Security check scripts | **Reusable diagnostic source** | Referenced in manual tests |
| `CrmV2FoundationPlaceholderPage` | **Compatibility projection** | Used when feature disabled |
| Promotions Stage 6 | **Rejected duplicate** | Not created — 9F.4 observation retained |
| `report_results` / ranking tables | **Rejected duplicate** | Not created |
| `operations_items` generic table | **Rejected duplicate** | Not created |
| Revenue / commission reports | **Deferred** | Out of CRM V2 scope |
| Book-wide admin CRM reports | **Deferred** | `admin_scope_deferred` |

---

## Module coverage

| Module | Reports | Operations |
|--------|---------|------------|
| Relationships | Safe counts | — |
| Appointments | Activity counts | — |
| Service | Commitments / requests | Exception counts |
| Protection | Verification status (no policy numbers) | Extraction errors |
| Review rhythm / moments | Due counts (no ethnicity) | — |
| Advocacy | Not ranked — no score in reports | — |
| Communications | Activity counts (no bodies) | Delivery failures |
| Google Calendar | Sync summary | Connection + sync health |
| Today | — | Source adapter health |
| Work queue | Virtual summary | Adapter health |
| Feature controls | Rollout status | Safe flag visibility |
| Migration | — | Manual-runbook status |

---

## Promotions Phase 9F.4

Promotions Stage 6 is **not** created. `legacy_promotions_write` remains disabled. Phase 9F.4 app-retirement observation documents are unchanged.
