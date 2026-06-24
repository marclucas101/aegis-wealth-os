# Phase 10 — Candidate Tracks Evaluation

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

Scoring: 1 = lowest/worst, 5 = highest/best. **Regulatory and security risk: lower is safer.**

---

## Track A — Adviser Operating Dashboard and Work Queue

Unified view: actions due, overdue items, upcoming meetings, annual reviews, incomplete data, unpublished outputs, document follow-ups, delivery failures.

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **5** | Directly addresses #1 journey gap — fragmented daily work across 4+ stores |
| Client value | **3** | Indirect — advisers free to publish and service clients faster |
| Operational impact | **5** | Converts disconnected records into actionable queue |
| Data readiness | **4** | Tasks, pipeline, file quality, appointments queryable; dedup rules needed |
| Regulatory risk | **2** | Operational UI; no new advice generation |
| Security risk | **2** | Adviser-scoped aggregation; reuse existing access gates |
| Implementation effort | **3** | Virtual queue + UI; optional notification persistence |
| Dependency complexity | **3** | Reads many services; no new financial schema |
| Reuse of existing platform | **5** | Command center, tasks, suggestions, pipeline already exist |
| Time to production value | **4** | Incremental shell over existing APIs achievable in early checkpoints |

**Total weighted priority: Highest**

---

## Track B — Client Progress and Action Centre

Client-facing: agreed priorities, actions, responsible party, due dates, progress, required documents, next meeting.

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **2** | Does not fix adviser operational fragmentation |
| Client value | **5** | Strong UX gap — scattered progress across nav |
| Operational impact | **3** | Reduces client support queries if adviser data complete |
| Data readiness | **2** | Depends on roadmap visibility, publications, consistent flags |
| Regulatory risk | **3** | Client-facing action display needs careful copy governance |
| Security risk | **2** | Client-scoped; existing RLS patterns |
| Implementation effort | **3** | New client hub page + APIs |
| Dependency complexity | **4** | Requires adviser publishing discipline first |
| Reuse of existing platform | **3** | Roadmap, notifications, appointments exist but fragmented |
| Time to production value | **3** | Blocked by adviser-side data completeness |

---

## Track C — Annual Review and Servicing Automation

Review due dates, preparation checklist, data-refresh requests, meeting workflow, updated outputs, binder, follow-up.

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **4** | High for review-heavy books |
| Client value | **3** | Review submissions exist; automation helps cadence |
| Operational impact | **4** | Addresses review pipeline bottleneck |
| Data readiness | **3** | Review dates exist; three parallel review artifacts confuse automation |
| Regulatory risk | **3** | Review cycle is compliance-sensitive |
| Security risk | **2** | Extends existing review-status patterns |
| Implementation effort | **4** | End-to-end cycle across meetings, outputs, binders |
| Dependency complexity | **4** | Touches many subsystems |
| Reuse of existing platform | **4** | Pipeline, publications, binder, goals-reviews |
| Time to production value | **3** | Narrower than Track A but deeper |

---

## Track D — Data Completeness and Next-Best-Action Engine

Rules-based (not generative): missing fields, policy documents, stale reviews, unassigned roadmap items, incomplete outputs.

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **4** | Strong suggestions — partially exists as computed suggestions |
| Client value | **2** | Adviser-facing primarily |
| Operational impact | **4** | Improves data quality across book |
| Data readiness | **3** | Safe rules on completeness OK; cross-domain rules blocked |
| Regulatory risk | **2** | Rules-based detection only — no advice |
| Security risk | **2** | Read-only analysis |
| Implementation effort | **3** | Extend `advisorTaskSuggestions.ts` |
| Dependency complexity | **2** | Mostly read paths |
| Reuse of existing platform | **5** | Suggestions engine exists |
| Time to production value | **4** | Can ship as queue filters under Track A |

**Note:** Best implemented as **component of Track A**, not standalone phase.

---

## Track E — Portfolio, Policy and Product Data Consolidation

