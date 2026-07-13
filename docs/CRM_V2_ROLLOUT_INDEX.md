# CRM V2 — Rollout Index

**Phase:** 00 — Domain and Integration Blueprint  
**Branch:** `crm-v2-00-blueprint`  
**Status:** Blueprint complete — Phase 01 shell implemented on `crm-v2-01-shell`  
**Verdict:** See `docs/CRM_V2_PHASE_00_COMPLETION.md`

---

## Purpose

This index is the single navigation entry for the AEGIS Adviser CRM V2 programme. CRM V2 follows the domain chain:

```text
RELATIONSHIP → ENGAGEMENT → ADVICE → SERVICE
```

Target adviser navigation (post-cutover):

```text
Today | Relationships | Appointments | Service | Communications | More
```

---

## Phase sequence

| Phase | Branch | Deliverable | Status |
|-------|--------|-------------|--------|
| **00** | `crm-v2-00-blueprint` | Architecture blueprint (docs only) | **Complete** |
| **01** | `crm-v2-01-shell` | `/advisor-v2` shell + pilot gating | **Complete** — see Phase 01 docs below |
| **02** | `crm-v2-02-relationship-360` | Relationship list + Relationship 360 | **Complete** — see Phase 02 docs below |
| **03** | `crm-v2-03-appointments-adviser` | Authoritative appointment core (adviser) | **Complete** — see Phase 03 docs below |
| **04** | `crm-v2-04-appointments-client` | Client appointment collaboration | **Complete** |
| **05** | `crm-v2-05-google-calendar` | Google Calendar integration (AEGIS authoritative) | In progress |
| **06** | `crm-v2-06-service-commitments` | Service layer + commitments + client requests | **Complete** — see Phase 06 docs below |
| **07** | `crm-v2-07-protection-portfolio` | Protection portfolio + verification | **Complete** — see Phase 07 docs below |
| **08** | `crm-v2-08-relationship-moments` | Moments engine (birthdays, holidays, review rhythm) | **Implemented** — see Phase 08 docs below |
| **09** | `crm-v2-09-advocacy` | Advocacy event tracking + yearly score | **Implemented** — see Phase 09 docs below |
| **10** | `crm-v2-10-communications` | CRM → governed communications bridge | **Implemented** — see Phase 10 docs below |
| **11** | `crm-v2-11-today-work-queue` | Today homepage + unified work queue | **Complete** — see Phase 11 docs |
| **12** | `crm-v2-12-reports-operations` | Reports + operator diagnostics | **Complete** — see Phase 12 docs |
| **13** | `crm-v2-13-pilot-activation` | Staging pilot readiness (runbooks, diagnostics, acceptance) | **Complete** — see Phase 13 docs |
| **14** | `crm-v2-14-cutover` | `/advisor` → CRM V2 cutover | Pending |
| **15** | `crm-v2-15-legacy-retirement` | Legacy adviser portal retirement (conditional) | Deferred |

---

