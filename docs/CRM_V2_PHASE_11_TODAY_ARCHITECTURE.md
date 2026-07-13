# CRM V2 Phase 11 — Today Architecture

**Phase:** 11  
**Route:** `/advisor-v2/today`  
**Feature key:** `crm_v2_today`

---

## 1. Operating model

```text
authoritative CRM source
  → safe Today projection (server-only)
  → adviser action card (DTO)
  → route back to authoritative workflow
```

Today must not become a new source of truth.

---

## 2. Components

| Layer | Location | Role |
|-------|----------|------|
| Projection service | `lib/crm-v2/today/projection.ts` | Assembles sections from adapters |
| Work queue adapter | `lib/crm-v2/today/sourceAdapters/workQueueAdapter.ts` | Maps virtual queue items to cards |
| Google Calendar adapter | `lib/crm-v2/today/sourceAdapters/googleCalendarAdapter.ts` | Connection/sync status cards |
| Work queue panel | `lib/crm-v2/today/workQueuePanel.ts` | Optional read-only summary |
| API | `GET /api/advisor-v2/today` | Safe DTO response |
| Section API | `GET /api/advisor-v2/today/section/[sectionKey]` | Bounded section load |
| Work queue API | `GET /api/advisor-v2/work-queue` | Virtual queue (flag-gated) |
| UI | `app/advisor-v2/today/page.tsx` | Sectioned dashboard |

---

## 3. Feature controls

| Key | Default | Scope |
|-----|---------|-------|
| `crm_v2_today` | false | Today workspace |
| `adviser_work_queue` | false | Work queue panel + API |

Both require `crm_v2_master` + `crm_v2_pilot_mode` + pilot allowlist.

---

## 4. Sections

Schedule, Prepare, Client Requests, Follow-ups, Service Due, Reviews, Protection, Communications, Relationship Moments, Sync and Operations, Recently Completed.

---

## 5. Failure isolation

Each source adapter runs in isolated try/catch. Partial failures populate `sourceFailures` without collapsing the dashboard.

---

## 6. Performance

- Bounded cards per section (12) and total (80).
- No per-card API requests from UI.
- No Google provider API calls on Today read.
- `private, no-store` on all routes.

---

## 7. Rejected patterns

- Persisted Today cards
- Generic work-item authority
- Ranking / sales-priority / opportunity scoring
- Automatic message send from Today read
- Campaign automation
