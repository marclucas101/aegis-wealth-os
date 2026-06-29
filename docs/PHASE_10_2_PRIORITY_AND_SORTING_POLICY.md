# Phase 10.2 — Priority and Sorting Policy

**Implementation:** `lib/work-queue/priority.ts`, `lib/work-queue/sorting.ts`

---

## Priority levels

| Level | Operational triggers |
|-------|---------------------|
| critical | blocking items; binder_generation_failed; overdue task/review; meeting_prep_missing |
| high | due_today; publish pending; meeting follow-up pending; review_due_soon; stale unpublished |
| normal | data gaps; open tasks; roadmap actions |
| low | informational (excluded from active queue in 10.2) |

---

## Forbidden prioritization factors

Priority must **not** derive from:

- Client wealth or AUM
- Expected sales or revenue
- Product opportunity scoring
- Adviser revenue
- Age or demographic targeting
- Shield Score alone
- Engagement manipulation or leaderboard rank

`prioritySortWeight` is an **internal deterministic sort key only** — not exposed as performance scoring.

---

## Sorting order

1. Actionable state before informational
2. Blocking before non-blocking (where applicable)
3. Priority weight (critical → low)
4. Timing (overdue → due_today → upcoming)
5. Due timestamp ascending
6. Updated timestamp descending
7. Deterministic `id` ascending (`localeCompare`)

Display name is **not** used as a sort key.

---

## Timing rules

- Uses caller-supplied `nowIso` and adviser timezone (`Asia/Singapore` default, per calendar settings pattern)
- Missing due date → `unscheduled` (never overdue)
- Completed sources excluded at adapter layer

---

## Unpublished draft aging

Draft `published_outputs` older than **14 days** (`WORK_QUEUE_LIMITS.unpublishedDraftAgingDays`) emit `planning_stale_unpublished`.