## Phase 03 documents (appointments adviser)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md](./CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md) | Pre-schema audit of `adviser_appointments` |
| [CRM_V2_PHASE_03_APPOINTMENT_ARCHITECTURE.md](./CRM_V2_PHASE_03_APPOINTMENT_ARCHITECTURE.md) | Authority, service, routes |
| [CRM_V2_PHASE_03_LIFECYCLE_AND_TRANSITIONS.md](./CRM_V2_PHASE_03_LIFECYCLE_AND_TRANSITIONS.md) | Canonical lifecycle |
| [CRM_V2_PHASE_03_API_CONTRACT.md](./CRM_V2_PHASE_03_API_CONTRACT.md) | Adviser API DTOs |
| [CRM_V2_PHASE_03_MEETING_STUDIO_INTEGRATION.md](./CRM_V2_PHASE_03_MEETING_STUDIO_INTEGRATION.md) | Session linkage |
| [CRM_V2_PHASE_03_SECURITY_REVIEW.md](./CRM_V2_PHASE_03_SECURITY_REVIEW.md) | Threat table |
| [CRM_V2_PHASE_03_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_03_MIGRATION_RUNBOOK.md) | Apply/verify/discrepancy |
| [CRM_V2_PHASE_03_MANUAL_TESTS.md](./CRM_V2_PHASE_03_MANUAL_TESTS.md) | Operator checklist (34 tests) |
| [CRM_V2_PHASE_03_COMPLETION.md](./CRM_V2_PHASE_03_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Phase 04 documents (appointments client)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_04_EXISTING_CLIENT_APPOINTMENT_AUDIT.md](./CRM_V2_PHASE_04_EXISTING_CLIENT_APPOINTMENT_AUDIT.md) | Existing client appointment audit |
| [CRM_V2_PHASE_04_CLIENT_APPOINTMENT_ARCHITECTURE.md](./CRM_V2_PHASE_04_CLIENT_APPOINTMENT_ARCHITECTURE.md) | Client appointment architecture |
| [CRM_V2_PHASE_04_CLIENT_LIFECYCLE_ACTIONS.md](./CRM_V2_PHASE_04_CLIENT_LIFECYCLE_ACTIONS.md) | Safe lifecycle actions |
| [CRM_V2_PHASE_04_API_CONTRACT.md](./CRM_V2_PHASE_04_API_CONTRACT.md) | Client APIs and DTO contract |
| [CRM_V2_PHASE_04_VISIBILITY_AND_PRIVACY.md](./CRM_V2_PHASE_04_VISIBILITY_AND_PRIVACY.md) | Visibility and privacy boundaries |
| [CRM_V2_PHASE_04_DOCUMENT_PREPARATION.md](./CRM_V2_PHASE_04_DOCUMENT_PREPARATION.md) | Vault/upload reuse model |
| [CRM_V2_PHASE_04_SECURITY_REVIEW.md](./CRM_V2_PHASE_04_SECURITY_REVIEW.md) | Security control inventory |
| [CRM_V2_PHASE_04_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_04_MIGRATION_RUNBOOK.md) | Migration preflight/verify steps |
| [CRM_V2_PHASE_04_MANUAL_TESTS.md](./CRM_V2_PHASE_04_MANUAL_TESTS.md) | Manual operator tests |
| [CRM_V2_PHASE_04_COMPLETION.md](./CRM_V2_PHASE_04_COMPLETION.md) | Completion report |

---

