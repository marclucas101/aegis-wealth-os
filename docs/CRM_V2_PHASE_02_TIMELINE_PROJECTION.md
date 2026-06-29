# CRM V2 — Phase 02 Timeline Projection

**Module:** `lib/crm-v2/relationships/timelineProjection.ts`  
**Entry:** `loadCrmTimelineProjection(clientId)`

---

## Design

Engagement is a **read projection** over authoritative sources. No `crm_timeline` or equivalent persistence table is created in Phase 02.

---

## Event identity

Deterministic IDs: `sourceType:sourceId`

Examples:

- `meeting_session:<uuid>`
- `adviser_appointment:<uuid>`
- `advisor_task:<uuid>`
- `published_output:<uuid>`
- `binder_export:<uuid>`
- `document:<uuid>`

---

## Sources (bounded)

| Source | Safe title rule |
|--------|-----------------|
| `meeting_sessions` | Meeting type + status — no JSONB payload |
| `adviser_appointments` | Title or generic label — no amounts |
| `advisor_tasks` | Task title + type/status |
| `published_outputs` | Output type label only |
| `binder_exports` | Published/generated status — no `storage_path` |
| `documents` | Category label — **not** filename |

---

## Excluded

- Raw audit log rows
- Private notes
- Message bodies
- Financial amounts
- Storage paths / signed URLs

---

## Sorting

Descending by `occurredAt`. Output capped at `CRM_V2_TIMELINE_MAX_ENTRIES` (50).

---

## Visibility classification

Each entry includes `visibility`: `adviser` | `client_visible` | `system` for adviser UI context only.
