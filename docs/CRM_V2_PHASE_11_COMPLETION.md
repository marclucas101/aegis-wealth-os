# CRM V2 Phase 11 — Completion Report

**Branch:** `crm-v2-11-today`  
**Date:** 2026-07-13  
**Scope:** Phase 11 only — Today workspace and daily operating dashboard  
**Migrations applied:** No  
**Features enabled:** No  

---

## 1. Repository state

- Branch `crm-v2-11-today` — implementation and documentation delivered.
- Additive: Today projection layer (`lib/crm-v2/today/*`), APIs, UI, feature-control migration (unapplied), diagnostics, documentation.
- `/advisor-v2` redirects to `/advisor-v2/today`.
- Legacy `/advisor` portal unchanged.

## 2. Existing Today audit

Completed in `docs/CRM_V2_PHASE_11_EXISTING_TODAY_AUDIT.md`.

| Classification | Examples |
|----------------|----------|
| Existing authority retained | Appointments, service, protection, moments, advocacy, communications |
| Reusable source adapter | Phase 10.2 work queue adapters |
| New Today projection | `loadAdviserTodayProjection` |
| Rejected duplicate | `today_items`, `advisor_work_items`, ranking/scoring schema |
| Deferred | Reports, Operations placeholders (Phase 12) |

**Confirmed:** Today is projection-only. Work queue remains virtual and non-authoritative.

## 3. Exact feature keys

| Key | Scope | Default | Persistence |
|-----|-------|---------|-------------|
| `crm_v2_today` | Today workspace `/advisor-v2/today` | `enabled=false` | `202606290018` |
| `adviser_work_queue` | Virtual queue panel + API | `enabled=false` | `202606290018` |

`crm_v2_today`: `adviser_visible=true`, `client_visible=false`. Cannot grant client access by itself.

Gate: `assertCrmV2TodayAccess()` — master + pilot + allowlist + today flag.

## 4. Migration files

| File | Purpose |
|------|---------|
| `supabase/migrations/202606290018_phase11_crm_v2_today_feature_control.sql` | Seed `crm_v2_today` and `adviser_work_queue` disabled |

Diagnostics: preflight / verify / discrepancies under `supabase/diagnostics/`.

**No schema tables.** No preference table (not required for Phase 11).

## 5. Projection-only model

`lib/crm-v2/today/projection.ts` — `loadAdviserTodayProjection()`:

- Read-only assembly from authoritative sources
- Partial failure isolation per adapter
- No writes, no card persistence, no domain events on read
- Bounded cards (12/section, 80 total)

## 6. Today card DTO

`TodayCardDto` in `lib/crm-v2/today/types.ts` — strict safe fields with `sourceType`, `sourceId`, `routeHref`, severity, section. Documented in `docs/CRM_V2_PHASE_11_TODAY_CARD_MODEL.md`.

## 7. Section model

Eleven sections: Schedule, Prepare, Client Requests, Follow-ups, Service Due, Reviews, Protection, Communications, Relationship Moments, Sync and Operations, Recently Completed.

Defined in `lib/crm-v2/today/sections.ts` with empty states and workspace links.

## 8. Ordering and prohibited signals

Permitted: due date, overdue, lifecycle, severity, freshness, stable ID.  
Prohibited: advocacy score, wealth, premium, ethnicity, sales signals.

Documented in `docs/CRM_V2_PHASE_11_ORDERING_AND_RESTRICTIONS.md`. Implemented in `ordering.ts` and `restrictions.ts`.

## 9. Adviser assignment security

- `authUserId` from session only
- `buildAdviserWorkQueue` filters `advisor_user_id === authUserId`
- Google Calendar status scoped to adviser
- Feature-disabled performs no business loading
- Cross-adviser IDs reveal nothing

## 10. Work queue integration

- Phase 10.2 `buildAdviserWorkQueue` maps to Today cards via `workQueueAdapter`
- Optional read-only panel when `adviser_work_queue` enabled
- `GET /api/advisor-v2/work-queue` — virtual, `readOnly: true`, no mutation
- Queue failures isolated from rest of Today

## 11. Appointment integration

Work queue `appointment` and `meeting_follow_up` adapters project to Schedule, Prepare, Follow-ups. Cards link to `/advisor-v2/appointments/[id]`. No lifecycle transition from Today.

## 12. Service integration

`service_commitment`, `client_service_request`, `document_follow_up` adapters project to Service Due and Client Requests. Links to `/advisor-v2/service`.

## 13. Protection integration

`protection_extraction`, `protection_policy_servicing` adapters project to Protection section. Links to protection workspace. No policy numbers or premiums in cards.

## 14. Relationship moments and review rhythm integration

`relationship_moment`, `client_preference_update`, `crm_review_rhythm`, `review_due` adapters project to Relationship Moments and Reviews. No ethnicity in card text.

## 15. Advocacy restrictions

`advocacy_event` adapter projects action-based follow-ups only. No advocacy score in cards or ordering.

## 16. Communications integration

`communication_record` adapter projects drafts, replies, follow-ups. No full message body in cards.

## 17. Google Calendar status integration

`googleCalendarAdapter` uses stored connection and mapping status only. No OAuth tokens, no provider API on read, no raw errors in cards.

## 18. Adviser UI

