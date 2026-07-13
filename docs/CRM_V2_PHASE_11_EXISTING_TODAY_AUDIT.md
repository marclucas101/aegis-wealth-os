# CRM V2 Phase 11 — Existing Today Audit

**Phase:** 11  
**Date:** 2026-07-13  
**Scope:** Audit of existing dashboard surfaces before Today workspace implementation

---

## 1. Audit summary

Today is **projection-only**. No new `today_items`, `advisor_work_items`, ranking, sales-priority or opportunity tables are created. The Phase 10.2 work queue remains virtual and non-authoritative.

---

## 2. Source classification

| Source | Classification | Notes |
|--------|----------------|-------|
| `/advisor-v2` landing (Phase 01 shell) | **Compatibility projection** | Replaced by redirect to `/advisor-v2/today` |
| `/advisor-v2/today` (new) | **New Today projection required** | Implemented Phase 11 |
| Legacy `/advisor` dashboard | **Existing authority to retain** | Unchanged |
| `AdvisorTodayPanel.tsx` (legacy) | **Reusable projection** | Legacy only; not duplicated in CRM V2 |
| Phase 10.2 `buildAdviserWorkQueue` | **Reusable source adapter** | Maps to Today cards via `workQueueAdapter` |
| Appointment agenda (`/advisor-v2/appointments`) | **Existing authority to retain** | Projected into Schedule / Prepare |
| Service workspace | **Existing authority to retain** | Projected into Service Due / Client Requests |
| Communications workspace | **Existing authority to retain** | Projected into Communications |
| Relationship list summary cards | **Reusable projection** | Not duplicated; links to 360 |
| Relationship 360 sections | **Existing authority to retain** | Cards link back |
| Review due logic (`reviewDueAdapter`) | **Reusable source adapter** | Reviews section |
| Protection alerts (`protection_*` adapters) | **Reusable source adapter** | Protection section |
| Relationship moments adapter | **Reusable source adapter** | Relationship Moments section |
| Advocacy follow-up adapter | **Reusable source adapter** | Follow-ups; score excluded |
| Google Calendar sync status | **Reusable source adapter** | Sync and Operations section |
| Dashboard metrics / reports placeholders | **Deferred** | Phase 12 Reports / Operations |
| Promotions Phase 9F.4 observation | **Rejected duplicate** | Unchanged; no Stage 6 |
| Generic work-item persistence | **Rejected duplicate** | Not implemented |
| Sales ranking / lead scoring | **Rejected duplicate** | Prohibited in ordering |

---

## 3. Explicit confirmations

- **Today is projection-only** — `loadAdviserTodayProjection` performs reads only; no card persistence.
- **Work queue remains virtual** — assembled per request; `adviser_work_queue` flag gates panel/API.
- **No new authority tables** — migration `202606290018` seeds feature controls only.
- **No `today_items` table** — confirmed absent from migrations and codebase.
- **No `advisor_work_items` table** — confirmed absent.
- **No ranking or opportunity schema** — prohibited signals documented in restrictions module.

---

## 4. Legacy compatibility

- `/advisor` portal unchanged.
- CRM V2 shell unchanged except Today route and landing redirect.
- All authoritative modules (appointments, service, protection, moments, advocacy, communications, Google Calendar) unchanged.

---

## 5. Promotions observation

Phase 9F.4 Promotions observation retained. **No Promotions Stage 6** introduced in Phase 11.
