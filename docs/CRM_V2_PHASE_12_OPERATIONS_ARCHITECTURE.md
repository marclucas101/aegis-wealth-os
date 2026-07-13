# CRM V2 Phase 12 — Operations Architecture

**Scope:** Platform health and diagnostics at `/advisor-v2/operations`

---

## Model

`lib/crm-v2/operations/projection.ts` — `loadAdviserOperationsProjection()`:

- Server-only, read-only except links to existing approved workflows
- Adviser-scoped panels for advisor role; admin receives deferred adviser-scoped panels
- Partial failure isolation per adapter
- Environment warnings without secrets

## Sections

1. Feature Controls  
2. Migration and Diagnostics  
3. Google Calendar  
4. Communications  
5. Work Queue  
6. Today Sources  
7. Protection Extraction  
8. Security Boundaries  
9. Manual Acceptance  
10. Action Required  

## Migration visibility

Migration status is **manual-runbook driven**. No Supabase CLI from runtime. No connection strings exposed.

## APIs

- `GET /api/advisor-v2/operations`
- `GET /api/advisor-v2/operations/[sectionKey]`

Gate: `assertCrmV2OperationsAccess()` — master + pilot + `crm_v2_operations`.

## No persistence

No generic `operations_items` table.
