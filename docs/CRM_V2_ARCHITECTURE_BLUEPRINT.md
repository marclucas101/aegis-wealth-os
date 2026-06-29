# CRM V2 — Architecture Blueprint

**Phase:** 00  
**Branch:** `crm-v2-00-blueprint`  
**Date:** 2026-06-29  
**Status:** Definitive blueprint — implementation begins Phase 01

---

## 1. Executive summary

AEGIS Adviser CRM V2 is a **parallel adviser operating system** that unifies relationship management, engagement, advice workflows, and servicing under one navigation model. It **does not replace** existing authoritative backends on day one; it introduces a governed read/write layer, new canonical records only where gaps exist, and projections everywhere aggregation is needed.

CRM V2 builds on Phase 9 (compliance, Meeting Studio, binder, governed communications) and Phase 10.2 (virtual work queue). Legacy `/advisor` remains untouched until Phase 14 cutover.

---

## 2. Domain chain

```text
RELATIONSHIP          ENGAGEMENT           ADVICE              SERVICE
─────────────         ──────────           ──────              ───────
Who we serve    →     How we connect  →    What we plan   →    What we deliver
clients row           appointments         publications        commitments
(read model)          meeting sessions     roadmap             client requests
profile/moments       communications       binder              reviews
advocacy              timeline (proj.)     protection          work queue (proj.)
```

Each layer reads from authoritative sources below it. **Projections** (timeline, Today, work queue) never become authoritative.

---

## 3. Architectural principles

| # | Principle |
|---|-----------|
| P1 | **Single source of truth** per domain — extend existing tables before creating new ones |
| P2 | **Assignment-scoped access** — `clients.advisor_user_id` + `resolveAccessibleClient` |
| P3 | **Fail-closed feature gates** — all CRM V2 flags default disabled |
| P4 | **Pilot before book-wide** — operator-configured adviser allowlist |
| P5 | **Parallel portal** — `/advisor-v2` until cutover; `/advisor` unchanged until Phase 14 |
| P6 | **Client portal additive** — existing client routes gain capabilities via flags, not rewrites |
| P7 | **No prohibited scoring** — ethnicity, wealth, advocacy, premium size must not drive priority |
| P8 | **Adviser review for sensitive comms** — birthdays, festive greetings, batch outreach |
| P9 | **Immutable advocacy events** — yearly score is a derived view |
| P10 | **9F.4 observation continues** — no Promotions Stage 6 during CRM V2 rollout |

---

## 4. System context

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         ADVISER CRM V2 (new shell)                       │
│  /advisor-v2  →  Today | Relationships | Appointments | Service | ...   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ assignment-scoped APIs
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ clients       │     │ adviser_        │     │ service_         │
│ (relationship │     │ appointments    │     │ commitments      │
│  identity v1) │     │ (appointment    │     │ (new)            │
│               │     │  SOT)           │     │                  │
└───────────────┘     └────────┬────────┘     └──────────────────┘
        │                      │
        │              ┌───────▼────────┐
        │              │ meeting_       │
        │              │ sessions       │
        │              │ (linked, not   │
        │              │  competing ID) │
        │              └────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────────────┐
│ EXISTING AUTHORITATIVE LAYER (unchanged ownership)                     │
│ published_outputs · roadmap_items · advisor_tasks · documents          │
│ binder_exports · governed_content · discover_profiles · shield_scores  │
└───────────────────────────────────────────────────────────────────────┘
        │
┌───────▼───────────────────────────────────────────────────────────────┐
│ PROJECTION LAYER (read-only assembly)                                  │
│ engagement_timeline · AdviserWorkItem queue · Today dashboard          │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 5. Resolved architecture decisions

### 5.1 Relationship identity (Phase 02)

- **Phase 02–08:** `relationshipId = clients.id` (UUID). One client row = one relationship.
- **Household:** Not modeled in Phase 00–02. `householdName` in protection reports is display-only. Future optional `households` + `household_members` deferred to post-pilot operator decision.
- **Prospect vs client:** `relationship_stage` (Phase 9A canonical) drives lifecycle; legacy `clients.status` retained for compatibility reads only.

### 5.2 One authoritative appointment record (Phase 03)

- **Table:** Evolve existing `adviser_appointments` — do **not** create `crm_appointments`.
- **Identity:** Same row survives reschedule; `rescheduled_from_appointment_id` optional lineage column.
- **Lifecycle:** Extend status enum to CRM lifecycle (see §5.3). Map legacy `pending|confirmed|cancelled|completed|failed` during transition.
- **Meeting Studio:** `meeting_sessions.appointment_id` FK links session to appointment; session is not a competing appointment identity.
- **Google:** Existing `google_event_id`, `google_calendar_id`, `calendar_sync_status` retained; Phase 05 extends sync rules.

**Approved lifecycle states:**

```text
Primary:     requested → proposed → confirmed → preparing → ready
             → in_progress → follow_up_required → closed

Alternatives: awaiting_confirmation | rescheduled | cancelled_by_client
              | cancelled_by_adviser | no_show
```

### 5.3 One authoritative commitment/action record (Phase 06)

- **New table:** `service_commitments` (name approved in blueprint).
- **Types:** adviser_commitment, client_commitment, shared_commitment, client_service_request, document_request, review_workflow_step, appointment_preparation_item, appointment_follow_up_item.
- **Not authoritative:** work queue items, Today cards, timeline events.
- **Existing tasks:** `advisor_tasks` remain authoritative for general adviser tasks; explicit adapter links queue items to tasks. New CRM-native commitments use `service_commitments`. Operator may later unify via migration — not in initial scope.

