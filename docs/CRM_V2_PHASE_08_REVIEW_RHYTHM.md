# CRM V2 Phase 08 — Review Rhythm

**Table:** `crm_review_rhythm`  
**Feature key:** `crm_v2_relationship_moments` (adviser moments workspace)  
**Rule:** Extends `clients.next_review_due` authority — does **not** duplicate `annual_reviews`.

---

## 1. Problem statement

Advisers need a CRM V2-native view of review cadence per relationship (scheduled, overdue, paused, completed) with optional appointment linkage and client visibility flags. The platform already stores:

- `clients.last_review_at` — when the last review occurred
- `clients.next_review_due` — when the next review is due
- `annual_reviews` — yearly **output snapshots** (scores, generated content)

Phase 08 adds `crm_review_rhythm` as a **projection and enrichment layer**, not a replacement for client columns or annual review artefacts.

---

## 2. Authority model

| Record | Role | Mutations |
|--------|------|-----------|
| `clients.next_review_due` | **Platform authority** for due date on client record | Legacy review pipeline + adviser client personal workflows |
| `clients.last_review_at` | **Platform authority** for last completed review timestamp | Same |
| `annual_reviews` | **Authoritative** yearly review outputs | Annual review generator — unchanged |
| `crm_review_rhythm` | **CRM V2 projection** with cadence metadata, status, visibility | Moments workspace PATCH; seeds from client record |

```text
clients.next_review_due (authority)
        │
        ▼ (read on first PATCH — lazy create)
crm_review_rhythm.annual_review row
        │
        ├── adviser moments workspace (Review Rhythm view)
        ├── work-queue crmReviewRhythmAdapter
        └── relationship_moment_events (audit)
```

**Explicit non-goal:** Phase 08 does not copy `annual_reviews` rows into `crm_review_rhythm` or generate review content from rhythm rows.

---

## 3. Schema

| Column | Purpose |
|--------|---------|
| `review_type` | `annual_review`, `semi_annual_review`, `quarterly_review`, `ad_hoc_review`, `protection_review`, `service_review`, `planning_review` |
| `cadence` | `annual`, `semi_annual`, `quarterly`, `ad_hoc` |
| `next_due_date` | Operational due date (seeded from `clients.next_review_due`) |
| `last_completed_date` | Last completion (seeded from `clients.last_review_at`) |
| `status` | `scheduled`, `overdue`, `completed`, `paused` |
| `client_visibility` | Whether client may see cadence in preferences (default false) |
| `linked_appointment_id` | Optional FK → `adviser_appointments` |
| `source_type` | `client_record`, `manual`, `moment`, `service_request` |
| Unique | `(client_id, review_type)` — one row per review type per client |

Index: `(assigned_adviser_user_id, next_due_date)` WHERE status IN (`scheduled`, `overdue`).

---

## 4. Lazy initialization

`updateReviewRhythm()` in `lib/crm-v2/moments/moments.ts`:

1. Resolve assignment via `resolveAccessibleClient`
2. Look up existing `annual_review` row for client
3. If none: **INSERT** with:
   - `next_due_date` ← `payload.nextDueDate` ?? `client.next_review_due`
   - `last_completed_date` ← `payload.lastCompletedDate` ?? `client.last_review_at`
   - `source_type` = `client_record`
   - `status` ← `computeReviewStatus(next_due_date)`
4. If exists: optimistic concurrency via `expectedVersion`

First PATCH without prior row does not require `expectedVersion`; subsequent updates require it.

---

## 5. Status transitions

Module: `lib/crm-v2/moments/lifecycle.ts`

| From | Allowed to |
|------|------------|
| `scheduled` | `overdue`, `completed`, `paused` |
| `overdue` | `completed`, `paused`, `scheduled` |
| `completed` | `scheduled` |
| `paused` | `scheduled` |

`computeReviewStatus(nextDueDate)` derives `overdue` vs `scheduled` from calendar comparison at read time.

---

## 6. API surface

| Method | Route | Response |
|--------|-------|----------|
| GET | `/api/advisor-v2/relationships/[id]/review-rhythm` | `{ ok, reviewRhythm: AdviserReviewRhythmDto[] }` |
| PATCH | `/api/advisor-v2/relationships/[id]/review-rhythm` | `{ ok, reviewRhythm: AdviserReviewRhythmDto }` |

PATCH body (`UpdateReviewRhythmInput`): optional `cadence`, `nextDueDate`, `lastCompletedDate`, `status`, `clientVisibility`; `expectedVersion` required when row exists.

---

## 7. Client review requests

Clients request reviews via:

- `POST /api/preferences/review-request` — creates `client_service_requests` with `request_category = review_request` (Phase 06 authority)
- Requires `crm_v2_client_profile` + `crm_v2_client_service` for service request write path

This does **not** auto-update `crm_review_rhythm` or `clients.next_review_due`; adviser processes request in Service workspace.

---

## 8. Relationship 360 integration

Overview tab continues to show review status from `clients.next_review_due` via `readModel.ts` (`isReviewDue`, "Review due" / "Review current" labels).

Moments workspace Review Rhythm view shows structured `crm_review_rhythm` rows with versioned updates and appointment links.

Engagement link: `loadCrmMomentsEngagementSummary()` includes active review cadence count.

---

## 9. Work queue projection

`crmReviewRhythmAdapter`:

- Source: `crm_review_rhythm` rows with status `scheduled` or `overdue`
- Category: `review`
- Priority: `normal` (fixed — no wealth or ethnicity weighting)
- `actionHref`: `/advisor-v2/relationships/{clientId}/moments?view=review_rhythm`
- Read-only — no complete/dismiss mutation from queue

---

## 10. Distinction from Service workspace Reviews

| Surface | Data source | Purpose |
|---------|-------------|---------|
| `/advisor-v2/service/reviews` | `clients.next_review_due` pipeline (Phase 06) | Book-wide due/overdue list |
| Moments Review Rhythm view | `crm_review_rhythm` per relationship | Per-client cadence management |

Both are valid projections; neither duplicates `annual_reviews`.

---

## 11. Future sync (deferred)

Bi-directional write-back from `crm_review_rhythm.next_due_date` → `clients.next_review_due` may be added in a later phase with explicit operator approval. Phase 08 documents the read-seed pattern only.
