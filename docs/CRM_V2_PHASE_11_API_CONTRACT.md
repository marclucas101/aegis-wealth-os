# CRM V2 Phase 11 — API Contract

**Phase:** 11

---

## 1. Routes

| Route | Method | Gate | Response |
|-------|--------|------|----------|
| `/api/advisor-v2/today` | GET | `assertCrmV2TodayAccess` | `{ ok, today: AdviserTodayProjectionDto }` |
| `/api/advisor-v2/today/section/[sectionKey]` | GET | `assertCrmV2TodayAccess` | `{ ok, section: TodaySectionDto }` |
| `/api/advisor-v2/work-queue` | GET | Today + `adviser_work_queue` | `{ ok, queue: { items, summary, readOnly: true } }` |

---

## 2. Query parameters

| Param | Route | Purpose |
|-------|-------|---------|
| `date` | today, section | Operating date override (ISO date) |

---

## 3. Headers

- `Cache-Control: private, no-store`
- `X-Request-Id` on all responses

---

## 4. Error responses

| Status | Reason |
|--------|--------|
| 401 | unauthenticated |
| 403 | feature_disabled, forbidden, pilot |
| 404 | not_found (invalid section) |
| 500 | safe public message only |

---

## 5. Security

- Adviser identity from session only
- Assignment enforced in source adapters
- No writes on GET
- No existence disclosure for cross-adviser IDs
- Safe DTOs only — no raw records

---

## 6. Partial failures

`sourceFailures[]` in today response when adapters fail. HTTP 200 with degraded data (not 500) unless catastrophic.
