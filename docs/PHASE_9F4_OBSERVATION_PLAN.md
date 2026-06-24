# Phase 9F.4 — Observation Plan (Checkpoint 4)

**Checkpoint:** 9F.4 Checkpoint 4 Application Retirement  
**Duration:** **30 calendar days** from Checkpoint 4 **production deployment**  
**Model:** Option B — application retired; schema and storage retained

---

## Purpose

Confirm that no production dependency on legacy Promotions surfaces remains before considering optional Stage 6 schema retirement. Observation runs in parallel with admin migration review for any residual historical rows (production currently reports **0** `promotions` rows).

---

## Observation start

| Event | Action |
|-------|--------|
| Checkpoint 4 deployed to production | Record deployment timestamp as **Day 0** |
| Operator sign-off | Complete `docs/PHASE_9F4_RELEASE_SIGNOFF.md` Checkpoint 4 section |
| Monitoring enabled | Audit log queries + optional preflight diagnostic weekly |

**End date:** Day 0 + 30 calendar days (operator may extend; do not shorten without documented waiver).

---

## In-scope monitoring

Track only **aggregate operational signals** (counts and rates — not row contents):

| Signal category | Examples |
|-----------------|----------|
| Retired route access | `legacy_promotions_retired_route_accessed`, redirect volume |
| Retired mutation blocks | `legacy_promotions_retired_mutation_blocked` |
| Replacement redirects | `legacy_promotions_replacement_redirected` |
| Schema posture | `promotions` row count, unmigrated queue count |
| Storage posture | `promotion-assets` object count |
| Operational | Support incidents, unknown dependencies, restore requests |

**Do not log** promotion title or body, query strings, storage paths, signed URLs, client data, or raw exceptions in retirement telemetry.

### 1. Legacy route access

| Signal | Expected | Alert if |
|--------|----------|----------|
| `legacy_promotions_replacement_redirected` | Low volume (bookmarks, old links) | Sustained high volume suggesting missing nav update |
| Direct hits to `/advisor/promotions`, `/promotions` | Redirect succeeds | 5xx on redirect pages |

### 2. Retired API access

| Signal | Expected | Alert if |
|--------|----------|----------|
| `legacy_promotions_retired_route_accessed` | Sporadic (integrations, cached clients) | Integration still calling adviser promotion GET in production |
| `legacy_promotions_retired_mutation_blocked` | Near zero | **Any sustained mutation attempts** — investigate client or script |
| Client `GET /api/promotions` | Compatibility traffic acceptable | Clients depend on non-empty `promotions` array |

### 3. Admin migration review

| Signal | Expected | Alert if |
|--------|----------|----------|
| Admin list/detail/review API usage | Operator-driven only | Unauthorized 403 patterns |
| `legacy_promotion_migration_started` | Zero while runtime gate incomplete | Unexpected migrate attempts succeeding |
| Runtime gate 403 (`PHASE9F4_MIGRATION_RUNTIME_GATE_INCOMPLETE`) | Expected on migrate POST until acceptance | Operators report blocked migrate after acceptance enabled |

### 4. Replacement channel health

| Signal | Expected | Alert if |
|--------|----------|----------|
| `/insights` client feed errors | None related to retirement | Feed regression |
| `/advisor/insights` authoring | Normal governed draft flow | Authoring blocked by misconfiguration |
| Governed Communications approval queue | Normal admin workflow | Backlog caused by retirement redirect confusion |

### 5. Schema retention

| Signal | Expected | Alert if |
|--------|----------|----------|
| `promotions` row count | Stable (production **0**) | Unexpected inserts |
| `legacy_promotions_write` | **false** | Enabled without documented rollback |
| `promotion-assets` bucket | Objects unchanged | Deletion or orphan warnings |

---

## Out of scope during observation

- Stage 6 `DROP TABLE` or bucket purge
- Enabling `legacy_promotions_write` for routine operations
- Forcing runtime concurrency acceptance waiver to execute production migrations (separate operator decision)

---

## Weekly operator checklist

1. Run `supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql` (or equivalent row counts).
2. Query audit logs for retirement actions (see audit table in `docs/PHASE_9F4_CHECKPOINT4_APPLICATION_RETIREMENT_AUDIT.md`).
3. Confirm `legacy_promotions_write` remains disabled in `platform_feature_controls`.
4. Review admin migration queue (`GET /api/admin/promotions-migration` retirement context).
5. Spot-check redirect: `/advisor/promotions` → `/advisor/insights?legacy_promotions_retired=1`.
6. Spot-check client API: authenticated client `GET /api/promotions` returns `retired: true`.
7. Confirm no binder or insights regressions (Phase 9F.3 smoke).

---

## Exit criteria (end of observation)

All must pass before Stage 6 consideration:

| # | Criterion |
|---|-----------|
| 1 | 30 days elapsed since production deployment |
| 2 | No sustained adviser mutation attempts on retired APIs |
| 3 | No production requirement for non-empty client promotion list |
| 4 | Admin migration queue disposition complete or explicitly waived |
| 5 | `promotion-assets` observation complete (see asset doc) |
| 6 | Operator documents go/no-go for optional schema retirement |

---

## Waivers

| Item | CP4 waiver |
|------|------------|
| Runtime concurrency acceptance | **Waived for application retirement release** — migrate execution remains gated until staging script passes |
| Production migration execution | Not required when `promotions` count = 0 |

Waivers do not authorize bucket deletion or schema drop without a new checkpoint.

---

## Escalation

| Condition | Action |
|-----------|--------|
| Critical dependency on retired adviser API | Application rollback per `docs/PHASE_9F4_RETIREMENT_ROLLBACK.md` |
| Unexpected `promotions` inserts | Disable writes (already false); investigate service-role callers |
| Asset integrity concern | Pause Stage 6 planning; follow `docs/PHASE_9F4_PROMOTION_ASSET_OBSERVATION.md` |
