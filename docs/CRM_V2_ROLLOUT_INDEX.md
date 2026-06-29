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
| **04** | `crm-v2-04-appointments-client` | Client appointment collaboration | Pending |
| **05** | `crm-v2-05-google-calendar` | Google Calendar integration (AEGIS authoritative) | Pending |
| **06** | `crm-v2-06-service-commitments` | Service layer + commitments | Pending |
| **07** | `crm-v2-07-protection-portfolio` | Protection portfolio + verification | Pending |
| **08** | `crm-v2-08-relationship-moments` | Moments engine (birthdays, holidays, travel) | Pending |
| **09** | `crm-v2-09-advocacy` | Advocacy event tracking + yearly score | Pending |
| **10** | `crm-v2-10-communications` | CRM → governed communications bridge | Pending |
| **11** | `crm-v2-11-today-work-queue` | Today homepage + unified work queue | Pending |
| **12** | `crm-v2-12-reports-operations` | Reports + operator diagnostics | Pending |
| **13** | `crm-v2-13-pilot` | Controlled pilot | Pending |
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