- Route: `/advisor-v2/today`
- Component: `AdviserTodayClient.tsx`
- Date header, greeting, sectioned cards, quick links, empty/partial-failure states
- Mobile-first grid, keyboard focus states, accessible section headings

## 19. APIs

| Route | Methods |
|-------|---------|
| `/api/advisor-v2/today` | GET |
| `/api/advisor-v2/today/section/[sectionKey]` | GET |
| `/api/advisor-v2/work-queue` | GET |

All: `assertCrmV2TodayAccess`, `private, no-store`, safe DTOs, no writes on GET.

## 20. Local preferences

Not implemented — not required for Phase 11. No persisted Today cards.

## 21. Event and audit behavior

Today read creates no domain events. No card payload snapshots. Source workflows record events on action.

## 22. Notifications behavior

Today consumes existing action sources only. No notifications sent from Today read.

## 23. Performance

- Bounded cards per section and total
- Deterministic sorting
- No N+1 (batch work queue load)
- No per-card API requests
- No automatic polling
- No provider API on read

## 24. Files changed

**New:**
- `lib/crm-v2/today/*` (projection, types, sections, ordering, routes, restrictions, adapters, workQueuePanel)
- `app/advisor-v2/today/page.tsx`
- `app/api/advisor-v2/today/route.ts`
- `app/api/advisor-v2/today/section/[sectionKey]/route.ts`
- `app/api/advisor-v2/work-queue/route.ts`
- `components/aegis/advisor-v2/today/AdviserTodayClient.tsx`
- `supabase/migrations/202606290018_phase11_crm_v2_today_feature_control.sql`
- `supabase/diagnostics/preflight_202606290018_*`, `verify_202606290018_*`
- `scripts/run-crm-v2-today-validation.ts`
- `docs/CRM_V2_PHASE_11_*.md` (11 documents)

**Updated:**
- `lib/crm-v2/constants.ts`, `access.ts`, `navigation.ts`
- `lib/compliance/types.ts`, `featureFlags.ts`
- `lib/work-queue/routes.ts`
- `app/advisor-v2/page.tsx` (redirect)
- `package.json`
- `scripts/run-crm-v2-shell-validation.ts`, `run-phase10-work-queue-core-validation.ts`
- `docs/CRM_V2_MIGRATION_SEQUENCE.md`, `CRM_V2_FEATURE_CONTROL_PLAN.md`

## 25. Exact QA results

| Command | Result |
|---------|--------|
| `npm run qa:crm-v2-blueprint` | 219/219 passed |
| `npm run qa:crm-v2-shell` | 149/149 passed |
| `npm run qa:crm-v2-relationship-360` | passed |
| `npm run qa:crm-v2-appointments-adviser` | passed |
| `npm run qa:crm-v2-appointments-client` | passed |
| `npm run qa:crm-v2-google-calendar` | 338/338 passed |
| `npm run qa:crm-v2-service` | 405/405 passed |
| `npm run qa:crm-v2-protection` | 463/463 passed |
| `npm run qa:crm-v2-relationship-moments` | 479/479 passed |
| `npm run qa:crm-v2-advocacy` | 495/495 passed |
| `npm run qa:crm-v2-communications` | 545/545 passed |
| `npm run qa:crm-v2-today` | 441/441 passed |
| `npm run qa:phase10-discovery` | 118/118 passed |
| `npm run qa:phase10-work-queue-core` | 135/135 passed |
| `npm run qa:phase9f4-app-retirement` | 115/115 passed |
| `npm run qa:phase9f3-binder-client-vault` | 198/198 passed |
| `npm run qa:phase9e-communications` | 87/87 passed |
| `npm run qa:migration-readiness` | 101/101 passed |
| `npm run qa:diagnostic-sql-syntax` | 90/90 passed |
| `npm run security:api` | passed |
| `npm run security:advisor-access` | passed |
| `npm run security:service-role` | passed |
| `npm run final:check` | 7/7 passed |
| `npx tsc --noEmit` | passed |
| `npm run lint` | 0 errors (pre-existing warnings only) |
| `npm run build` | passed |

## 26. Dry-run result

```
npx supabase db push --dry-run
Would push these migrations:
 • 202606290018_phase11_crm_v2_today_feature_control.sql
```

Only Phase 11 migration pending. Not applied.

## 27. Manual tests remaining

All 47 manual acceptance checks documented in `docs/CRM_V2_PHASE_11_MANUAL_TESTS.md`. Runtime verification requires pilot environment with flags enabled — not executed in blueprint phase.

## 28. Operator decisions required

1. Approve migration `202606290018` apply
2. Configure pilot allowlist (`CRM_V2_PILOT_USER_IDS`)
3. Enable `crm_v2_master`, `crm_v2_pilot_mode`, source module flags, then `crm_v2_today`
4. Optionally enable `adviser_work_queue` for queue panel
5. Execute manual acceptance checklist in pilot

## 29. Confirmation

- No persisted Today authority created
- No generic work-item authority created
- No ranking/scoring schema created
- No sales-opportunity schema created
- No advice/recommendation schema created
- No campaign automation created
- No feature activation performed
- No deployment performed
- No destructive migration performed
- Promotions Phase 9F.4 observation retained
- No Promotions Stage 6

## 30. Verdict

**READY TO APPLY CRM V2 TODAY**

**READY FOR CRM V2 REPORTS AND OPERATIONS** (Phase 12 next)

---

*Stop after Phase 11.*
