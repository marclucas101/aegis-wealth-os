# Phase 10 — Servicing and Workflow Audit

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

---

## Executive finding

AEGIS has **operational records but not a unified work queue**. Adviser daily work is spread across:

- `advisor_tasks` (persisted)
- `roadmap_items` (persisted, separate lifecycle)
- Review pipeline (computed from `clients`, scores, reviews)
- `meeting_sessions` (persisted, parallel)
- `advisor_task_suggestions` and `advisor_notifications` (**computed, not persisted**)
- `client_review_submissions` (client intake → spawns tasks)
- `client_notifications` (client persisted queue)

The command center **aggregates** these for display but does not enforce priority, SLA, or deduplication.

---

## Component audit

### Roadmap items

| Aspect | Detail |
|--------|--------|
| **Table** | `roadmap_items` |
| **APIs** | Client status POST; adviser CRUD on roadmap-actions |
| **Status transitions** | Engine + manual statuses; client can update only when `task_owner=client` and `client_visible=true` |
| **Overdue logic** | Stall detection in task suggestions — not persisted overdue flag |
| **Reassignment** | Adviser edits owner/visibility — no audit of reassignment chain |
| **Queue integration** | **Not in adviser task queue** unless manually duplicated |

### Meeting actions

| Aspect | Detail |
|--------|--------|
| **Table** | `meeting_sessions`, events; optional link to `advisor_tasks` via meeting workflow |
| **Outcome capture** | Session complete → may trigger summary publication |
| **Gap** | Post-meeting action items not auto-created as tasks |

### Review dates

| Aspect | Detail |
|--------|--------|
| **Fields** | `clients.next_review_due`, `clients.last_review_at`, `clients.status` |
| **Pipeline** | `advisorReviewPipeline.ts` — onboarding, active, review_due, overdue |
| **Gap** | `relationship_stage` not always aligned with review pipeline status |

### Appointments

| Aspect | Detail |
|--------|--------|
| **Table** | `adviser_appointments` |
| **Notifications** | Email with retry (`retryAppointmentNotification`) |
| **Gap** | No pre-meeting prep task auto-generation from upcoming appointment |

### Document events

| Aspect | Detail |
|--------|--------|
| **Lifecycle** | Upload/delete triggers `lifecycleNotificationService` → `client_notifications` |
| **Adviser queue** | Missing document categories appear in file quality / suggestions only |

### Notifications

| Persona | Persisted? | Mechanism |
|---------|------------|-----------|
| Client | Yes | `client_notifications` with idempotency (9F.2) |
| Adviser | **No** | Computed in `advisorNotifications.ts` each request |

### Follow-up tasks

| Aspect | Detail |
|--------|--------|
| **Table** | `advisor_tasks` — types: general, review, follow_up, document, roadmap, risk, client_birthday |
| **Idempotency** | `source_key` prevents duplicates |
| **Promotion** | Suggestions → tasks via explicit API call |
| **Completion sync** | Task complete may sync review submission status |

### Status transitions

| Entity | Transitions | Gap |
|--------|-------------|-----|
| Publications | draft → review → published → withdrawn | No adviser queue for aging drafts |
| Binder exports | generated → published → withdrawn | Failures in generation status |
| Meeting sessions | prepare → present → close | Not merged into task queue |
| Governed content | draft → submitted → approved → published | Admin queue only |

### Overdue logic

| Area | Exists? | Location |
|------|---------|----------|
| Review overdue | Yes | Review pipeline |
| Task due date | Yes | `advisor_tasks.due_date` |
| Roadmap overdue | Partial | Suggestions only |
| Document request overdue | No | — |
| Publication draft aging | No | — |
| Failed delivery retry | Partial | Manual admin API |

### Reassignment behavior

- Client adviser assignment: admin PATCH — updates access scope
- Roadmap task owner: adviser PATCH
- **No** bulk reassignment on adviser departure workflow

---

## Work queue requirements matrix

| Requirement | Current state | Gap severity |
|-------------|---------------|--------------|
| Today's priorities | Today panel + tasks — not ranked cross-source | **High** |
| Overdue client actions | Review pipeline + task due dates — separate views | **High** |
| Upcoming reviews | Pipeline panel | Medium |
| Missing documents | File quality / suggestions | Medium |
| Incomplete financial data | Discover completeness in suggestions | Medium |
| Unreviewed outputs | Planning outputs page per client — no book queue | **High** |
| Unsigned/unconfirmed actions | Not tracked | Medium |
| Expiring content | Governed content scheduling — admin only | Low |
| Failed deliveries | Admin API only — no adviser surfacing | Medium |
| Failed binder generation | Per-client binder panel | Medium |
| Blocked workflows | Feature flags — no operator dashboard UI | **High** |

---

## Real operational work queue?

**Verdict: No.** AEGIS has:

- ✅ Persisted adviser tasks with due dates
- ✅ Computed suggestions requiring manual promotion
- ✅ Review pipeline states
- ✅ Client notification queue
- ❌ Single prioritized inbox
- ❌ Cross-entity deduplication
- ❌ SLA/overdue engine across sources
- ❌ Persisted adviser alerts
- ❌ Book-level operational dashboard for management

---

## Servicing workflow diagram

```text
                    ┌─────────────────────┐
                    │  Advisor Command    │
                    │  Center (UI shell)  │
                    └─────────┬───────────┘
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   advisor_tasks      review_pipeline      task_suggestions
   (persisted)         (computed)           (computed)
          │                   │                   │
          ▼                   ▼                   ▼
   roadmap_items       meeting_sessions     file_quality
   (separate)           (separate)           (computed)
          │                   │
          └─────────┬─────────┘
                    ▼
              NO UNIFIED QUEUE
```

---

## Phase 10 implications

**Track A (Adviser Operating Dashboard and Work Queue)** directly addresses the highest-severity gaps without requiring new financial data models. Implementation should:

1. Define a **virtual work item** model aggregating existing sources (no big-bang new table in checkpoint 1).
2. Persist adviser notifications if SLA tracking required.
3. Add book-level queues for unpublished outputs and review due.
4. Surface failed binder/delivery states to adviser or admin ops view.

**Track C (Annual Review Automation)** is a subset that can ship as a queue filter once Track A foundation exists.
