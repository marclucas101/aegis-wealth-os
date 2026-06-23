# Phase 9F.4 — Retirement Architecture

**Checkpoint:** 9F.4 Checkpoint 1 (audit only)

## Options evaluated

### Option A — Retain indefinitely but hide

Code and schema remain; navigation removed (partially already true for clients).

| Pros | Cons |
|------|------|
| Zero migration risk | Adviser CRUD still active at `/advisor/promotions` |
| Reversible | Security gap (self-publish) persists |
| Audit history untouched | Two parallel content systems confuse operators |

**Verdict:** **Insufficient** — adviser write path still active; does not meet retirement goal.

---

### Option B — Deprecate application paths, retain historical schema

Routes and UI retired; `promotions` + `promotion-assets` + `promotion_migration_reviews` remain read-only for retention.

| Pros | Cons |
|------|------|
| Reversible at app layer | Schema still maintained |
| Audit + history preserved | Storage costs continue |
| No destructive SQL | Requires write-freeze enforcement |
| Aligns with "prefer reversible deprecation" | RLS client SELECT should be disabled in implementation |

**Verdict:** **Recommended primary model** for Phase 9F.4 implementation.

---

### Option C — Migrate retained data, then remove schema

Historical data copied to governed structures; destructive DDL in later checkpoint.

| Pros | Cons |
|------|------|
| Clean long-term schema | Irreversible without backup |
| Single content model | Requires proven migration completeness |
| | Audit FK references need care |

**Verdict:** **Deferred** — appropriate as **Stage 6 optional** after Option B observation period.

---

## Selected model

**Option B** (application deprecation + read-only schema retention) with **Option C** as an optional later stage.

**Rationale:**

1. Reverse dependencies show Phase 9E/9F/9F.2/9F.3 **do not require** promotions at runtime.
2. Client channel already uses `/insights`; `promotions` entitlement is hardcoded off.
3. Audit logs and `promotion_migration_reviews` require **retention**.
4. Checkpoint restrictions forbid destructive DDL now.
5. Partial replacement gaps (assets, unmigrated rows) need operator visibility before schema drop.

---

## Staged retirement sequence

### Stage 1 — Inventory and freeze (this checkpoint)

- Complete audits and preflight diagnostic.
- **No code removal.**
- Operator reviews unmigrated promotion counts.

### Stage 2 — Disable new writes (implementation checkpoint)

- Add route guards or feature controls (`legacy_promotions_write` — documented, not created here).
- Fail-closed: adviser POST/PATCH/upload return 403 with migration message.
- Existing published rows remain readable (read-only period).

### Stage 3 — Migrate active dependencies

- Run `POST /api/admin/promotions-migration` for unmigrated rows (operator runbook).
- Extend migration for assets if policy requires.
- Verify `insights` feed covers migrated published content after admin approval.

### Stage 4 — Remove routes and UI

- Remove `/promotions`, `/advisor/promotions`, promotion components, APIs.
- Remove nav catalogue entries.
- Remove `promotions` from middleware protected prefixes (or return 410).
- Keep persistence module read-only helpers if audit tooling needs them.

### Stage 5 — Observe

- 30-day minimum (operator-configurable).
- Monitor audit for `promotion_*` actions (should be zero).
- Confirm no client traffic to `/api/promotions`.

### Stage 6 — Optional schema retirement (explicit operator approval)

- Revoke RLS policies; revoke adviser INSERT/UPDATE/DELETE.
- Optionally `ALTER TABLE promotions SET READ ONLY` pattern (implementation detail).
- Storage bucket: archive or delete after asset migration proof.
- Destructive `DROP TABLE` only with backup + explicit checkpoint.

---

## Classification by stage

| Artifact | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 | Stage 6 |
|----------|---------|---------|---------|---------|---------|---------|
| `promotions` table | Keep | Keep | Read + migrate | Read-only | Read-only | Optional drop |
| `promotion-assets` | Keep | Keep | Migrate assets | Keep | Keep | Optional archive |
| `promotion_migration_reviews` | Keep | Keep | Keep | Keep | **Retain** | **Retain** |
| Adviser promotion UI | Keep | Keep | Keep | **Remove** | — | — |
| Client promotion API | Keep | Optional block | Keep read | **Remove** | — | — |
| `insights` feed | **Actively required** | same | same | same | same | same |

---

## Binder (Phase 9F.3) isolation

**Constraint:** Do not alter Phase 9F.3 binder behavior during promotions retirement.

Binder modules have **no import dependency** on promotions. Stages 2–4 touch only promotion paths.

---

## Rollback model

| Stage | Rollback |
|-------|----------|
| 2 (write freeze) | Re-enable feature flag / remove route guard |
| 4 (route removal) | Restore routes from git |
| 6 (schema drop) | **Not reversible** without DB restore — requires backup |

---

## Feature-control plan (not created in this checkpoint)

Existing flags related to promotions/campaigns:

| Flag | Default | Role |
|------|---------|------|
| `insights_and_updates` | enabled | Replacement client channel |
| `product_related_content` | disabled | Blocks promotional governed content |
| `market_updates` | enabled | Market update category |
| `admin_content_approval` | enabled | Admin approval workspace |
| `adviser_insight_authoring` | enabled | Adviser draft authoring |
| `scheduled_content_automation` | disabled | Governed content auto-publish |

**Proposed temporary controls (not created):**

| Proposed key | Default | Fail-closed | Effect on existing records | Rollback | Observation |
|--------------|---------|-------------|---------------------------|----------|-------------|
| `legacy_promotions_write` | `false` | Deny POST/PATCH/upload on adviser promotion APIs | Rows unchanged; reads continue | Set `enabled=true` | Until Stage 5 complete |
| `legacy_promotions_ui` | `false` | Hide `/advisor/promotions` nav + return 404/410 on pages | No data change | Re-enable flag | Optional — routes can 404 without flag |

**Avoid flag for:** code that is already dormant (`/promotions` client nav hidden via entitlements) — simple route removal in Stage 4 suffices.

**Fail-closed behavior:** When `legacy_promotions_write` is disabled, API returns 403 with operator message; no silent partial writes.

**Not needed:** A flag for client `/api/promotions` if route is removed in Stage 4 rather than left callable.

---

## Operator decisions required

1. Approve Option B as implementation target.
2. Set observation period length for Stage 5.
3. Decide asset migration scope (body-only vs full file copy).
4. Decide whether Stage 6 schema drop is ever desired.
5. Whether to add dedicated `compliance` role (separate audit doc).
