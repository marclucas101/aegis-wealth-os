# CRM V2 Phase 09 — Migration Runbook

## Migrations (do not auto-apply)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/202606290014_phase09_crm_v2_advocacy_feature_control.sql` | Seed `crm_v2_advocacy` (default disabled, `client_visible=true`, `adviser_visible=true`) |
| 2 | `supabase/migrations/202606290015_phase09_crm_v2_advocacy_core.sql` | Advocacy tables, score config seeds, RLS, triggers |

**Branch:** `crm-v2-09-advocacy`  
**Status:** Created in repository — **not applied** without operator approval.

**Prerequisites:**

- `clients`, `users` tables (FK targets)
- `adviser_appointments` (Phase 03) for `linked_appointment_id` FK
- `client_service_requests` (Phase 06) for `linked_service_request_id` FK
- `relationship_moments` (Phase 08) for `linked_relationship_moment_id` FK
- `set_updated_at()` function (existing platform)

---

## Diagnostics

### Feature control (`202606290014`)

- `supabase/diagnostics/preflight_202606290014_phase09_crm_v2_advocacy_feature_control.sql`
- `supabase/diagnostics/verify_202606290014_phase09_crm_v2_advocacy_feature_control.sql`
- `supabase/diagnostics/verify_202606290014_phase09_crm_v2_advocacy_feature_control_discrepancies.sql`

### Core (`202606290015`)

- `supabase/diagnostics/preflight_202606290015_phase09_crm_v2_advocacy_core.sql`
- `supabase/diagnostics/verify_202606290015_phase09_crm_v2_advocacy_core.sql`
- `supabase/diagnostics/verify_202606290015_phase09_crm_v2_advocacy_core_discrepancies.sql`

---

## Apply order

1. Confirm Phase 06 and Phase 08 core migrations applied on target database (FK dependencies).
2. Run `npx supabase db push --dry-run` — expect Phase 09 migrations pending.
3. Execute preflight for `202606290014`.
4. Apply migration `202606290014`.
5. Run verify + discrepancy diagnostics for `202606290014`.
6. Confirm row exists:
   - `crm_v2_advocacy`: `enabled = false`, `client_visible = true`, `adviser_visible = true`
7. Execute preflight for `202606290015`.
8. Apply migration `202606290015`.
9. Run verify + discrepancy diagnostics for `202606290015`.
10. Confirm tables: `advocacy_score_config`, `crm_client_advocacy_preferences`, `advocacy_events`, `advocacy_domain_events`.
11. Confirm score config seeds (5 rows) with `ON CONFLICT DO NOTHING`.
12. Confirm indexes: idempotency, adviser_date, client_active, follow_up, domain_events.
13. Confirm RLS enabled on all four tables.
14. Confirm triggers: `advocacy_events_set_updated_at`, `crm_client_advocacy_preferences_set_updated_at`.
15. Enable `crm_v2_advocacy` via operator API/SQL only after staging QA.

---

## Schema summary (`202606290014`)

**Changes:**

- `INSERT INTO platform_feature_controls` one row for `crm_v2_advocacy`
- `ON CONFLICT (feature_key) DO NOTHING`
- `enabled = false` — fail closed

**No table DDL.**

---

## Schema summary (`202606290015`)

### Tables created

| Table | Purpose |
|-------|---------|
| `advocacy_score_config` | Operator weights, category caps, max yearly score |
| `crm_client_advocacy_preferences` | Client consent aggregate per `client_id` |
| `advocacy_events` | Canonical advocacy event records |
| `advocacy_domain_events` | Immutable domain audit log |

### Notable constraints

- No Promotions Stage 6 DROP
- No sales-opportunity or ranking priority schema
- `advocacy_events` append-only semantics (soft deactivate via `active`)
- CHECK constraints on event types, consent states, visibility, follow-up status

### RLS

| Table | Access |
|-------|--------|
| `advocacy_events` | Assignment-scoped ALL |
| `advocacy_score_config` | SELECT all authenticated |
| `crm_client_advocacy_preferences` | Assignment, admin, or owning client |
| `advocacy_domain_events` | SELECT assignment; INSERT assignment/admin/client |

---

## Rollback

| Level | Action |
|-------|--------|
| Feature | Set `crm_v2_advocacy.enabled = false` |
| Application | Disable flag stops new writes; APIs return 403 |
| Schema | **Retain** tables — no DROP on rollback |
| Data | Events preserved for audit |

---

## Post-apply verification queries

```sql
-- Feature seed
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
WHERE feature_key = 'crm_v2_advocacy';

-- Score config seeds
SELECT config_key, event_type, points, category_cap, max_yearly_score
FROM advocacy_score_config
ORDER BY config_key;

-- RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'advocacy_events',
    'advocacy_score_config',
    'crm_client_advocacy_preferences',
    'advocacy_domain_events'
  );
```

---

## Operator sign-off

| Step | Owner | Date | Pass |
|------|-------|------|------|
| Dry-run reviewed | | | |
| Preflight 014 | | | |
| Apply 014 | | | |
| Verify 014 | | | |
| Preflight 015 | | | |
| Apply 015 | | | |
| Verify 015 | | | |
| Manual tests (42) | | | |
| Feature enable (staging) | | | |

**Migrations status:** NOT APPLIED (as of documentation delivery)