### 5.4 Timeline / event projection (Phase 02+)

- **No** `engagement_events` authoritative table in initial rollout.
- Projection assembled from: `audit_logs` (filtered event types), `meeting_session_events`, appointment state transitions, `communication_deliveries`, commitment lifecycle, advocacy events, moment acknowledgements.
- Cached materialized view optional post-pilot for performance — not Phase 00–02.

### 5.5 Protection extraction and verification (Phase 07)

```text
Protection report generator (existing)
  → provisional protection_policy_versions (extraction_status = pending_review)
  → adviser verification queue
  → adviser confirms / corrects
  → confirmed version (extraction_status = confirmed)
  → portfolio summary (derived read model)
  → client simplified summary (client-visible subset)
```

- Unverified extraction **never** becomes authoritative.
- Existing PDF save to `documents` (`source_feature: advisor_protection_report`) remains; structured records are additive.
- Policy identifiers masked in ordinary list views.

### 5.6 Ethnicity-based holiday suggestions (Phase 08)

- **Storage:** `clients.ethnicity` enum (Chinese, Malay, Indian, Eurasian, Mixed, Other, Prefer not to say) — new column Phase 08.
- **Precedence:** `adviser_moment_overrides` → ethnicity mapping table → no suggestion (adviser override wins).
- **Prohibited:** advice, service priority, financial recommendations, risk scoring, sales targeting, work-queue urgency, Google Calendar client names/ethnicity.

### 5.7 Calendar-year advocacy scoring (Phase 09)

- **Storage:** `advocacy_events` — append-only, never deleted on year rollover.
- **Score:** Current calendar year sum: `SUM(points) WHERE event_date IN current_calendar_year AND eligible = true`, subject to category caps and max score config.
- **Prohibited uses:** advice, service quality ranking, appointment priority, product recommendations, adviser sales leaderboards.

### 5.8 Google Calendar ownership (Phase 05)

- **AEGIS authoritative** for appointment lifecycle and client-adviser booking rules.
- **Google** is a sync target: create/update/cancel event; preserve `google_event_id` mapping; record `calendar_sync_status`.
- **No** silent two-way overwrite of external edits in first release.
- **Aggregate reminders only** in Google for relationship moments (e.g. "Prepare CNY greetings — 27 relationships — Open AEGIS") — no client names or ethnicity in event text.

### 5.9 Communications integration (Phase 10)

- **Governed content** (`governed_content`) remains authoritative for published client communications.
- CRM produces **draft intents** (`crm_communication_drafts` or equivalent staging) → adviser review → creates/submits governed content or records manual contact.
- Birthday/festive flows require adviser approval; no auto-send from ethnicity alone.

### 5.10 Work queue / Today (Phase 11)

- Reuse `lib/work-queue/*` virtual assembly.
- Add adapters for: `service_commitments`, protection verification, advocacy thank-yous, relationship moments, Google sync failures.
- Today is a **layout projection** over the same sources — not a new table.

---

## 6. Naming conventions

| Context | Convention | Example |
|---------|------------|---------|
| User-facing UI, docs, routes | UK **adviser** | `/advisor-v2`, "Adviser CRM" |
| Database columns (existing) | US **advisor** (frozen) | `advisor_user_id`, `advisor_tasks` |
| New DB tables | **adviser** prefix where greenfield | `adviser_moment_overrides` |
| TypeScript modules | Match nearest layer | `advisorClientAccess.ts` (existing), `adviserWorkQueue.ts` (new) |
| API paths | `/api/advisor/**` (existing pattern) | V2 APIs under `/api/advisor-v2/**` |
| Feature flag keys | snake_case | `crm_v2_master` |

**Rule:** Do not rename existing `advisor_*` DB objects. New code uses "adviser" in user-visible strings only.

---

## 7. Integration with Phase 10 work queue

| Aspect | Decision |
|--------|----------|
| Queue identity | Virtual `AdviserWorkItem` — no `advisor_work_items` table |
| Dedup key | `(sourceType, sourceId, clientId)` per Phase 10.2 |
| CRM V2 routes | V2 `actionHref` allowlist extends to `/advisor-v2/**` in Phase 11 |
| Completion | Queue action navigates to source; completion mutates source record only |
| Flag | `adviser_work_queue` enabled only after CRM V2 Today ships (Phase 11) |

---

## 8. Phase 9F.4 protection

During CRM V2 rollout:

- **Continue** 30-day (or operator-extended) Promotions observation per `PHASE_9F4_OBSERVATION_PLAN.md`
- **Do not** begin Promotions Stage 6 schema retirement
- **Do not** re-enable `legacy_promotions_write` without operator approval
- CRM communications use `governed_content` — not `promotions`
- Monitor `legacy_promotions_retired_*` audit signals during pilot

---

## 9. What Phase 00 explicitly did not do

- No migrations created or applied
- No application routes modified
- No production code changed
- No feature flags activated remotely
- No deployment
- No Promotions Stage 6

---

## 10. Implementation entry (Phase 01)

First code checkpoint: parallel shell at `/advisor-v2` with `crm_v2_master` + `crm_v2_pilot_users` gates, placeholder pages, shared layout primitives. See [CRM_V2_ROUTE_MAP.md](./CRM_V2_ROUTE_MAP.md) and [CRM_V2_FEATURE_CONTROL_PLAN.md](./CRM_V2_FEATURE_CONTROL_PLAN.md).
