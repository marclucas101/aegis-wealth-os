# CRM V2 Phase 13 — Existing Pilot Readiness Audit

**Branch:** `crm-v2-13-pilot-activation`  
**Date:** 2026-07-13  
**Scope:** Readiness assessment after Phases 01–12 — no activation performed

---

## Executive summary

Phases 01–12 deliver a complete CRM V2 implementation behind fail-closed feature controls. The system remains **disabled by default**. Phase 13 adds operator runbooks, diagnostics, and acceptance materials only — no product module, no automatic activation, no production secrets.

---

## 1. Feature flags through Phase 12

| Flag key | Phase | Default `enabled` | `client_visible` | `adviser_visible` | Classification |
|----------|-------|-------------------|------------------|-------------------|----------------|
| `crm_v2_master` | 01 | false | false | true | **ready** — seed `202606290001` |
| `crm_v2_pilot_mode` | 01 | false | false | true | **ready** — seed `202606290001` |
| `crm_v2_relationships` | 02 | false | false | true | **ready** — seed `202606290002` |
| `crm_v2_appointments_adviser` | 03 | false | false | true | **ready** — seed `202606290003` |
| `crm_v2_appointments_client` | 04 | false | false | false | **ready** — seed `202606290005`; operator must set `client_visible=true` for client routes |
| `crm_v2_google_calendar` | 05 | false | false | true | **needs staging validation** — requires OAuth credentials |
| `crm_v2_service` | 06 | false | false | true | **ready** — seed `202606290008` |
| `crm_v2_client_service` | 06 | false | true | false | **ready** — seed `202606290008` |
| `crm_v2_protection_portfolio` | 07 | false | true | true | **ready** — seed `202606290010` |
| `crm_v2_relationship_moments` | 08 | false | false | true | **ready** — seed `202606290012` |
| `crm_v2_client_profile` | 08 | false | true | false | **ready** — seed `202606290012` |
| `crm_v2_advocacy` | 09 | false | true | true | **ready** — seed `202606290014` |
| `crm_v2_communications` | 10 | false | true | true | **ready** — seed `202606290016` |
| `crm_v2_today` | 11 | false | false | true | **ready** — seed `202606290018` |
| `adviser_work_queue` | 11 | false | false | true | **ready** — seed `202606290018`; enable with Today |
| `crm_v2_reports` | 12 | false | false | true | **ready** — seed `202606290019` |
| `crm_v2_operations` | 12 | false | false | true | **ready** — seed `202606290019` |
| `crm_v2_cutover` | 14 | false | — | — | **deferred** — Phase 14 only |
| `crm_v2_legacy_fallback` | 14 | false | — | — | **deferred** — Phase 14 only |

**Code defaults:** All CRM V2 keys in `lib/compliance/featureFlags.ts` `FEATURE_DEFAULTS` are `enabled: false`.

**Migrations:** No migration enables flags. All seeds use `enabled = false` with `ON CONFLICT DO NOTHING`.

---

## 2. Current default enabled states

| Layer | State | Classification |
|-------|-------|----------------|
| `FEATURE_DEFAULTS` | All CRM V2 flags `enabled: false` | **ready** |
| Migration seeds | All `enabled = false` | **ready** |
| Remote DB (staging/production) | Operator-dependent | **needs operator action** — verify via diagnostics |
| `CRM_V2_PILOT_USER_IDS` | Not set in repository | **needs operator action** — staging env only |

---

## 3. Access guards

| Guard | File | Classification |
|-------|------|----------------|
| `assertCrmV2Access()` | `lib/crm-v2/access.ts` | **ready** — master + pilot + allowlist |
| `assertCrmV2RelationshipsAccess()` | same | **ready** |
| `assertCrmV2AppointmentsAccess()` | same | **ready** |
| `assertCrmV2GoogleCalendarAccess()` | same | **ready** — requires appointments adviser |
| `assertCrmV2ClientAppointmentsAccess()` | same | **ready** — client role + `client_visible` |
| `assertCrmV2ServiceAccess()` | same | **ready** |
| `assertCrmV2ClientServiceAccess()` | same | **ready** |
| `assertCrmV2ProtectionPortfolioAccess()` | same | **ready** |
| `assertCrmV2ClientProtectionAccess()` | same | **ready** |
| `assertCrmV2RelationshipMomentsAccess()` | same | **ready** |
| `assertCrmV2ClientProfileAccess()` | same | **ready** |
| `assertCrmV2AdvocacyAccess()` | same | **ready** |
| `assertCrmV2ClientAdvocacyAccess()` | same | **ready** |
| `assertCrmV2CommunicationsAccess()` | same | **ready** |
| `assertCrmV2ClientMessagesAccess()` | same | **ready** |
| `assertCrmV2TodayAccess()` | same | **ready** |
| `assertCrmV2ReportsAccess()` | same | **ready** |
| `assertCrmV2OperationsAccess()` | same | **ready** |
| Layout inheritance | `app/advisor-v2/layout.tsx` | **ready** — all child routes inherit master gate |

---

## 4. Pilot allowlist

| Item | Implementation | Classification |
|------|----------------|----------------|
| Env var | `CRM_V2_PILOT_USER_IDS` | **ready** — `lib/crm-v2/constants.ts` |
| Parser | `parsePilotAllowlistFromEnv()` | **ready** — fail-closed on missing/empty/malformed |
| Membership check | `isUserInPilotAllowlist()` | **ready** |
| Browser exposure | None | **ready** |
| Staging configuration | Operator sets comma-separated auth UUIDs | **needs operator action** |

---

## 5. Manual-test coverage

