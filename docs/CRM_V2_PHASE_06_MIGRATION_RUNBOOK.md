# CRM V2 Phase 06 — Migration Runbook

## Migrations (do not auto-apply)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/202606290008_phase06_crm_v2_service_feature_control.sql` | Seed `crm_v2_service`, `crm_v2_client_service` (default disabled) |
| 2 | `supabase/migrations/202606290009_phase06_crm_v2_service_core.sql` | `service_commitments`, `client_service_requests`, event tables, RLS |

**Status:** Created in repository — **not applied** without operator Gate G7 approval.

---

## Diagnostics

### Feature control (`202606290008`)

- `supabase/diagnostics/preflight_202606290008_phase06_crm_v2_service_feature_control.sql`
- `supabase/diagnostics/verify_202606290008_phase06_crm_v2_service_feature_control.sql`
- `supabase/diagnostics/verify_202606290008_phase06_crm_v2_service_feature_control_discrepancies.sql`

### Service core (`202606290009`)

- `supabase/diagnostics/preflight_202606290009_phase06_crm_v2_service_core.sql`
- `supabase/diagnostics/verify_202606290009_phase06_crm_v2_service_core.sql`
- `supabase/diagnostics/verify_202606290009_phase06_crm_v2_service_core_discrepancies.sql`

---

## Apply order

1. Run `npx supabase db push --dry-run` — expect **only** Phase 06 migrations pending.
2. Execute preflight for `202606290008`.
3. Apply migration `202606290008`.
4. Run verify + discrepancy diagnostics for `202606290008`.
5. Execute preflight for `202606290009`.
6. Apply migration `202606290009`.
7. Run verify + discrepancy diagnostics for `202606290009`.
8. Confirm feature rows exist with `enabled = false`.
9. Enable flags via operator API/SQL only after staging QA.

---

## Schema summary (`202606290009`)

**Tables created:**

- `service_commitments` — canonical commitments
- `client_service_requests` — client-initiated requests
- `service_commitment_events` — immutable commitment history
- `client_service_request_events` — immutable request history

**Indexes:**

- `idx_service_commitments_idempotency` (partial, adviser + key)
- `idx_service_commitments_source_dedup` (partial, source + type)
- `idx_service_commitments_adviser_open` (open statuses, due_at)
- `idx_service_commitments_client_visible`
- `idx_service_commitments_appointment`
- `idx_client_service_requests_idempotency`
- `idx_client_service_requests_adviser_open`
- `idx_client_service_requests_client`
- Event tables: commitment/request + occurred_at

**RLS:** Enabled on all four tables; `DROP POLICY IF EXISTS` + `CREATE POLICY` for rerun safety.

**Triggers:** `set_updated_at` on commitments and requests with `DROP TRIGGER IF EXISTS` guard.

---

## Safety notes

- Additive only — no DROP of legacy tables
- No data migration from `advisor_tasks`
- No feature activation in SQL (`ON CONFLICT DO NOTHING`, `enabled = false`)
- No `advisor_work_items` table
- No protection/moments/advocacy schema
- Rollback: disable flags; schema retained

---

## Rollback

| Tier | Action |
|------|--------|
| Feature off | Set `crm_v2_service` and `crm_v2_client_service` to `enabled = false` |
| Full V2 off | `crm_v2_master = false` |
| Schema | Retain tables; no destructive rollback in pilot |

---

## Operator gate

**Gate G7** — Service core apply per `docs/CRM_V2_FEATURE_CONTROL_PLAN.md`
