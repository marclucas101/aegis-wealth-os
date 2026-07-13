# CRM V2 Phase 11 — Today Card Model

**Phase:** 11  
**DTO location:** `lib/crm-v2/today/types.ts`

---

## 1. TodayCardDto fields

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Stable card ID (`today:{workItemId}`) |
| `sourceType` | enum | Authoritative source type |
| `sourceId` | string | Authoritative record ID |
| `relationshipId` | string \| null | Assigned client / relationship |
| `clientDisplayName` | string \| null | Safe display name |
| `cardType` | enum | UI card classification |
| `title` | string | Safe title |
| `summary` | string \| null | Safe summary (no body) |
| `dueAt` | ISO string \| null | Due or start time |
| `section` | enum | Today section key |
| `actionLabel` | string | CTA label |
| `routeHref` | string | Allowlisted workflow link |
| `sourceStatus` | string \| null | Lifecycle/status label |
| `severity` | info \| attention \| urgent | Operational urgency |
| `freshnessAt` | ISO string | Sort tie-breaker |
| `actionRequired` | boolean | Requires adviser action |
| `blocked` | boolean | Blocked state |
| `sourceVersion` | number \| null | Optimistic version when available |

---

## 2. Excluded fields (never in DTO)

- Raw source record
- Policy numbers, NRIC, storage paths, signed URLs
- Financial values, premium, revenue, client wealth
- Advocacy score, ethnicity
- Private notes, meeting studio content
- Raw Google provider errors
- Communication body (unless explicitly safe — not used in Phase 11)
- Work queue priority internals

---

## 3. Section DTO

`TodaySectionDto` — key, label, bounded cards[], partialFailure flag, emptyMessage, workspaceHref.

---

## 4. Projection DTO

`AdviserTodayProjectionDto` — dateLabel, greeting, summary, sections[], optional workQueuePanel, sourceFailures[], staleDataWarning.

---

## 5. Determinism

Card IDs are deterministic from source type + source ID. Section sorting uses `ordering.ts` with permitted signals only.
