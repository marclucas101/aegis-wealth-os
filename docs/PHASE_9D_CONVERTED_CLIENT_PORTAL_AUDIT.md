# Phase 9D — Converted Client Portal Audit

Audit date: 2026-06-20  
Branch: `phase-9d-converted-client-portal`

## Executive summary

Phase 9D replaces the legacy active-client experience (raw Shield dashboard, red-tier modules behind `raw_client_financial_views`) with an adviser-led, publication-gated portal. Prospects, advisers, and Meeting Studio remain unchanged.

---

## Feature audit matrix

| Feature | Current route | Current payload | Compliance class | Proposed client experience | Adviser-only elements | Publication required | Decision |
|---------|---------------|-----------------|------------------|---------------------------|----------------------|---------------------|----------|
| Dashboard | `/dashboard` | `ClientSafeEnvelope<FinancialReadinessSnapshot>` via `/api/dashboard/current` | Green (published) / Red (legacy raw) | **Financial Overview** — published `financial_overview` only | Raw shield, pillars, AWRI, stress | Yes (`financial_overview`) | **Redesign** — `ActiveClientFinancialOverviewClient` |
| Shield Diagnostic | `/shield-diagnostic` | Raw `DashboardSnapshot` when `raw_client_financial_views` | Red | Not available to active clients | All | N/A | **Retire** client access (dev flag only) |
| Stress Testing | `/stress-testing` | Raw stress engine output | Red | Not available (feature flag off) | All | Optional `stress_test_summary` (future) | **Retire** client access |
| Roadmap | `/roadmap` | Raw roadmap + shield projection | Red | Client/adviser task lists via `/api/client/roadmap` | Pillar scores, gaps, product tasks | Optional `roadmap_summary` | **Redesign** — safe DTO + `client_visible` items |
| Budget Optimiser | `/budget-optimiser` | Client-controlled draft + analysis | Green | Unchanged; safe surplus wording added | Adviser sees assigned client budget | No | **Preserve + improve** wording |
| Annual Review | `/annual-review` | Raw annual review snapshot | Red | Redirect → `/goals-reviews` | Scores, ratings, stress exposures | `annual_review_summary` for viewing | **Consolidate** into Goals & Reviews |
| Wealth Blueprint | `/wealth-blueprint` | Raw institutional report | Red | Redirect → `/my-plan` | Full report_data JSONB | `client_plan_summary` / legacy `wealth_blueprint_summary` | **Replace** with My Plan |
| Document Vault | `/document-vault` | `VaultDocumentRecord[]` | Green (visibility filtered) | Unchanged; client visibility enforced server-side | Internal/draft docs | Per-document visibility | **Preserve + improve** UI labels |
| My Adviser | `/my-adviser` | Adviser profile + appointments | Green | Unchanged | N/A | No | **Preserve** |
| Promotions | `/promotions` | Legacy campaigns | Amber | Hidden for active clients | Campaign manager | `insights_update` (Phase 9E) | **Retire** for active clients |
| Meeting Studio summaries | Adviser-only tables | Raw session + summary | Red | Published `meeting_summary` in `published_outputs` only | Sessions, events, notes | Yes + `meeting_summary_publication` flag | **Publish-only** client read |
| Discover | `/discover` | Form data | Green (prospect) | Not in active-client nav | N/A | No | **Prospect only** |

---

## API audit

| API | Client-safe? | Notes |
|-----|-------------|-------|
| `/api/dashboard/current` | Yes (envelope) | Prospects + fallback; active clients use `/api/client/financial-overview` |
| `/api/client/financial-overview` | Yes | Phase 9D — portal shell + published overview |
| `/api/client/my-plan` | Yes | Current publications only |
| `/api/client/roadmap` | Yes | No raw shield/roadmap engine |
| `/api/client/goals-reviews` | Yes | Goals + idempotent review submission |
| `/api/client/published-summaries` | Yes | Meeting + plan summaries |
| `/api/shield-diagnostic/current` | Fallback only | Blocked unless legacy flag |
| `/api/roadmap/current` | Raw (legacy) | Blocked for active clients; fallback envelope |

---

## Navigation change

**Before:** Full `NAV_SECTIONS` catalogue (Dashboard, Shield, Stress, Roadmap, Annual Review, Wealth Blueprint, Promotions, …)

**After (active_client):** `ACTIVE_CLIENT_NAV_SECTIONS` — Overview, My Plan, Roadmap, Budget, Goals & Reviews, Documents, My Adviser, Insights & Updates

Entitlements source: `getNavSectionsForEntitlements` in `lib/compliance/entitlements.ts`.

---

## Legacy retirement

- `raw_client_financial_views` remains available for dev/staging validation only; active-client features no longer depend on it.
- Raw dashboard fallback in `DashboardClient` remains for unauthenticated/local/demo paths only; active clients render `ActiveClientFinancialOverviewClient`.
- Promotions hidden for `active_client` (`features.promotions = false`).

---

## Deferred

- Full Insights authoring (Phase 9E)
- Document upload notification governance (Phase 9E)
- Beta rollout controls (Phase 9F)
