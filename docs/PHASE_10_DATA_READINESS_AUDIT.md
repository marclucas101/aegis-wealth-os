# Phase 10 — Data Readiness Audit

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

---

## Design principle

**Discover JSONB (`discover_profiles.form_data`) is the authoritative financial profile** for onboarding and scoring. Derived tables snapshot scoring outputs. Several parallel silos exist (budget, client goals, review submissions) without sync.

**Phase 10 dependency rule:** Do not build automation on fields that lack a single authoritative source and validation path.

---

## Domain inventory

| Domain | Authoritative table/column | Input route | Who may edit | Validation | Completeness | Versioning | History | Client visibility | Adviser visibility | Duplicate representation | SOT rules | Phase 10 safe? |
|--------|---------------------------|-------------|--------------|------------|--------------|------------|---------|-------------------|-------------------|-------------------------|-----------|----------------|
| Household identity | `clients` + `discover_profiles.form_data.personal/family` | Discover save, admin create | Client (Discover), admin (clients), adviser (DOB only via `PATCH .../personal`) | Discover section validators | `discover_profiles.completeness` | `is_current` on discover row; version frozen at 1 | Prior discover rows demoted | Name/email via profile | Full | `client_profiles` denormalized | Discover wins for financial identity | **Partial** — adviser cannot edit household without client |
| Dependants | `discover_profiles.form_data.family` | Discover save | Client | Section schema | In completeness | Same as discover | Demoted rows | Indirect via published summaries | Full | — | Discover | **Yes** for read automation; **No** for adviser-edit automation |
| Employment and income | `discover_profiles.form_data.income` | Discover save | Client | Section schema | In completeness | is_current | Demoted | Published overview only | Full | `client_profiles.annual_income`, `client_budgets` | Discover authoritative | **Partial** — budget silo |
| Cash flow | `discover_profiles.form_data.expenses` + `client_budgets` | Discover + budget optimiser | Client | Separate validators | Both tracked independently | Budget history table | Budget history | Budget page | Full discover | **Dual SOT — critical gap** | None reconciled | **No** for cross-domain cash-flow automation |
| Assets | `discover_profiles.form_data.assets` | Discover save | Client | Section schema | In completeness | is_current | Demoted | Published summaries | Full | `financial_profiles.profile_data` | Discover | **Yes** read-only rules |
| Liabilities | `discover_profiles.form_data.liabilities` | Discover save | Client | Section schema | In completeness | is_current | Demoted | Published summaries | Full | `financial_profiles.total_debt` | Discover | **Yes** read-only |
| Insurance policies | `discover_profiles.form_data.policies` | Discover save | Client | Section schema | In completeness | is_current | Demoted | Not directly — vault docs | Full | Vault `insurance_policy` docs | Discover JSONB; docs supplementary | **Partial** — no normalized policy table |
| Protection coverage | Derived from policies + scoring | Discover save triggers scoring | System | Scoring engine v1 | Via shield/protect pillar | `shield_scores.is_current` | stress_tests history | Governed outputs | Full diagnostic | Protection report PDF | Scoring snapshot | **Yes** for stale detection only |
| Goals | **`client_goals`** (active) + Discover `retirementGoals` | `/api/client/goals-reviews`, Discover | Client | Goals API validation | Per goal row | Row-level CRUD | No version chain | `/goals-reviews` | Read via publications | **Dual — not synced** | Separate domains | **No** for unified goal automation |
| Priorities | `published_outputs` (`goal_plan_summary`), roadmap | Adviser publications/roadmap | Adviser | Publication workflow | On publish | Publication supersession | Withdraw history | When published | Full | Roadmap items | Publications for client view | **Yes** when published |
| Risk profile | `shield_scores`, `pillar_scores` | Discover/scoring chain | System | score_version v1 | On score run | is_current | Prior scores kept | Snapshot only | Full | — | Scoring tables | **Yes** read-only |
| Estate information | `discover_profiles.form_data.estate`, `.business` | Discover save | Client | Section schema | In completeness | is_current | Demoted | Published if included | Full | — | Discover | **Yes** read-only |
| Documents | `documents` + storage bucket | Client/adviser upload APIs | Client (own), adviser (assigned) | Category mapping | File metadata | Row status | Soft delete/archive | Vault | Full | — | documents table | **Yes** |
| Meeting outcomes | `meeting_sessions`, `meeting_session_events`, `published_outputs.meeting_summary` | Meeting Studio | Adviser | Workflow stages | Session status | Event log | Full event history | Published summary | Full | adviser_notes may duplicate | Session + publication | **Partial** — notes not structured |
| Roadmap actions | `roadmap_items` | Scoring engine + adviser CRUD | Adviser create; client status if visible | owner/visibility rules | Per item | Updated_at | Status history limited | If `client_visible` | Full | advisor_tasks may duplicate | roadmap_items | **Yes** with visibility flags |
| Review dates | `clients.next_review_due`, `clients.status`, `annual_reviews` | Adviser review-status PATCH, scoring | Adviser/admin | Pipeline enums | Computed servicing state | annual_reviews yearly upsert | annual_reviews rows | Indirect | Full pipeline | `relationship_stage` parallel | **Dual lifecycle — gap** | **Partial** |

