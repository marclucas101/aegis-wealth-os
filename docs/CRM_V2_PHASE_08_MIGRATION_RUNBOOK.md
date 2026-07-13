# CRM V2 Phase 08 — Migration Runbook

## Migrations (do not auto-apply)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/202606290012_phase08_crm_v2_relationship_moments_feature_control.sql` | Seed `crm_v2_relationship_moments` + `crm_v2_client_profile` (default disabled) |
| 2 | `supabase/migrations/202606290013_phase08_crm_v2_relationship_moments_core.sql` | Moments tables, ethnicity column, review rhythm, preference updates, events, RLS |

**Branch:** `crm-v2-08-relationship-moments`  
**Status:** Created in repository — **not applied** without operator approval.

**Prerequisite:** Phase 06 migration `202606290009` applied (`client_service_requests`, `service_commitments` for FK and category ALTER). Phase 03 `adviser_appointments` for linked appointment FKs.

---

## Diagnostics

### Feature control (`202606290012`)

- `supabase/diagnostics/preflight_202606290012_phase08_crm_v2_relationship_moments_feature_control.sql`
- `supabase/diagnostics/verify_202606290012_phase08_crm_v2_relationship_moments_feature_control.sql`
- `supabase/diagnostics/verify_202606290012_phase08_crm_v2_relationship_moments_feature_control_discrepancies.sql`

### Core (`202606290013`)

- `supabase/diagnostics/preflight_202606290013_phase08_crm_v2_relationship_moments_core.sql`
- `supabase/diagnostics/verify_202606290013_phase08_crm_v2_relationship_moments_core.sql`
- `supabase/diagnostics/verify_202606290013_phase08_crm_v2_relationship_moments_core_discrepancies.sql`

---

## Apply order

1. Confirm Phase 06 core applied and verified on target database.
2. Run `npx supabase db push --dry-run` — expect Phase 08 migrations pending after earlier gates cleared.
3. Execute preflight for `202606290012`.
4. Apply migration `202606290012`.
5. Run verify + discrepancy diagnostics for `202606290012`.
6. Confirm rows exist:
   - `crm_v2_relationship_moments`: `enabled = false`, `client_visible = false`, `adviser_visible = true`
   - `crm_v2_client_profile`: `enabled = false`, `client_visible = true`, `adviser_visible = false`
7. Execute preflight for `202606290013` (checks `clients`, `adviser_appointments`, `service_commitments` present).
8. Apply migration `202606290013`.
9. Run verify + discrepancy diagnostics for `202606290013`.
10. Confirm tables: `relationship_moments`, `adviser_moment_overrides`, `festive_holiday_mappings`, `crm_review_rhythm`, `crm_client_preference_updates`, `relationship_moment_events`.
11. Confirm `clients.ethnicity` column and CHECK constraint.
12. Confirm `client_service_requests` CHECK includes `preference_update`, `review_request`.
13. Confirm RLS enabled on all new tables.
14. Enable flags via operator API/SQL only after staging QA.

---

## Schema summary (`202606290012`)

**Changes:**

- `INSERT INTO platform_feature_controls` two rows
- `ON CONFLICT (feature_key) DO NOTHING`
- Both `enabled = false` — fail closed

**No table DDL.**

---

## Schema summary (`202606290013`)

### ALTER existing

| Object | Change |
|--------|--------|
| `clients` | ADD `ethnicity TEXT` nullable + CHECK enum |
| `client_service_requests` | DROP/recreate `request_category` CHECK (+ preference_update, review_request) |

### Tables created

| Table | Purpose |
|-------|---------|
| `festive_holiday_mappings` | Read-only holiday reference (4 seeds) |
| `relationship_moments` | Canonical moment records |
| `adviser_moment_overrides` | Per-client festive include/exclude |
| `crm_review_rhythm` | Review cadence projection |
| `crm_client_preference_updates` | Pending client preference changes |
| `relationship_moment_events` | Immutable domain audit |

### Indexes (key)

| Index | Purpose |
|-------|---------|
| `idx_relationship_moments_idempotency` | `(client_id, idempotency_key)` partial unique |
| `idx_relationship_moments_adviser_date` | Adviser upcoming query |
| `idx_crm_review_rhythm_adviser_due` | Overdue/scheduled book query |
| `idx_crm_client_preference_updates_pending` | Pending preference queue |
| `idx_relationship_moment_events_client` | Timeline projection |

### Triggers

`set_updated_at()` on: `relationship_moments`, `adviser_moment_overrides`, `crm_review_rhythm`, `crm_client_preference_updates`.

All use `DROP TRIGGER IF EXISTS` before create — rerun safe.

---

## Rollback

| Tier | Action |
|------|------|
| Feature off | Set `crm_v2_relationship_moments` and `crm_v2_client_profile` to `enabled = false` |
| Stop writes | UI returns 403 — schema retained |
| Schema rollback | Manual down migration or retain tables (recommended) |
| `clients.ethnicity` | Nullable column may remain empty — no data loss on disable |

**Never** delete `relationship_moment_events` on rollback — audit retention.

---

## Verification queries (operator)

```sql
-- Feature seeds
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
WHERE feature_key IN ('crm_v2_relationship_moments', 'crm_v2_client_profile');

-- Table existence
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'relationship_moments', 'crm_review_rhythm',
    'crm_client_preference_updates', 'festive_holiday_mappings'
  );

-- Ethnicity constraint
SELECT conname FROM pg_constraint WHERE conname = 'clients_ethnicity_check';

-- Festive seeds
SELECT holiday_key, display_name FROM festive_holiday_mappings WHERE active = true;
```

---

## Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Data migration | **None** — greenfield tables, nullable ethnicity |
| Production client impact | **Low** — flags default off |
| FK dependency | **Medium** — requires appointments + service tables |
| RLS misconfiguration | **Low** — follows established `is_assigned_advisor` pattern |
| Category CHECK alter | **Low** — extends Phase 06 enum only |

---

## Post-apply enable sequence

```text
Staging:
  crm_v2_master + crm_v2_pilot_mode + pilot IDs
  → crm_v2_relationship_moments (pilot advisers)
  → crm_v2_client_profile (pilot clients)
  → crm_v2_client_service (if testing review requests)

Production: operator Gate after 39 manual tests pass
```

---

## Explicit exclusions (confirmed absent)

- No `advocacy_events` or scoring tables
- No `advisor_work_items` persistence
- No duplicate `clients.date_of_birth` column
- No DROP of legacy tables
- No Promotions Stage 6 changes