## Phase 06 documents (service commitments)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_06_EXISTING_SERVICING_AUDIT.md](./CRM_V2_PHASE_06_EXISTING_SERVICING_AUDIT.md) | Pre-schema servicing source audit |
| [CRM_V2_PHASE_06_SERVICE_ARCHITECTURE.md](./CRM_V2_PHASE_06_SERVICE_ARCHITECTURE.md) | Authority model and flow |
| [CRM_V2_PHASE_06_COMMITMENT_LIFECYCLE.md](./CRM_V2_PHASE_06_COMMITMENT_LIFECYCLE.md) | Commitment states and transitions |
| [CRM_V2_PHASE_06_SERVICE_REQUEST_LIFECYCLE.md](./CRM_V2_PHASE_06_SERVICE_REQUEST_LIFECYCLE.md) | Client request lifecycle |
| [CRM_V2_PHASE_06_API_CONTRACT.md](./CRM_V2_PHASE_06_API_CONTRACT.md) | Adviser and client API DTOs |
| [CRM_V2_PHASE_06_CLIENT_ACTIONS.md](./CRM_V2_PHASE_06_CLIENT_ACTIONS.md) | `/actions` and `/requests` client views |
| [CRM_V2_PHASE_06_WORK_QUEUE_INTEGRATION.md](./CRM_V2_PHASE_06_WORK_QUEUE_INTEGRATION.md) | Read-only queue adapters |
| [CRM_V2_PHASE_06_VISIBILITY_AND_PRIVACY.md](./CRM_V2_PHASE_06_VISIBILITY_AND_PRIVACY.md) | DTO exclusions |
| [CRM_V2_PHASE_06_SECURITY_REVIEW.md](./CRM_V2_PHASE_06_SECURITY_REVIEW.md) | Threat table and controls |
| [CRM_V2_PHASE_06_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_06_MIGRATION_RUNBOOK.md) | Apply/verify/discrepancy |
| [CRM_V2_PHASE_06_MANUAL_TESTS.md](./CRM_V2_PHASE_06_MANUAL_TESTS.md) | Operator checklist (38 tests) |
| [CRM_V2_PHASE_06_COMPLETION.md](./CRM_V2_PHASE_06_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Phase 09 documents (advocacy)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_09_EXISTING_ADVOCACY_AUDIT.md](./CRM_V2_PHASE_09_EXISTING_ADVOCACY_AUDIT.md) | Pre-schema audit (referrals, testimonials, promotions 9F.4) |
| [CRM_V2_PHASE_09_ADVOCACY_ARCHITECTURE.md](./CRM_V2_PHASE_09_ADVOCACY_ARCHITECTURE.md) | Event-based advocacy layer, tables, flow |
| [CRM_V2_PHASE_09_CONSENT_AND_PRIVACY.md](./CRM_V2_PHASE_09_CONSENT_AND_PRIVACY.md) | Consent states, testimonial rules, withdrawal |
| [CRM_V2_PHASE_09_ADVOCACY_SCORE_RESTRICTIONS.md](./CRM_V2_PHASE_09_ADVOCACY_SCORE_RESTRICTIONS.md) | Yearly score allowed/prohibited uses |
| [CRM_V2_PHASE_09_CLIENT_ADVOCACY_PREFERENCES.md](./CRM_V2_PHASE_09_CLIENT_ADVOCACY_PREFERENCES.md) | `/preferences/advocacy`, `crm_v2_advocacy` client gate |
| [CRM_V2_PHASE_09_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md](./CRM_V2_PHASE_09_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md) | FK links, `advocacyEventAdapter` |
| [CRM_V2_PHASE_09_API_CONTRACT.md](./CRM_V2_PHASE_09_API_CONTRACT.md) | Adviser and client API DTOs |
| [CRM_V2_PHASE_09_VISIBILITY_AND_PRIVACY.md](./CRM_V2_PHASE_09_VISIBILITY_AND_PRIVACY.md) | DTO redactions |
| [CRM_V2_PHASE_09_SECURITY_REVIEW.md](./CRM_V2_PHASE_09_SECURITY_REVIEW.md) | IDOR, feature gates, no Promotions Stage 6 |
| [CRM_V2_PHASE_09_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_09_MIGRATION_RUNBOOK.md) | Apply/verify/discrepancy (`202606290014`, `202606290015`) |
| [CRM_V2_PHASE_09_MANUAL_TESTS.md](./CRM_V2_PHASE_09_MANUAL_TESTS.md) | Operator checklist (42 tests) |
| [CRM_V2_PHASE_09_COMPLETION.md](./CRM_V2_PHASE_09_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Phase 08 documents (relationship moments)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_08_EXISTING_RELATIONSHIP_MOMENTS_AUDIT.md](./CRM_V2_PHASE_08_EXISTING_RELATIONSHIP_MOMENTS_AUDIT.md) | Pre-schema audit (DOB, tasks, reviews, ethnicity) |
| [CRM_V2_PHASE_08_RELATIONSHIP_MOMENTS_ARCHITECTURE.md](./CRM_V2_PHASE_08_RELATIONSHIP_MOMENTS_ARCHITECTURE.md) | Canonical moments, overrides, festive mappings |
| [CRM_V2_PHASE_08_REVIEW_RHYTHM.md](./CRM_V2_PHASE_08_REVIEW_RHYTHM.md) | `crm_review_rhythm` projection |
| [CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md](./CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md) | Hard restrictions, festive only |
| [CRM_V2_PHASE_08_CLIENT_PREFERENCES.md](./CRM_V2_PHASE_08_CLIENT_PREFERENCES.md) | `crm_v2_client_profile` gate, `/preferences` |
| [CRM_V2_PHASE_08_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md](./CRM_V2_PHASE_08_SERVICE_APPOINTMENT_WORK_QUEUE_INTEGRATION.md) | Service requests, appointments, queue adapters |
| [CRM_V2_PHASE_08_API_CONTRACT.md](./CRM_V2_PHASE_08_API_CONTRACT.md) | Adviser and client API DTOs |
| [CRM_V2_PHASE_08_VISIBILITY_AND_PRIVACY.md](./CRM_V2_PHASE_08_VISIBILITY_AND_PRIVACY.md) | DTO exclusions |
| [CRM_V2_PHASE_08_SECURITY_REVIEW.md](./CRM_V2_PHASE_08_SECURITY_REVIEW.md) | IDOR and fail-closed gates |
| [CRM_V2_PHASE_08_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_08_MIGRATION_RUNBOOK.md) | Apply/verify/discrepancy |
| [CRM_V2_PHASE_08_MANUAL_TESTS.md](./CRM_V2_PHASE_08_MANUAL_TESTS.md) | Operator checklist (39 tests) |
| [CRM_V2_PHASE_08_COMPLETION.md](./CRM_V2_PHASE_08_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Phase 07 documents (protection portfolio)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_07_EXISTING_PROTECTION_AUDIT.md](./CRM_V2_PHASE_07_EXISTING_PROTECTION_AUDIT.md) | Existing protection system audit |
| [CRM_V2_PHASE_07_PROTECTION_ARCHITECTURE.md](./CRM_V2_PHASE_07_PROTECTION_ARCHITECTURE.md) | Authorities and verification flow |
| [CRM_V2_PHASE_07_EXTRACTION_AND_VERIFICATION.md](./CRM_V2_PHASE_07_EXTRACTION_AND_VERIFICATION.md) | Extraction lifecycle |
| [CRM_V2_PHASE_07_POLICY_VERSIONING.md](./CRM_V2_PHASE_07_POLICY_VERSIONING.md) | Version model and deduplication |
| [CRM_V2_PHASE_07_CLIENT_PROTECTION_SUMMARY.md](./CRM_V2_PHASE_07_CLIENT_PROTECTION_SUMMARY.md) | Client `/protection` views |
| [CRM_V2_PHASE_07_REPORT_AND_BINDER_INTEGRATION.md](./CRM_V2_PHASE_07_REPORT_AND_BINDER_INTEGRATION.md) | Legacy report + binder boundaries |
| [CRM_V2_PHASE_07_SERVICE_AND_WORK_QUEUE_INTEGRATION.md](./CRM_V2_PHASE_07_SERVICE_AND_WORK_QUEUE_INTEGRATION.md) | Service requests + queue adapters |
| [CRM_V2_PHASE_07_API_CONTRACT.md](./CRM_V2_PHASE_07_API_CONTRACT.md) | Protection API contract |
| [CRM_V2_PHASE_07_VISIBILITY_AND_PRIVACY.md](./CRM_V2_PHASE_07_VISIBILITY_AND_PRIVACY.md) | Masking and DTO privacy |
| [CRM_V2_PHASE_07_SECURITY_REVIEW.md](./CRM_V2_PHASE_07_SECURITY_REVIEW.md) | IDOR and threat controls |
| [CRM_V2_PHASE_07_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_07_MIGRATION_RUNBOOK.md) | Apply/verify/discrepancy |
| [CRM_V2_PHASE_07_MANUAL_TESTS.md](./CRM_V2_PHASE_07_MANUAL_TESTS.md) | Operator checklist (39 tests) |
| [CRM_V2_PHASE_07_COMPLETION.md](./CRM_V2_PHASE_07_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Phase 05 documents (Google Calendar)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_05_EXISTING_GOOGLE_CALENDAR_AUDIT.md](./CRM_V2_PHASE_05_EXISTING_GOOGLE_CALENDAR_AUDIT.md) | Existing Google integration audit |
| [CRM_V2_PHASE_05_GOOGLE_CALENDAR_ARCHITECTURE.md](./CRM_V2_PHASE_05_GOOGLE_CALENDAR_ARCHITECTURE.md) | Phase 05 authority and sync model |
| [CRM_V2_PHASE_05_OAUTH_AND_TOKEN_SECURITY.md](./CRM_V2_PHASE_05_OAUTH_AND_TOKEN_SECURITY.md) | OAuth/state/token controls |
| [CRM_V2_PHASE_05_EVENT_MAPPING_AND_IDEMPOTENCY.md](./CRM_V2_PHASE_05_EVENT_MAPPING_AND_IDEMPOTENCY.md) | Mapping authority and idempotency |
| [CRM_V2_PHASE_05_EVENT_PRIVACY.md](./CRM_V2_PHASE_05_EVENT_PRIVACY.md) | Outbound event privacy limits |
| [CRM_V2_PHASE_05_SYNC_AND_RECONCILIATION.md](./CRM_V2_PHASE_05_SYNC_AND_RECONCILIATION.md) | Sync triggers and reconciliation |
| [CRM_V2_PHASE_05_API_CONTRACT.md](./CRM_V2_PHASE_05_API_CONTRACT.md) | Adviser API contract |
| [CRM_V2_PHASE_05_SECURITY_REVIEW.md](./CRM_V2_PHASE_05_SECURITY_REVIEW.md) | Security controls and residual risks |
| [CRM_V2_PHASE_05_MIGRATION_RUNBOOK.md](./CRM_V2_PHASE_05_MIGRATION_RUNBOOK.md) | Migration/diagnostic runbook |
| [CRM_V2_PHASE_05_MANUAL_TESTS.md](./CRM_V2_PHASE_05_MANUAL_TESTS.md) | Manual operator tests |
| [CRM_V2_PHASE_05_COMPLETION.md](./CRM_V2_PHASE_05_COMPLETION.md) | Completion report |

