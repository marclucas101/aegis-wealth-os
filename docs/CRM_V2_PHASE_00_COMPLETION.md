# CRM V2 — Phase 00 Completion Report

**Phase:** 00 — Domain and Integration Blueprint  
**Branch:** `crm-v2-00-blueprint`  
**Date:** 2026-06-29

---

## Verdict

**READY FOR CRM V2 FOUNDATION**

---

## 1. Architecture decisions recorded

| Decision | Resolution |
|----------|------------|
| Domain chain | RELATIONSHIP → ENGAGEMENT → ADVICE → SERVICE |
| Parallel portal | `/advisor-v2` until Phase 14; `/advisor` unchanged |
| Relationship identity v1 | `relationshipId` = `clients.id` |
| Household model | Deferred — no forced migration |
| Appointment SOT | Evolve `adviser_appointments` — no competing table |
| Commitment SOT | New `service_commitments` table |
| Timeline | Virtual projection — no authoritative event table initially |
| Work queue | Virtual `AdviserWorkItem` — projection only |
| Communications SOT | `governed_content` retained; CRM drafts staging only |
| Protection | Structured policies additive; verification required |
| Google Calendar | AEGIS authoritative; one-way sync first |
| Advocacy | Append-only `advocacy_events`; yearly score derived |
| Ethnicity | Suggestions only; adviser override precedence |
| Naming | UI "adviser"; DB `advisor_*` frozen |
| 9F.4 | Observation continues; no Stage 6 |

Full detail: [CRM_V2_ARCHITECTURE_BLUEPRINT.md](./CRM_V2_ARCHITECTURE_BLUEPRINT.md)

---

## 2. Existing records reused

| Record | CRM role |
|--------|----------|
| `clients` | Relationship identity |
| `adviser_appointments` | Appointment SOT (extended) |
| `meeting_sessions` | Meeting Studio link via `appointment_id` |
| `advisor_tasks` | Legacy tasks + birthday reminders |
| `roadmap_items` | Advice / service actions |
| `published_outputs` | Planning outputs |
| `binder_exports` | Meeting packs |
| `documents` | Vault + protection PDFs |
| `governed_content` | Published communications |
| `communication_deliveries` | Delivery state |
| `discover_profiles` | Discover / financial plan read |
| `shield_scores`, `stress_tests`, `annual_reviews` | Advice diagnostics |
| `adviser_calendar_connections`, `adviser_calendar_settings` | Google OAuth |
| `adviser_profiles` | Adviser identity |
| `audit_logs`, `meeting_session_events` | Audit / timeline sources |
| `platform_feature_controls` | Feature gates |
| `client_notifications` | Client delivery |

---

## 3. New records approved

| Table | Phase |
|-------|-------|
| `appointment_participants` | 03 |
| `appointment_state_events` | 03 |
| `service_commitments` | 06 |
| `protection_policies` | 07 |
| `protection_policy_versions` | 07 |
| `relationship_moments` | 08 |
| `adviser_moment_overrides` | 08 |
| `clients.ethnicity` (column) | 08 |
| `advocacy_events` | 09 |
| `advocacy_score_config` | 09 |
| `crm_communication_drafts` | 10 |
| CRM feature control seeds | 01+ |

---

## 4. Route structure

- Primary V2: `/advisor-v2`
- Navigation: Today, Relationships, Appointments, Service, Communications, More
- APIs: `/api/advisor-v2/**` (new namespace)
- Legacy: `/advisor/**` frozen until Phase 14
- Cutover: `/advisor` → V2; `/advisor-legacy` audited fallback

Detail: [CRM_V2_ROUTE_MAP.md](./CRM_V2_ROUTE_MAP.md)

---

## 5. Feature controls

| Flag | Default |
|------|---------|
| `crm_v2_master` | false |
| `crm_v2_pilot_mode` | false |
| All sub-flags | false |
| `adviser_work_queue` | false (enable Phase 11) |
| `legacy_promotions_write` | false (unchanged) |

Pilot user IDs: operator-provided at pilot — not hardcoded.

Detail: [CRM_V2_FEATURE_CONTROL_PLAN.md](./CRM_V2_FEATURE_CONTROL_PLAN.md)

---

## 6. Migration sequence

Ordered M01–M11; **no migration in Phase 00**. First seed migration Phase 01. Appointment extension Phase 03 with diagnostics and dry-run only until operator approval.

Detail: [CRM_V2_MIGRATION_SEQUENCE.md](./CRM_V2_MIGRATION_SEQUENCE.md)

---

## 7. Compatibility strategy

- Parallel operation Phase 01–13
- No dual-write
- Client portal additive only
- Phase 14 cutover with 30-day observation
- Phase 15 legacy retirement conditional on audit

Detail: [CRM_V2_COMPATIBILITY_AND_CUTOVER.md](./CRM_V2_COMPATIBILITY_AND_CUTOVER.md)

---

## 8. Operator decisions still required

