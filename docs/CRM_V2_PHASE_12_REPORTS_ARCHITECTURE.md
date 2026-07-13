# CRM V2 Phase 12 — Reports Architecture

**Scope:** Adviser-facing bounded reports at `/advisor-v2/reports`

---

## Model

`lib/crm-v2/reports/projection.ts` — `loadAdviserReportsProjection()`:

- Server-only, read-only assembly from authoritative sources
- Adviser-scoped via `advisor_user_id` filters
- Admin users receive `adminScopeDeferred: true` with empty sections
- Partial failure isolation per source adapter
- Bounded cards per section (`CRM_V2_REPORTS_MAX_CARDS_PER_SECTION`)
- Bounded date range (`CRM_V2_REPORTS_DEFAULT_DAYS` / `CRM_V2_REPORTS_MAX_DAYS`)

## Sections

1. Relationship Coverage  
2. Appointments  
3. Service  
4. Protection  
5. Review Rhythm  
6. Communications  
7. Operations Summary  
8. Work Queue Summary  

## Prohibited

No revenue, commission, premium opportunity, lead quality, wealth, sales potential, product opportunity, advocacy score ranking, ethnicity, advice or product recommendations.

## APIs

- `GET /api/advisor-v2/reports`
- `GET /api/advisor-v2/reports/[reportKey]`

Gate: `assertCrmV2ReportsAccess()` — master + pilot + `crm_v2_reports`.

## No persistence

Report cards are not stored. No `report_results` table.
