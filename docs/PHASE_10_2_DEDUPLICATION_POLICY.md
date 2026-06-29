# Phase 10.2 — Deduplication Policy

**Implementation:** `lib/work-queue/deduplication.ts`

---

## Principles

- Never deduplicate by title match alone
- Prefer explicit `related_entity` links (task → roadmap)
- Retain the most actionable item
- Emit `deduplicated_related_source` reason code
- Do not mutate source records

---

## Rule 1 — Task linked to roadmap item

When `advisor_task.metadata.relatedSourceType` references roadmap and `relatedSourceId` matches `roadmap_item.id`, keep the higher-actionability item (task preferred on tie-break via score).

## Rule 2 — Appointment + meeting preparation

When `meeting_follow_up` with `meeting_prep_missing` shares `metadata.appointmentId` with an `appointment` item, keep the preparation item (more actionable).

## Rule 3 — Review due + nearby appointment

When `review_due` and `appointment` for same client have due dates within 3 days, keep higher-actionability item (typically review_due).

## Rule 4 — Planning output + binder failure

When `planning_output` awaiting publish and `binder_export` failed for same client, keep binder failure if planning is publish-pending (blocking generation).

## Rule 5 — Duplicate completeness signals

One item per `(clientId, sourceType, checklistItemId)` for data_completeness and document_follow_up.

---

## Related metadata

Winning items may include `metadata.deduplicatedSourceIds` listing merged virtual ids.
