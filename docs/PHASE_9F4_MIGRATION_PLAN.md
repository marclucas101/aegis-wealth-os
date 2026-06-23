# Phase 9F.4 — Migration Plan (Promotions Retirement)

**Checkpoint:** 9F.4 Checkpoint 2 — **migration `202606200011` created (additive feature seed); not applied remotely**

## Is a migration required?

| Phase | Migration required? | Type |
|-------|---------------------|------|
| Stage 1 (audit) | **No** | — |
| Stage 2 (write freeze) | **Yes** | `202606200011` — `legacy_promotions_write` seed only |
| Stage 3 (data migrate) | **No new DDL** | Use existing `legacyPromotionsMigration.ts` + `governed_content` |
| Stage 4 (route removal) | **No** | Application only |
| Stage 6 (schema retirement) | **Yes** — deferred | Destructive DDL in later approved checkpoint |

**Checkpoint 2 verdict:** Migration file ready for apply; destructive SQL still deferred.

---

## Applied migration version (Checkpoint 2)

| Attribute | Value |
|-----------|-------|
| Version | `202606200011_phase9f4_legacy_promotions_write_freeze.sql` |
| Type | Additive feature-control seed (`legacy_promotions_write`, default disabled) |
| Prerequisite | `202606200010` (Phase 9F.3 binder) applied |

---

## Proposed migration version (when Stage 6 approved)

| Attribute | Value |
|-----------|-------|
| Proposed version | `202606200012+` destructive retirement (reserved, not created) |
| Type | Additive first (read-only constraints, feature seeds); destructive in `202606200012+` only if approved |
| Prerequisite | `202606200010` (Phase 9F.3 binder) applied |

---

## Additive vs destructive stages

### Additive (safe, reversible)

- Seed `legacy_promotions_write` / `legacy_promotions_ui` in `platform_feature_controls` (if operator approves flags).
- `COMMENT ON TABLE promotions IS 'READ-ONLY — retired Phase 9F.4'`.
- Revoke INSERT/UPDATE/DELETE via RLS policy changes (non-destructive).

### Destructive (deferred — explicit approval)

- `DROP POLICY` / `DROP TABLE promotions`.
- `DELETE` from `storage.objects` in `promotion-assets`.
- `DROP TABLE promotion_migration_reviews` — **not recommended** (audit retention).

---

## Backfills

| Backfill | Method | When |
|----------|--------|------|
| Unmigrated promotions → governed drafts | `migratePromotionToDraft()` via admin API | Stage 3 |
| `promotion_migration_reviews` for skipped rows | Automatic on migration call | Stage 3 |
| Asset paths → governed content body | **Not implemented** — operator decision | Future implementation |
| Audit log entity links | None required — historical actions retained | — |

---

## Data-copy requirements

| Source | Target | Copy scope |
|--------|--------|------------|
| `promotions.title, summary, cta_url, ends_at` | `governed_content` | Implemented in migration service |
| `promotions.details, image, attachment` | — | **Not copied** — gap |
| `promotions.created_by` | `governed_content.adviser_user_id` | Implemented |
| Published status | **Not auto-published** — creates draft or submitted | By design |

---

## Compatibility period

| Period | Behavior |
|--------|----------|
| Stage 2–4 | Legacy read paths may remain for audit; writes disabled |
| Stage 5 | 30+ days observation (operator-tunable) |
| Client channel | `/insights` only — already production path |

---

## Rollback

| Change type | Rollback |
|-------------|----------|
| Feature flag write freeze | Disable flag |
| Route removal | Git revert |
| RLS policy tightening | Restore policies from migration rollback doc |
| DROP TABLE | Restore from backup only |

Document rollback in `docs/PHASE_9F4_MIGRATION_AND_ROLLBACK.md` when implementation begins (not created in this checkpoint).

---

## Diagnostics

| Diagnostic | Purpose | Status |
|------------|---------|--------|
| `supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql` | Pre-implementation row counts, FKs, blockers | **Created** (this checkpoint) |
| `npm run qa:phase9f4-audit` | Repo + doc validation | **Created** |

Run preflight against remote **read-only** before Stage 2.

---

## Retention

| Object | Retention policy |
|--------|------------------|
| `audit_logs` with `promotion_*` actions | **Indefinite** |
| `promotion_migration_reviews` | **Indefinite** |
| `promotions` rows (post-retirement) | Read-only until operator approves drop |
| `promotion-assets` objects | Until asset migration proven or operator waives |

---

## Operator approvals required before implementation

1. Approve Stage 2 write-freeze approach (flag vs route guard).
2. Approve migration run for unmigrated rows (list from preflight).
3. Approve asset handling policy.
4. Approve Stage 6 destructive DDL if ever pursued.
5. Approve observation period duration.

---

## Checkpoint compliance

| Restriction | Status |
|-------------|--------|
| No migration file created | ✓ |
| No remote database write | ✓ |
| No destructive SQL executed | ✓ |
| No feature activation | ✓ |
