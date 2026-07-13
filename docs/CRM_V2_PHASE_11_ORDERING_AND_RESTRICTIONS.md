# CRM V2 Phase 11 — Ordering and Restrictions

**Phase:** 11  
**Implementation:** `lib/crm-v2/today/ordering.ts`, `lib/crm-v2/today/restrictions.ts`

---

## 1. Permitted ordering signals

1. Appointment start time / due date
2. Overdue state (`blocked`, `actionRequired`)
3. Lifecycle / source status (via severity mapping)
4. Severity (urgent → attention → info)
5. Freshness timestamp (`freshnessAt`)
6. Stable card ID (deterministic tie-break)

---

## 2. Prohibited ordering signals

- Advocacy score
- Client wealth
- Premium, revenue, commission
- Sum assured, protection gap value
- Ethnicity
- Product opportunity, lead quality, sales potential
- Hidden segmentation

Defined in `TODAY_PROHIBITED_ORDERING_SIGNALS`.

---

## 3. Severity mapping (from source facts)

| Condition | Severity |
|-----------|----------|
| Blocking or overdue timing | urgent |
| Due today or blocked state | attention |
| Otherwise | info |

No wealth, premium or advocacy score influences severity.

---

## 4. Section sort

Cards sorted within section via `sortTodayCards`. Sections appear in fixed order from `TODAY_SECTION_DEFINITIONS`.

---

## 5. Bounds

- Max 12 cards per section
- Max 80 total cards
- Work queue panel max 8 items

---

## 6. Tests

Validated in `npm run qa:crm-v2-today` — ordering module, restrictions module, and prohibited field absence in DTO.
