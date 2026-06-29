# Phase 10.2 — Work Item Domain Model

**Checkpoint:** 10.2  
**Implementation:** `lib/work-queue/types.ts`, `lib/work-queue/sourceRegistry.ts`

---

## AdviserWorkItem

Canonical virtual work item for Phase 10.2. Fields are operationally minimal and safe for later API exposure.

| Field | Purpose |
|-------|---------|
| `id` | Deterministic `sourceType:sourceId` or `sourceType:sourceId:ruleKey` |
| `sourceType` / `sourceId` | Traceability to authoritative source |
| `clientId` / `clientDisplayName` | Scoped client context (display name only) |
| `category` | UI grouping (task, roadmap, review, meeting, planning, binder, data_quality, document) |
| `title` / `summary` | Human-readable; **not** used for identity |
| `actionOwner` | adviser, client, shared, system |
| `state` | actionable, blocked, waiting, informational, completed |
| `timing` | overdue, due_today, upcoming, unscheduled, not_applicable |
| `priority` | critical, high, normal, low (rules-based) |
| `dueAt` / `occurredAt` / `updatedAt` | ISO timestamps |
| `reasonCodes` | Explainable stable codes |
| `actionHref` | Allowlisted server-built route |
| `sourceStatus` | Raw source status string (diagnostic) |
| `blocking` / `dismissible` | UX flags (dismiss not persisted in 10.2) |
| `metadata` | `SafeWorkItemMetadata` allowlist only |

---

## Identity rules

1. Persisted sources: `id = sourceType + ":" + sourceId`
2. Computed items: append stable `ruleKey` (e.g. checklist item id)
3. Titles and summaries must never define identity
4. No financial amounts, NRIC, policy numbers, or raw document filenames

---

## Virtual queue

Phase 10.2 uses **read-only assembly** — no `advisor_work_items` table. Items are materialized per request from batch data via adapters (`assembleAdviserWorkQueue`).

Feature flag key reserved: `adviser_work_queue` (not activated).

---

## Assembly pipeline

```text
batch load → adapters → normalize → deduplicate → prioritize → sort → limit → result
```
