# Migration History Repair Sequence

**Human-operated only.** This document does not execute any command.  
**No remote writes** are performed by generating this document.

## Context (2026-06-22)

All six pre-Phase-9 historical migrations were operator-verified as **EXACT_MATCH** via dedicated deep diagnostics. Preflight returned no BLOCKER or UNKNOWN rows. **No additive remediation migration is required.** Proposed `202606220001`–`202606220004` reconciliation files were removed from the repository.

`supabase migration repair` updates **migration history only** (`supabase_migrations.schema_migrations`). It does **not** run migration SQL and must **not** be represented as schema application. Remote schema already matches the historical migration files.

---

## Preconditions

- [x] Dedicated deep diagnostics: EXACT_MATCH for 019, 020, 021, 150001, 180001, 180002
- [x] `preflight_remediation.sql`: no BLOCKER, no UNKNOWN (expected WARNING for pending history)
- [ ] Operator confirmed Supabase project target (`npm run supabase:confirm-target`)
- [ ] Staging database backup completed and verified (recommended before history repair)

---

## Exact history-repair order

Repair **one version at a time**, only after confirming that version's dedicated diagnostic still reports EXACT_MATCH:

```text
1. 202606100019
2. 202606100020
3. 202606100021
4. 202606150001
5. 202606180001
6. 202606180002
```

For each version:

```text
Human only:
  supabase migration repair --status applied <version>
```

**Do not** run repair if structural verification fails.  
**Do not** batch-repair without per-version confirmation.

---

## Post-repair validation (required)

After all six versions are repaired:

### 1. Migration list

```text
npx supabase migration list
```

Confirm the six pre-Phase-9 versions show as **applied** and Phase 9 versions (`202606200001`–`202606200007`) remain **pending**.

### 2. Dry-run push

```text
npx supabase db push --dry-run
```

The dry run should **begin with Phase 9 migrations**, not pre-Phase-9 migrations (`202606100019`–`202606180002`).

If pre-Phase-9 migrations still appear in the dry run, history repair is incomplete or the wrong project was targeted.

### 3. Optional confirmation diagnostics

Re-run any dedicated verify script if uncertain. Export JSON to `supabase/diagnostics/results/` if downloads become available.

---

## Phase 9 (separate change window)

Do **not** include Phase 9 migrations in the pre-Phase-9 history repair step.

Read before Phase 9 apply:

- `docs/MIGRATION_CHAIN_AUDIT.md`
- `docs/MIGRATION_RECONCILIATION_PLAN.md`
- Phase 9 acceptance docs

Apply Phase 9 only after staging/backup approval.

---

## Explicit non-actions

- Do **not** run `supabase db reset` on production
- Do **not** batch `migration repair` without per-version verification
- Do **not** edit historical migration files (`202606100019`–`202606180002`)
- Do **not** re-introduce additive reconciliation migrations — schema is already exact
- Do **not** treat `migration repair` as applying DDL

---

## Diagnostic tools retained

These read-only tools remain for future drift detection:

- `supabase/diagnostics/preflight_remediation.sql`
- `supabase/diagnostics/verify_*.sql`
- `supabase/diagnostics/verify_remediation_result.sql`
- `npm run qa:diagnostic-sql-syntax`
- `npm run qa:migration-remediation`
- `npm run qa:migration-readiness`
- `npm run qa:migration-drift`
