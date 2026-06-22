# Remote Migration Evidence Review

**Branch:** `migration-reconciliation`  
**Review date:** 2026-06-22 (finalised)  
**Evidence directory:** `supabase/diagnostics/results/` (optional JSON exports)

## Executive summary — OPERATOR-VERIFIED

The operator ran dedicated deep diagnostics in the linked Supabase SQL Editor and reported rollup classifications from screenshots. Row-level JSON exports could **not** be downloaded from the Supabase Dashboard. **No row-level JSON was fabricated** in this repository.

| Migration | Migration file | Dedicated diagnostic | Operator classification |
|-----------|----------------|----------------------|-------------------------|
| `202606100019` | `202606100019_adviser_profiles.sql` | `verify_202606100019_adviser_profiles.sql` | **EXACT_MATCH** |
| `202606100020` | `202606100020_google_calendar_booking.sql` | `verify_202606100020_google_calendar_booking.sql` | **EXACT_MATCH** |
| `202606100021` | `202606100021_phase6f_performance_indexes.sql` | `verify_202606100021_performance_indexes.sql` | **EXACT_MATCH** |
| `202606150001` | `202606150001_clients_user_id_unique.sql` | `verify_202606150001_clients_user_id_unique.sql` | **EXACT_MATCH** |
| `202606180001` | `202606180001_phase8a_client_birthday_reminders.sql` | `verify_202606180001_birthday_reminders.sql` | **EXACT_MATCH** |
| `202606180002` | `202606180002_phase8b_adviser_created_appointments.sql` | `verify_202606180002_adviser_created_appointments.sql` | **EXACT_MATCH** |

### Preflight remediation (`preflight_remediation.sql`)

| Result | Count |
|--------|-------|
| BLOCKER rows | **0** |
| UNKNOWN rows | **0** |
| WARNING rows | **1** (expected: pre-Phase-9 migration versions remain pending in `supabase_migrations.schema_migrations`) |

### Verdict

**OPERATOR-VERIFIED EXACT_MATCH** — all six pre-Phase-9 historical migrations are structurally exact on the remote database.

**No additive remediation migration is required.**  
Proposed reconciliation migrations `202606220001`–`202606220004` were **removed** from the repository migration chain because the original historical migrations already match remote schema.

---

## What remains to do (operator, human-only)

1. **Repair migration history** for the six verified versions (see `docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md`).
2. Confirm `npx supabase migration list` shows those versions as applied.
3. Confirm `npx supabase db push --dry-run` begins with Phase 9 migrations (`202606200001`–`202606200007`), not pre-Phase-9 migrations.
4. Apply Phase 9 in a separate approved change window.

`supabase migration repair` updates **migration history only**. It does **not** apply schema DDL and must not be represented as schema application.

---

## Optional JSON evidence

If row-level exports become available later, save them per `supabase/diagnostics/results/README.md`. JSON is supplementary; operator EXACT_MATCH classifications are the current authoritative evidence.

---

## Data-risk domains (cleared by operator verification)

The following risks were probed by `preflight_remediation.sql` before history repair. Operator reported no BLOCKER or UNKNOWN rows.

| Domain | Preflight probes | Status |
|--------|------------------|--------|
| `clients.user_id` duplicates | `clients.user_id_duplicate_probe` | Cleared (no BLOCKER) |
| Appointment overlaps / idempotency | `appointment.overlap_probe`, idempotency probes | Cleared |
| Invalid appointment status values | `invalid_*_probe` | Cleared |
| Future date-of-birth values | `birthday.invalid_date_of_birth_probe` | Cleared |
| Duplicate advisor task source keys | `birthday.duplicate_task_source_key_probe` | Cleared |

---

## Per-migration remediation column (final)

For all six migrations, **remediation action = none**. Schema already matches historical migration files.

| Migration | Prior design (superseded) | Final action |
|-----------|---------------------------|--------------|
| `202606100019`–`202606180002` | Additive `202606220001`–`004` reconciliation migrations | **Removed** — not required |
| All six | `migration repair --status applied` after EXACT_MATCH | **Required** (history only) |

---

## Operator information no longer blocking

- [x] Dedicated deep diagnostics: EXACT_MATCH for all six migrations
- [x] Preflight: no BLOCKER / no UNKNOWN
- [ ] Migration history repair (human-operated)
- [ ] Post-repair `migration list` + `db push --dry-run` confirmation
- [ ] Phase 9 staging approval (separate window)
