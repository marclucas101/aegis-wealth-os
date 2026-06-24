# Phase 9F.4 — Application Retirement Rollback (Checkpoint 4)

**Scope:** Reversible **application-layer** rollback for Checkpoint 4. Option B schema and `promotion-assets` retention are unchanged by rollback — no data loss.

---

## Exception policy — unknown legacy records

If a previously unknown legacy promotion row appears:

1. **Do not restore adviser Legacy Promotions.**
2. Admin reviews the record via `/admin/promotions-migration`.
3. Complete staging concurrency acceptance before migration execution.
4. Migrate or classify through the controlled admin workflow.
5. Process the destination through normal Governed Communications approval.
6. Keep the source read-only.

Re-enabling `legacy_promotions_write` is emergency-only and requires explicit operator approval. Under **Checkpoint 4** code, flag re-enable does **not** restore adviser APIs — must revert application.

---

## When to rollback

| Scenario | Rollback type |
|----------|---------------|
| Undiscovered integration depends on adviser promotion GET/list | Application revert |
| Operators cannot perform critical work via `/advisor/insights` | Fix forward preferred; revert only if replacement broken |
| Client apps parse non-retired API shape | Usually fix client; revert if emergency |
| Accidental CP4 deploy to wrong environment | Application revert |

**Do not rollback for:** empty production promotion inventory, runtime gate blocking migrate, or observation period discomfort alone.

---

## What rollback restores (application revert)

Reverting Checkpoint 4 deployment (git revert or redeploy prior release) restores Checkpoint 2–3 behaviour:

| Surface | Pre-CP4 (Checkpoint 2 write freeze) |
|---------|-------------------------------------|
| `/advisor/promotions` | Adviser promotions manager UI (read-only when write disabled) |
| `/promotions` | Client promotions page (entitlement-gated) |
| Adviser APIs | GET list/detail allowed; mutations **403** `LEGACY_PROMOTIONS_WRITE_DISABLED` when flag false |
| Client API | `{ ok: true, promotions: [] }` without `retired: true` (fail-closed) |
| Redirects | None |
| 410 responses | None on adviser routes |

---

## What rollback does **not** restore

| Item | Reason |
|------|--------|
| Deleted git history | Use prior release tag |
| Schema changes | Migrations 011/012 remain applied — intentional |
| Bucket contents | Never deleted in CP4 |
| Runtime concurrency acceptance | Independent of rollback |

---

## Rollback procedure

### Step 1 — Decision

1. Confirm incident in production (not staging test).
2. Document reason and approver.
3. Prefer **fix forward** if `/advisor/insights` or admin paths suffice.

### Step 2 — Application revert

1. Identify last release **before** Checkpoint 4 retirement merge.
2. Deploy prior application bundle to production (standard release pipeline).
3. Do **not** roll back migrations `202606200011` or `202606200012`.

### Step 3 — Feature controls

1. Confirm `legacy_promotions_write` remains **false** unless emergency adviser writes required.
2. If emergency writes needed: enable via `/api/admin/feature-controls` **only** with operator approval and time limit.
3. Note: CP4 permanent retirement (`adviserLegacyPromotionsMutationsRetired`) exists **only** in CP4 code — reverting app removes 410 permanent block.

### Step 4 — Verification

1. `/advisor/promotions` loads manager UI.
2. `POST /api/advisor/promotions` → **403** when write disabled (not 410).
3. Client `/api/promotions` → empty list without `retired` flag.
4. Admin migration review still available.
5. Run Phase 9F.3 binder smoke test.

### Step 5 — Audit and communication

1. Log rollback in audit / change record.
2. Notify advisers of temporary restoration of legacy UI.
3. Reset observation clock if CP4 redeploy planned later.

---

## Partial rollback (not supported)

| Action | Supported? |
|--------|------------|
| Re-enable only adviser GET without UI | No — deploy consistent release |
| Re-enable writes via flag under CP4 code | **No** — CP4 returns 410 regardless |
| Disable redirects only | No — revert full CP4 commit set |

---

## Emergency write access (without full rollback)

Under **Checkpoint 2** code only (not CP4):

1. Enable `legacy_promotions_write` in platform feature controls.
2. Adviser may mutate **own** promotions only (ownership enforced).
3. Client API posture unchanged.
4. Disable flag after emergency.

Under **Checkpoint 4** code, flag re-enable does **not** restore adviser APIs — must revert application.

---

## Forward path after rollback

1. Fix root cause (integration, training, replacement gap).
2. Re-run `docs/PHASE_9F4_CHECKPOINT4_MANUAL_TESTS.md` on staging.
3. Redeploy Checkpoint 4 when approved.
4. Restart 30-day observation from new production deployment date.

---

## Schema rollback (explicitly out of scope)

Dropping `promotions`, revoking RLS, or deleting `promotion-assets` is **Stage 6** and requires separate backup + operator checkpoint. Not reversible without database restore.
