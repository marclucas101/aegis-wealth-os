# Phase 10 — Implementation Recommendation

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  
**Verdict:** READY FOR PHASE 10 IMPLEMENTATION DESIGN

---

## 1. Selected Phase 10 track

**Track A — Adviser Operating Dashboard and Work Queue**

With **Track D merged as rules-based queue filters** (not generative) and **minimal Track F ops surfaces** in later checkpoints.

---

## 2. Business and user problem

Advisers using AEGIS after Phases 9A–9F have powerful per-client tools (Meeting Studio, planning outputs, binder, document vault, tasks) but **no single place to answer: "What must I do today across my book?"**

Work is fragmented across:

- `advisor_tasks`
- Computed task suggestions (not persisted)
- Review pipeline states
- Roadmap items
- Meeting sessions and appointments
- Unpublished planning outputs and failed binder generations

This forces advisers to maintain **external trackers, spreadsheets, or mental queues** — undermining the investment in governed workflows and client portal publication.

---

## 3. Evidence from repository and workflows

| Evidence | Source |
|----------|--------|
| Command center aggregates but does not prioritize | `lib/supabase/advisorCommandCenter.ts` |
| Adviser notifications computed not persisted | `lib/supabase/advisorNotifications.ts` |
| Suggestions require manual promotion | `advisorTaskSuggestions.ts`, create-task API |
| Journey gap analysis | `docs/PHASE_10_ADVISER_JOURNEY_AUDIT.md` |
| No unified queue table | `docs/PHASE_10_SERVICING_AND_WORKFLOW_AUDIT.md` |
| Data ready for queue rules | `docs/PHASE_10_DATA_READINESS_AUDIT.md` |
| Track scoring | `docs/PHASE_10_CANDIDATE_TRACKS.md` |

---

## 4. Personas served

| Persona | Benefit |
|---------|---------|
| **Adviser** | Primary — daily prioritized work list |
| **Admin** | Secondary — book-level ops via extended panel (10.6) |
| **Client** | Indirect — faster adviser follow-through on publications and reviews |

---

## 5. In-scope capabilities

- **Unified work queue API** aggregating: tasks, overdue reviews, upcoming appointments, incomplete discover/file-quality items, unpublished outputs (draft aging), document follow-ups, failed binder/delivery states (adviser-visible subset)
- **Advisor OS queue panel** replacing/supplementing scattered Today/Tasks/Suggestions panels with deduplicated prioritized list
- **Per-client queue tab** on client overview showing all open work items for that client
- **Rules-based next-best-action filters** (Track D subset): missing sections, stale reviews, unassigned visible roadmap items
- **Optional:** persist high-priority adviser notifications for SLA tracking (architectural decision in 10.2)
- **Admin ops read panel (10.6):** feature flags, job runs, delivery failures — API-backed, no new vendor

---

## 6. Explicit exclusions

- No new migrations in discovery checkpoint (implementation checkpoints only, operator-approved)
- No AI-generated financial recommendations (Track G research deferred)
- No scoring formula changes
- No Promotions Stage 6 schema retirement (9F.4 observation continues)
- No normalized portfolio/policy schema (Track E deferred)
- No client Action Centre as primary deliverable (Track B → 10.4 or Phase 11)
- No adviser ranking or performance league tables
- No third-party observability vendor
- No activation of disabled feature flags without operator sign-off
- No standalone annual review automation product (Track C → filters within queue)

---

## 7. Data dependencies

| Dependency | Ready? | Notes |
|------------|--------|-------|
| `advisor_tasks` | Yes | Core queue source |
| Review pipeline | Yes | Canonicalize status query (D01) |
| File quality / discover completeness | Yes | Rules only |
| `adviser_appointments` | Yes | Upcoming meetings |
| `published_outputs` draft state | Yes | Unpublished aging |
| `binder_exports` status | Yes | Failure surfacing |
| `roadmap_items` | Partial | Visibility flags affect client-facing rules |
| Cash flow / goals dual SOT | No | Exclude from cross-domain rules |

---

## 8. Security and compliance boundaries

- All queue items **adviser-scoped** via existing `resolveAccessibleClient` and assignment checks
- Admin ops panel **read-only** for flags/jobs/deliveries — no client financial fields in aggregates
- Queue items surface **operational metadata** only — not raw discover JSONB in list views
- Rules-based suggestions labeled **non-advice** — same as existing task suggestions
- Audit log on queue actions (complete, snooze, dismiss if implemented)
- Track G remains out of scope — no LLM processing of client financial data

---

## 9. Proposed architecture

```text
┌─────────────────────────────────────────────────────────┐
│              Advisor OS / Client Overview UI             │
│         WorkQueuePanel · ClientWorkQueuePanel            │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│           lib/workQueue/workQueueService.ts              │
│   aggregate · dedupe · prioritize · canonicalize status  │
└─────────────────────────┬───────────────────────────────┘
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   advisorTasks    reviewPipeline    taskSuggestions
   roadmapItems    appointments      fileQuality
   publications    binderExports     (read-only adapters)
```

- **Virtual work item** type — no mandatory new table in 10.2; optional `advisor_work_queue_snapshots` defer
- **Adapters** per source — read-only, no change to source-of-truth tables initially
- **Dedup key** — `(source, source_id, client_id)` 
- **Priority rules** — configurable constants, not ML

---

## 10. Proposed checkpoints

