# Phase 9F.4 — Release Sign-Off

Formal operator sign-off for Phase 9F.4 checkpoints. Each section records deployment approval, known waivers, and observation start.

---

## Checkpoint 2 — Write freeze

| Item | Status |
|------|--------|
| Migration `202606200011` applied | Operator confirmed |
| `legacy_promotions_write` default false | Operator confirmed |
| Adviser mutations blocked (403) | Operator confirmed |
| Client API fail-closed empty list | Operator confirmed |

---

## Checkpoint 3 — Migration review API

| Item | Status |
|------|--------|
| Admin migration UI `/admin/promotions-migration` | Operator confirmed |
| List / detail / preview / review endpoints | Operator confirmed |
| Idempotency via `promotion_migration_reviews` | Operator confirmed |
| Asset-blocked promotions return 409 | Operator confirmed |

---

## Checkpoint 3.1 — Atomic idempotency RPC

| Item | Status |
|------|--------|
| Migration `202606200012` applied | Operator confirmed |
| `execute_legacy_promotion_migration` RPC | Operator confirmed |
| Deterministic destination UUID | Operator confirmed |

---

## Checkpoint 4 — Application retirement

**Deployment date (production):** _[operator record — starts 30-day observation clock]_

### Preconditions verified

| Precondition | Verified |
|--------------|----------|
| Migrations `202606200011` and `202606200012` applied in production | Yes |
| `legacy_promotions_write = false` in production | Yes |
| Production `promotions` table row count = **0** | Yes |
| Option B selected — schema and bucket retained | Yes |
| Phase 9F.3 binder unaffected (smoke passed) | _[ operator ]_ |
| Governed Communications replacement paths live | Yes — `/advisor/insights`, `/insights` |

### Application retirement behaviour

| Surface | Expected | Verified |
|---------|----------|----------|
| `/advisor/promotions` | Redirect → `/advisor/insights?legacy_promotions_retired=1` | _[ ]_ |
| `/promotions` | Redirect → `/insights?legacy_promotions_retired=1` | _[ ]_ |
| Adviser promotion APIs | **410** `LEGACY_PROMOTIONS_RETIRED` | _[ ]_ |
| Client `GET /api/promotions` | `{ ok: true, promotions: [], retired: true, replacement: "insights" }` | _[ ]_ |
| Admin `/admin/promotions-migration` | Active for review | _[ ]_ |
| `promotion-assets` bucket | Retained — no deletion | _[ ]_ |

### Runtime concurrency acceptance waiver

| Item | Decision |
|------|----------|
| Staging script `npm run test:phase9f4-migration-idempotency-local` | **Not completed** at CP4 production deploy |
| Impact | Migrate POST endpoints return **403** `PHASE9F4_MIGRATION_RUNTIME_GATE_INCOMPLETE` |
| **Waiver approved** | **Yes** — application retirement does not require migrate execution when production `promotions` count = 0 |
| Follow-up | Complete staging acceptance before any production migrate execution if historical rows are restored or imported |

**Waiver rationale:** Checkpoint 4 retires application entry points and retains read-only schema. With zero production promotion rows, no migrate execution is required for go-live. Admin list/review remains available for observation. Concurrency acceptance is deferred without blocking retirement deploy.

**Waiver approver:** _[ name / role / date ]_

### Observation period

| Item | Value |
|------|-------|
| Start | Checkpoint 4 production deployment date |
| Duration | **30 calendar days** |
| Plan | `docs/PHASE_9F4_OBSERVATION_PLAN.md` |
| Asset plan | `docs/PHASE_9F4_PROMOTION_ASSET_OBSERVATION.md` |
| End review date | _[ Day 0 + 30 ]_ |

### Rollback acknowledgement

Operators acknowledge application rollback procedure: `docs/PHASE_9F4_RETIREMENT_ROLLBACK.md`. Schema rollback is not in scope.

### Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering lead | | | |
| Operations / compliance | | | |
| Product owner | | | |

**Checkpoint 4 application retirement approved for production:** _[ ] Yes  _[ ] No — blockers: _______________

---

## Post-observation (Stage 6 — optional)

Not part of Checkpoint 4 sign-off. Requires separate approval after observation exit criteria in `docs/PHASE_9F4_OBSERVATION_PLAN.md`.