Structured capture/import: insurance, investments, liabilities, premiums, beneficiaries, coverage, renewal dates.

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **4** | Long-term high — policies in JSONB only today |
| Client value | **3** | Better structured client record |
| Operational impact | **4** | Reduces spreadsheet tracking |
| Data readiness | **1** | No normalized schema; Discover JSONB not validated per field |
| Regulatory risk | **4** | Product data is compliance-heavy |
| Security risk | **3** | New data domains expand attack surface |
| Implementation effort | **5** | Large schema + import + UI |
| Dependency complexity | **5** | Migration, validation, dual-write period |
| Reuse of existing platform | **2** | Mostly net-new domain model |
| Time to production value | **1** | Long horizon |

---

## Track F — Production Operations and Reliability

Health dashboard, failure queues, operator diagnostics, retry workflows, support tools, release controls.

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **2** | Indirect |
| Client value | **1** | Minimal direct |
| Operational impact | **5** | Critical for scaling |
| Data readiness | **5** | Job runs, deliveries, flags already stored |
| Regulatory risk | **1** | Internal ops |
| Security risk | **2** | Admin-gated; must not expose PII in logs |
| Implementation effort | **3** | UI over existing APIs + logging adoption |
| Dependency complexity | **2** | Mostly presentation + wiring |
| Reuse of existing platform | **4** | Admin APIs exist |
| Time to production value | **4** | Ops panel achievable quickly |

**Note:** Important but **does not close end-to-end adviser workflow gap** alone.

---

## Track G — Adviser AI Copilot Discovery

Research-only: meeting-note structuring, document classification, draft summaries, missing-information detection. **Non-authoritative; no unreviewed financial advice.**

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Adviser value | **3** | Potential future; not proven in repo |
| Client value | **1** | None in discovery scope |
| Operational impact | **2** | Research phase only |
| Data readiness | **2** | Unreliable fields would poison detection |
| Regulatory risk | **5** | Highest — financial advice adjacent |
| Security risk | **4** | Third-party AI not approved in restrictions |
| Implementation effort | **2** | Discovery/docs only this phase |
| Dependency complexity | **4** | New service boundary if pursued later |
| Reuse of existing platform | **2** | Net-new |
| Time to production value | **1** | Not for Phase 10 implementation |

**Explicit boundary:** Track G remains **research-only**; no AI-generated financial recommendations; all outputs non-authoritative and adviser-reviewed if ever built.

---

## Summary score table

| Track | Adv | Client | Ops | Data | Reg↓ | Sec↓ | Eff↓ | Dep↓ | Reuse | TTPV | Rank |
|-------|-----|--------|-----|------|------|------|------|------|-------|------|------|
| **A** | 5 | 3 | 5 | 4 | 2 | 2 | 3 | 3 | 5 | 4 | **1** |
| B | 2 | 5 | 3 | 2 | 3 | 2 | 3 | 4 | 3 | 3 | 3 |
| C | 4 | 3 | 4 | 3 | 3 | 2 | 4 | 4 | 4 | 3 | 2 |
| D | 4 | 2 | 4 | 3 | 2 | 2 | 3 | 2 | 5 | 4 | (subset of A) |
| E | 4 | 3 | 4 | 1 | 4 | 3 | 5 | 5 | 2 | 1 | 6 |
| F | 2 | 1 | 5 | 5 | 1 | 2 | 3 | 2 | 4 | 4 | 4 |
| G | 3 | 1 | 2 | 2 | 5 | 4 | 2 | 4 | 2 | 1 | 7 (defer) |

---

## Explicit rejections / deferrals

| Track | Decision | Reason |
|-------|----------|--------|
| **A** | **SELECT** | Closes real end-to-end operational gap with highest reuse |
| B | Defer to 10.4 or Phase 11 | Client value high but blocked by adviser publishing discipline |
| C | Partial — ship as queue filters in A | Subset of unified dashboard; not standalone first |
| D | Merge into A | Suggestions engine exists; implement as queue rules not separate product |
| E | Defer dedicated phase | Data model not ready; large effort; regulatory weight |
| F | Parallel hardening in 10.6–10.7 | Critical but not primary workflow closure |
| G | Research-only deferral | Regulatory/security restrictions; no third-party AI this phase |