---

## Completeness mechanisms

| Mechanism | Location | Reliable for automation? |
|-----------|----------|--------------------------|
| Discover section scores | `discover_profiles.completeness` | **Yes** for missing-section detection |
| File quality checklist | `lib/supabase/clientFileQuality.ts` | **Yes** — used in command center |
| Prospect submit minimum | `prospectSubmission.ts` — personal/income/expenses only | **No** for full profile automation |
| Publication prerequisites | `planningOutputPreparation.ts` | **Yes** for output prep hints |
| Binder readiness | `binderReadinessService.ts` | **Yes** for pack generation |

---

## Source-of-truth integrity issues

### Must not automate across (without remediation)

1. **Cash flow:** Discover expenses vs `client_budgets`
2. **Goals:** Discover retirement goals vs `client_goals`
3. **Review artifacts:** `client_review_submissions` vs `annual_reviews` vs published summaries
4. **Client lifecycle:** `clients.status` vs `relationship_stage`
5. **Adviser work:** `advisor_tasks` vs `roadmap_items` without linkage

### Safe for Phase 10 rules-based detection (Track D subset)

- Missing Discover sections (completeness scores)
- Missing document categories (file quality)
- Stale shield score (date threshold)
- Unpublished planning outputs (draft age)
- Review due/overdue (`next_review_due`, pipeline)
- Failed binder exports / deliveries (status fields)
- Incomplete onboarding (relationship_stage + completeness)

### Not safe for automation yet

- Premium/coverage calculations from policies JSONB
- Investment performance tracking
- Cross-domain surplus calculations (budget vs discover)
- AI inference on financial fields

---

## Phase 10 data dependency assessment

| Track | Data readiness |
|-------|----------------|
| A — Adviser work queue | **Ready** — tasks, review pipeline, file quality, appointments have queryable fields |
| B — Client action centre | **Partial** — requires consistent roadmap visibility and publications |
| C — Annual review automation | **Partial** — review dates exist; preparation checklist data fragmented |
| D — Next-best-action engine | **Partial** — rules on completeness OK; cross-domain rules blocked |
| E — Portfolio/policy consolidation | **Not ready** — requires new normalized schema |
| F — Production ops | **Ready** — job runs, deliveries, binder status exist |
| G — AI copilot discovery | **Research only** — must not depend on unreliable fields |

---

## Recommendations for Phase 10 implementation

1. **Use existing completeness and file-quality signals** — do not invent new scoring.
2. **Do not merge budget and discover** in Phase 10 — document as known limitation.
3. **Link tasks to roadmap items** if work queue unification proceeds (schema addition in later checkpoint).
4. **Treat published_outputs as client SOT** for all client-facing plan content.
5. **Defer normalized policy/investment tables** to Track E as separate phase.