| Checkpoint | Scope | Reversible |
|------------|-------|------------|
| **10.1** | Discovery audits (this checkpoint) | Yes — docs only |
| **10.2** | Work item domain model + adapters + canonical status mapping | Yes — feature flag `adviser_work_queue` default off |
| **10.3** | Adviser book-level queue UI on `/advisor` | Yes — flag off |
| **10.4** | Per-client queue on client overview | Yes — flag off |
| **10.5** | Rules-based filters + optional notification persist | Yes — flag off |
| **10.6** | Admin ops panel (flags, jobs, deliveries) + cron doc update | Yes — read-only panel |
| **10.7** | Security hardening + logging on new routes | Yes |
| **10.8** | Production acceptance + manual tests | Rollback via flag |

---

## 11. Migration expectations

| Checkpoint | Migration expected? |
|------------|---------------------|
| 10.1 Discovery | **None** |
| 10.2 | **Optional** — only if notification persistence approved (`advisor_notification_log` or similar); otherwise **zero migration** |
| 10.3–10.5 | **None** if virtual queue only |
| 10.6 | **None** — UI over existing tables |
| Later | Index migration possible for queue query performance — operator-reviewed |

**Discovery checkpoint creates no migration.**

---

## 12. Feature-control strategy

- New flag: `adviser_work_queue` — default **false**
- Existing flags unchanged: `binder_client_publication`, `legacy_promotions_write`, etc.
- Enable sequence: staging → adviser pilot → book-wide
- Admin ops panel uses existing `platform_feature_controls` API

---

## 13. Manual acceptance plan

1. Assign test adviser with 5+ clients in mixed states (onboarding, review due, open tasks)
2. Verify queue deduplicates task vs suggestion for same client/issue
3. Verify adviser A cannot see adviser B queue items
4. Verify unpublished output appears with correct age band
5. Verify failed binder appears in queue with retry link
6. Verify no client financial amounts in queue list API
7. Verify flag off → legacy command center unchanged
8. Run full QA suite including `qa:phase10-discovery` + security scripts

Document in `docs/PHASE_10_MANUAL_ACCEPTANCE_TESTS.md` at implementation start.

---

## 14. Rollback strategy

1. Set `adviser_work_queue` feature flag **false**
2. UI reverts to existing command center panels (no code deploy rollback required if flag-gated)
3. If notification persistence added: stop writes; table retained
4. No schema retirement in Phase 10

---

## 15. Success metrics

| Metric | Target |
|--------|--------|
| Adviser weekly active use of queue panel | Operator-defined pilot threshold |
| Reduction in duplicate tasks for same issue | Qualitative pilot feedback |
| Time to identify review-due clients | < 30 seconds from `/advisor` |
| Unpublished output aging visibility | 100% of drafts > 14 days visible in queue (pilot book) |
| Zero cross-adviser data leaks | Security test pass |
| No increase in 500 rate on command center routes | Monitoring |

---

## 16. Risks

| Risk | Mitigation |
|------|------------|
| Dual status enums cause wrong queue filters | Canonical mapping in 10.2 |
| Queue overload — too many items | Priority bands + default filters |
| Performance on large books | Shell/heavy split pattern; indexes in 10.7 |
| Adviser ignores queue like suggestions | Persist dismissals; operator training |
| Scope creep into Track B/C/E | Explicit exclusions enforced per checkpoint |

---

## 17. Why alternative tracks were not selected

| Track | Rejection rationale |
|-------|---------------------|
| **B — Client Action Centre** | High client value but **depends on adviser publishing discipline**; does not fix root operational fragmentation; defer to 10.4/Phase 11 after queue drives publish workflow |
| **C — Annual Review Automation** | Valuable subset ** absorbed as queue filters** (review due, prep checklist); standalone cycle too narrow for first Phase 10 |
| **D — Next-Best-Action Engine** | **Merged into Track A** — suggestions already exist; needs queue container not separate product |
| **E — Portfolio/Policy Consolidation** | **Data not ready** (JSONB only); large schema effort; regulatory weight; defer dedicated phase |
| **F — Production Ops** | **Critical but insufficient alone** — does not close adviser workflow gap; ship ops panel as 10.6 within Track A |
| **G — AI Copilot** | **Regulatory/security restrictions**; no third-party AI; non-authoritative research only; defer |

---

## Phase 10 checkpoint sequence (recommended)

```text
10.1 Existing-system and data audit          ← THIS CHECKPOINT (complete)
10.2 Core domain model (work item + adapters)
10.3 Adviser workflow (book-level queue UI)
10.4 Client workflow (per-client queue only — not full Action Centre)
10.5 Notifications and lifecycle (queue filters + optional persist)
10.6 Reporting and operations (admin ops panel, cron documentation)
10.7 Security hardening (access tests, logging on new routes)
10.8 Production acceptance
```

Each checkpoint is independently reviewable and reversible via feature flag.

---

## Operator decisions required

1. Approve **Track A** as Phase 10 implementation scope
2. Confirm **9F.4 observation** continues — no Promotions Stage 6
3. Decide whether to **persist adviser notifications** in 10.2 (optional migration)
4. Approve **admin ops panel** scope in 10.6
5. Confirm **Track B** timing (Phase 10.4 minimal vs Phase 11 full Action Centre)
6. Reject or defer **Track G** AI discovery to separate research spike

---

## Confirmation

This discovery checkpoint:

- ✅ Created audit documentation only
- ✅ Created QA validation script only
- ❌ Did not create or apply migrations
- ❌ Did not modify remote data
- ❌ Did not deploy
- ❌ Did not activate feature controls
- ❌ Did not delete legacy schema
- ❌ Did not begin Promotions Stage 6