| # | Decision | Blocking |
|---|----------|----------|
| 1 | Approve blueprint and proceed to Phase 01 shell | Phase 01 |
| 2 | Confirm 9F.4 observation continues through CRM rollout | All phases |
| 3 | Provide pilot adviser user ID(s) before Phase 13 | Phase 13 |
| 4 | Approve appointment lifecycle enum migration (Phase 03) | Production appointments |
| 5 | Approve `service_commitments` schema (Phase 06) | Service layer |
| 6 | Approve protection verification workflow (Phase 07) | Protection portfolio |
| 7 | Approve ethnicity column and festive mapping content (Phase 08) | Moments |
| 8 | Approve advocacy weights and caps (Phase 09) | Advocacy |
| 9 | Approve Google Calendar privacy text for pilot (Phase 05) | Google sync |
| 10 | Approve cutover date and observation owner (Phase 14) | Cutover |
| 11 | Defer or approve household model (post-pilot) | Multi-person relationships |
| 12 | Resolve cash flow / goals dual SOT before cross-domain rules | Financial servicing rules |

---

## 9. QA results

QA executed **2026-06-29** on branch `crm-v2-00-blueprint`.

### Phase 00 blueprint gate (remediated)

| Metric | Before remediation | After remediation |
|--------|-------------------|-------------------|
| Explicit checks reported | 67 (grouped assertions) | **219** (one PASS line per check) |
| Minimum required | 120 | 120 |
| Result | 67/67 | **219/219 PASS** |

The validator prints `Defined explicit checks: N` before execution and fails if `N < 120`.

| Command | Result |
|---------|--------|
| `npm run qa:crm-v2-blueprint` | **PASS** — 219/219 explicit checks |
| `npm run qa:phase10-discovery` | **PASS** — 118/118 |
| `npm run qa:phase10-work-queue-core` | **PASS** — 135/135 |
| `npm run qa:phase9f4-app-retirement` | **PASS** — 115/115 |
| `npm run qa:phase9f3-binder-client-vault` | **PASS** — 198/198 |
| `npm run qa:phase9e-communications` | **PASS** — 87/87 |
| `npm run security:api` | **PASS** — 11/11 |
| `npm run security:advisor-access` | **PASS** |
| `npm run security:service-role` | **PASS** |
| `npm run final:check` | **PASS** — 7/7 |
| `npx tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npx supabase db push --dry-run` | **PASS** — Remote database is up to date |

---

## 10. Confirmation — no implementation or migration

| Check | Status |
|-------|--------|
| Migrations created | **No** — No migrations in Phase 00 |
| Migrations applied | **No** |
| Application routes modified | **No** |
| Production code changed | **No** — docs + QA script only; no implementation |
| Remote data altered | **No** |
| Features activated remotely | **No** |
| Deployment | **No** |
| Promotions Stage 6 begun | **No** |
| `/advisor` changed | **No** |
| `app/advisor-v2` created | **No** |

---

## 11. Deliverables checklist

| Deliverable | Path | Status |
|-------------|------|--------|
| Rollout index | `docs/CRM_V2_ROLLOUT_INDEX.md` | Done |
| Architecture blueprint | `docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md` | Done |
| Source of truth matrix | `docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md` | Done |
| Domain entity map | `docs/CRM_V2_DOMAIN_ENTITY_MAP.md` | Done |
| Visibility model | `docs/CRM_V2_VISIBILITY_MODEL.md` | Done |
| Route map | `docs/CRM_V2_ROUTE_MAP.md` | Done |
| Feature control plan | `docs/CRM_V2_FEATURE_CONTROL_PLAN.md` | Done |
| Migration sequence | `docs/CRM_V2_MIGRATION_SEQUENCE.md` | Done |
| Compatibility and cutover | `docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md` | Done |
| Security boundaries | `docs/CRM_V2_SECURITY_BOUNDARIES.md` | Done |
| QA script | `npm run qa:crm-v2-blueprint` | Done |
| Completion report | `docs/CRM_V2_PHASE_00_COMPLETION.md` | Done |

---

## 13. Phase 00 QA remediation (2026-06-29)

Expanded `scripts/run-crm-v2-blueprint-validation.ts` from 67 grouped tests to **219 independently reported checks** (minimum 120 required). Coverage additions include per-document existence/non-empty/heading validation, per-phase rollout index links, 25 SOT domain checks, split visibility/appointment/service/timeline/protection/moments/advocacy/Google Calendar assertions, per-flag feature control checks, and rollout safety guards.

Minimal documentation clarifications only (no architecture change):

- `relationshipId = clients.id` phrasing in architecture and entity map
- Travel availability (`away date`, `return date`) in entity map
- Additive migration sequence wording in migration sequence doc

---

## 14. Next phase

**Phase 01** on branch `crm-v2-01-shell`: implement `/advisor-v2` shell with `crm_v2_master` + pilot gating, placeholder pages, shared layout primitives. Stop after Phase 01.