| Phase | Document | Test count | Executed | Classification |
|-------|----------|------------|----------|----------------|
| 01 | `CRM_V2_PHASE_01_MANUAL_TESTS.md` | 25 | NOT RUN | **needs staging validation** |
| 02 | `CRM_V2_PHASE_02_MANUAL_TESTS.md` | 25 | NOT RUN | **needs staging validation** |
| 03 | `CRM_V2_PHASE_03_MANUAL_TESTS.md` | 34 | NOT RUN | **needs staging validation** |
| 04 | `CRM_V2_PHASE_04_MANUAL_TESTS.md` | 20 | NOT RUN | **needs staging validation** |
| 05 | `CRM_V2_PHASE_05_MANUAL_TESTS.md` | 16 | NOT RUN | **needs staging validation** |
| 06 | `CRM_V2_PHASE_06_MANUAL_TESTS.md` | 38 | NOT RUN | **needs staging validation** |
| 07 | `CRM_V2_PHASE_07_MANUAL_TESTS.md` | 39 | NOT RUN | **needs staging validation** |
| 08 | `CRM_V2_PHASE_08_MANUAL_TESTS.md` | 39 | NOT RUN | **needs staging validation** |
| 09 | `CRM_V2_PHASE_09_MANUAL_TESTS.md` | 42 | NOT RUN | **needs staging validation** |
| 10 | `CRM_V2_PHASE_10_MANUAL_TESTS.md` | 47 | NOT RUN | **needs staging validation** |
| 11 | `CRM_V2_PHASE_11_MANUAL_TESTS.md` | 47 | NOT RUN | **needs staging validation** |
| 12 | `CRM_V2_PHASE_12_MANUAL_TESTS.md` | 47 | NOT RUN | **needs staging validation** |
| 13 | `CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md` | aggregated + rollback | NOT RUN | **ready** — master checklist created |

**Automated QA:** All `npm run qa:crm-v2-*` scripts through Phase 12 pass in repository validation.

---

## 6. Diagnostics coverage

| Area | Diagnostics | Classification |
|------|-------------|----------------|
| Phase 01–12 feature seeds | Per-migration preflight/verify/discrepancies | **ready** |
| Phase 13 pilot readiness | `preflight_phase13_*`, `verify_phase13_*`, `verify_phase13_*_discrepancies` | **ready** |
| Migration readiness | `npm run qa:migration-readiness` | **ready** |
| SQL syntax | `npm run qa:diagnostic-sql-syntax` | **ready** |
| Security scripts | `security:api`, `security:advisor-access`, `security:service-role` | **ready** |

---

## 7. Staging environment readiness

| Item | Status | Classification |
|------|--------|----------------|
| Staging deployment exists | Operator-owned | **needs operator action** |
| Supabase staging linked | Operator-owned | **needs operator action** |
| `npx supabase db push --dry-run` | Repository migrations pending operator apply | **needs staging validation** |
| OAuth (Google Calendar) | Staging credentials separate from production | **needs operator action** |
| Test adviser accounts | Operator provisions | **needs operator action** |
| Test client accounts | Operator provisions | **needs operator action** |

---

## 8. Rollback paths

| Level | Mechanism | Classification |
|-------|-----------|----------------|
| Sub-feature | `PATCH /api/admin/feature-controls` set `enabled=false` | **ready** |
| Master off | `crm_v2_master=false` | **ready** — immediate shell lockout |
| Pilot off | `crm_v2_pilot_mode=false` | **ready** |
| Allowlist removal | Unset `CRM_V2_PILOT_USER_IDS` + restart | **ready** |
| Data preservation | Flags off; schema and records retained | **ready** |
| Destructive rollback | Not supported — prohibited | **ready** — documented in rollback runbook |

---

## 9. Existing seed and fixture data

| Source | Purpose | Classification |
|--------|---------|----------------|
| CRM V2 migrations | Schema + feature-control seeds only | **ready** |
| Legacy `/advisor` data | Production appointments, clients | **ready** — unchanged |
| Test fixtures | Operator staging book | **needs operator action** |
| Pilot test tracking table | Not approved | **deferred** — no new domain tables in Phase 13 |

---

## 10. Known incomplete manual tests

All Phase 01–12 manual tests remain **NOT RUN**. No operator has signed off staging pilot acceptance. This is expected — Phase 13 prepares materials; execution is operator-owned.

---

## 11. Legacy portal fallback

| Route | Status | Classification |
|-------|--------|----------------|
| `/advisor` | Active primary adviser portal | **ready** |
| `/advisor-v2` | Gated; disabled by default | **ready** |
| `/advisor-legacy` | Phase 14 — not implemented | **deferred** |
| `crm_v2_cutover` | Phase 14 flag — not seeded | **deferred** |
| Promotions 9F.4 observation | `legacy_promotions_write` stays false | **ready** — must continue |

---

## 12. Production deployment assumptions

| Assumption | Phase 13 action | Classification |
|------------|-----------------|----------------|
| No production feature activation | Confirmed — no flags enabled | **ready** |
| No production secrets in repo | Confirmed | **ready** |
| No automatic CRM V2 rollout | Confirmed | **ready** |
| Staging pilot before production | Documented in activation runbook | **needs operator action** |
| Production go/no-go | `CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md` | **needs operator action** |

---

## 13. Blockers

| Blocker | Severity | Owner |
|---------|----------|-------|
| Staging manual acceptance not executed | Medium | Operator |
| Pending CRM V2 migrations not applied to staging | Medium | Operator |
| `CRM_V2_PILOT_USER_IDS` not configured on staging | Medium | Operator |
| Google Calendar OAuth not configured on staging | Low (module optional) | Operator |

**No engineering blockers** prevent staging pilot preparation.

---

## 14. Verdict

Repository is **ready for staging pilot preparation**. Operator execution of staging activation runbook and manual acceptance remains outstanding.