---

## Phase 02 documents (relationship 360)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_02_RELATIONSHIP_ARCHITECTURE.md](./CRM_V2_PHASE_02_RELATIONSHIP_ARCHITECTURE.md) | Routes, identity, six sections |
| [CRM_V2_PHASE_02_READ_MODEL.md](./CRM_V2_PHASE_02_READ_MODEL.md) | Centralized read model |
| [CRM_V2_PHASE_02_TIMELINE_PROJECTION.md](./CRM_V2_PHASE_02_TIMELINE_PROJECTION.md) | Engagement timeline rules |
| [CRM_V2_PHASE_02_SECURITY_REVIEW.md](./CRM_V2_PHASE_02_SECURITY_REVIEW.md) | Threat table |
| [CRM_V2_PHASE_02_MANUAL_TESTS.md](./CRM_V2_PHASE_02_MANUAL_TESTS.md) | Operator checklist (25 tests) |
| [CRM_V2_PHASE_02_COMPLETION.md](./CRM_V2_PHASE_02_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Phase 01 documents (shell)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_01_SHELL_ARCHITECTURE.md](./CRM_V2_PHASE_01_SHELL_ARCHITECTURE.md) | Routes, layout, navigation, placeholders, shell API |
| [CRM_V2_PHASE_01_FEATURE_GATING.md](./CRM_V2_PHASE_01_FEATURE_GATING.md) | Master + pilot gates, env allowlist, migration seed |
| [CRM_V2_PHASE_01_SECURITY_REVIEW.md](./CRM_V2_PHASE_01_SECURITY_REVIEW.md) | Threat table and control inventory |
| [CRM_V2_PHASE_01_MANUAL_TESTS.md](./CRM_V2_PHASE_01_MANUAL_TESTS.md) | Operator executable checklist (25 tests) |
| [CRM_V2_PHASE_01_COMPLETION.md](./CRM_V2_PHASE_01_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Blueprint documents (Phase 00)

| Document | Purpose |
|----------|---------|
| [CRM_V2_ARCHITECTURE_BLUEPRINT.md](./CRM_V2_ARCHITECTURE_BLUEPRINT.md) | Definitive architecture, domain chain, integration model |
| [CRM_V2_SOURCE_OF_TRUTH_MATRIX.md](./CRM_V2_SOURCE_OF_TRUTH_MATRIX.md) | Authoritative record per domain — no duplicate SOT |
| [CRM_V2_DOMAIN_ENTITY_MAP.md](./CRM_V2_DOMAIN_ENTITY_MAP.md) | Entities, reuse vs new tables, naming |
| [CRM_V2_VISIBILITY_MODEL.md](./CRM_V2_VISIBILITY_MODEL.md) | Adviser-only, client-visible, audit-only, system |
| [CRM_V2_ROUTE_MAP.md](./CRM_V2_ROUTE_MAP.md) | V2 routes, legacy mapping, API surface |
| [CRM_V2_FEATURE_CONTROL_PLAN.md](./CRM_V2_FEATURE_CONTROL_PLAN.md) | Flags, pilot gating, rollout gates |
| [CRM_V2_MIGRATION_SEQUENCE.md](./CRM_V2_MIGRATION_SEQUENCE.md) | Ordered migrations, diagnostics, rollback |
| [CRM_V2_COMPATIBILITY_AND_CUTOVER.md](./CRM_V2_COMPATIBILITY_AND_CUTOVER.md) | Legacy portal, client portal, cutover strategy |
| [CRM_V2_SECURITY_BOUNDARIES.md](./CRM_V2_SECURITY_BOUNDARIES.md) | Assignment, IDOR, DTO minimization, prohibited uses |
| [CRM_V2_PHASE_00_COMPLETION.md](./CRM_V2_PHASE_00_COMPLETION.md) | Completion report, QA results, operator decisions |
| `docs/CRM_V2_ROLLOUT_INDEX.md` | This index (self-reference for QA) |

---

## Upstream dependencies

| Source | Relevance |
|--------|-----------|
| [PHASE_10_RECOMMENDATION.md](./PHASE_10_RECOMMENDATION.md) | Work queue track; virtual projection model |
| [PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md](./PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md) | Current adviser/client/admin surfaces |
| [PHASE_10_2_WORK_ITEM_DOMAIN_MODEL.md](./PHASE_10_2_WORK_ITEM_DOMAIN_MODEL.md) | `AdviserWorkItem` virtual queue |
| [PHASE_10_2_SOURCE_DATA_AUDIT.md](./PHASE_10_2_SOURCE_DATA_AUDIT.md) | Queue adapter sources |
| [PHASE_10_2_SECURITY_AND_PRIVACY.md](./PHASE_10_2_SECURITY_AND_PRIVACY.md) | Assignment scope, DTO rules |
| [PHASE_9F4_OBSERVATION_PLAN.md](./PHASE_9F4_OBSERVATION_PLAN.md) | Promotions retirement observation — **must continue** |

---

## QA

| Script | Phase |
|--------|-------|
| `npm run qa:crm-v2-blueprint` | 00 |
| `npm run qa:crm-v2-shell` | 01 |
| `npm run qa:crm-v2-relationship-360` | 02 |
| `npm run qa:crm-v2-appointments-adviser` | 03 |
| `npm run qa:crm-v2-appointments-client` | 04 |
| `npm run qa:crm-v2-google-calendar` | 05 |
| `npm run qa:crm-v2-service` | 06 |
| `npm run qa:crm-v2-protection` | 07 |
| `npm run qa:crm-v2-relationship-moments` | 08 |
| `npm run qa:crm-v2-advocacy` | 09 |
| `npm run qa:crm-v2-communications` | 10 |
| `npm run qa:crm-v2-today` | 11 |
| `npm run qa:crm-v2-reports-operations` | 12 |
| `npm run qa:crm-v2-pilot-readiness` | 13 |

---

## Phase 13 documents (pilot activation readiness)

| Document | Purpose |
|----------|---------|
| [CRM_V2_PHASE_13_EXISTING_PILOT_READINESS_AUDIT.md](./CRM_V2_PHASE_13_EXISTING_PILOT_READINESS_AUDIT.md) | Readiness audit after Phases 01–12 |
| [CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md](./CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md) | Exact flag activation sequence |
| [CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md](./CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md) | Day-to-day pilot scope, routes, rules |
| [CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md](./CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md) | Pre-deploy checklist, no-go, secret rotation |
| [CRM_V2_PHASE_13_STAGING_ACTIVATION_RUNBOOK.md](./CRM_V2_PHASE_13_STAGING_ACTIVATION_RUNBOOK.md) | Staging operator activation steps |
| [CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md](./CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md) | Flag-disable rollback (no data deletion) |
| [CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md](./CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md) | Aggregated manual tests (422) |
| [CRM_V2_PHASE_13_PILOT_SMOKE_TESTS.md](./CRM_V2_PHASE_13_PILOT_SMOKE_TESTS.md) | Safe smoke-test guidance |
| [CRM_V2_PHASE_13_PILOT_DATA_SAFETY.md](./CRM_V2_PHASE_13_PILOT_DATA_SAFETY.md) | Test data and external-send rules |
| [CRM_V2_PHASE_13_FEATURE_CONTROL_DIAGNOSTICS.md](./CRM_V2_PHASE_13_FEATURE_CONTROL_DIAGNOSTICS.md) | Phase 13 SQL diagnostics |
| [CRM_V2_PHASE_13_SECURITY_REVIEW.md](./CRM_V2_PHASE_13_SECURITY_REVIEW.md) | Pilot readiness security review |
| [CRM_V2_PHASE_13_COMPLETION.md](./CRM_V2_PHASE_13_COMPLETION.md) | Sign-off, QA results, verdict |

---

## Hard restrictions (all phases until operator approval)

- No duplicate sources of truth
- No Promotions Stage 6 schema retirement during 9F.4 observation
- No automatic financial advice or client wealth prioritization
- No ethnicity-based advice, service priority, or sales targeting
- Work queue remains a **projection** — not authoritative
- Governed communications remains authoritative for published client content

---

## Operator decisions outstanding

See [CRM_V2_PHASE_00_COMPLETION.md](./CRM_V2_PHASE_00_COMPLETION.md) § Operator decisions.
