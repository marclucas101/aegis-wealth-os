# Phase 10.2 — Servicing State Mapping

**Implementation:** `lib/work-queue/servicingState.ts`

---

## Canonical type

```ts
type CanonicalServicingState =
  | "prospect"
  | "onboarding"
  | "active"
  | "paused"
  | "former"
  | "unknown";
```

Derived from repository enums:

- `clients.status`: prospect, onboarding, active, review_due, archived
- `clients.relationship_stage`: prospect, fact_find_complete, adviser_review, meeting_scheduled, recommendation_prepared, active_client, inactive_client

---

## Precedence rules

When `status` and `relationship_stage` disagree, `resolveCanonicalServicingState` applies:

| Order | Condition | Canonical | Conflict? |
|-------|-----------|-----------|-----------|
| 1 | `status = archived` | former | If stage is active_client |
| 2 | `relationship_stage = inactive_client` | former or paused | paused if status still active/review_due |
| 3 | `status = prospect` OR stage = prospect | prospect | unknown if stage is active_client |
| 4 | `status = onboarding` OR pre-active stages | onboarding | If stage is active_client while status not onboarding |
| 5 | `status ∈ {active, review_due}` OR stage = active_client | active | unknown on hard conflicts |
| 6 | Unrecognized combination | unknown | yes |

Pre-active stages: fact_find_complete, adviser_review, meeting_scheduled, recommendation_prepared.

---

## Backfill reference (migration evidence)

| status | relationship_stage (backfill) |
|--------|-------------------------------|
| prospect | prospect |
| onboarding | fact_find_complete |
| active / review_due | active_client |
| archived | inactive_client |

---

## Usage in work queue

- Review-due items only generated when canonical ∈ {active, onboarding}
- Raw `status` and `relationship_stage` preserved on `ServicingStateResult` for diagnostics
- **No database mutation or backfill** in this module

---

## Tests

Unit tests in `lib/work-queue/workQueueUnitTests.ts` cover all documented combinations.
