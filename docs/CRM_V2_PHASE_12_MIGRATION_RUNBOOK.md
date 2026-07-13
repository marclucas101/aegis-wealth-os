# CRM V2 Phase 12 — Migration Runbook

**Migration:** `202606290019_phase12_crm_v2_reports_operations_feature_control.sql`  
**Applied:** No (operator action required)

---

## Contents

Seeds only — no new tables:

- `crm_v2_reports` — `enabled=false`, `adviser_visible=true`, `client_visible=false`
- `crm_v2_operations` — `enabled=false`, `adviser_visible=true`, `client_visible=false`

`ON CONFLICT (feature_key) DO NOTHING` — safely rerunnable.

## Preflight

```bash
psql $DATABASE_URL -f supabase/diagnostics/preflight_202606290019_phase12_crm_v2_reports_operations_feature_control.sql
```

## Verify

```bash
psql $DATABASE_URL -f supabase/diagnostics/verify_202606290019_phase12_crm_v2_reports_operations_feature_control.sql
```

## Discrepancies

```bash
psql $DATABASE_URL -f supabase/diagnostics/verify_202606290019_phase12_crm_v2_reports_operations_feature_control_discrepancies.sql
```

Empty result = correct disabled seed state.

## Dry-run

```bash
npx supabase db push --dry-run
```

Expect only `202606290019_phase12_crm_v2_reports_operations_feature_control.sql`.

## Do not

- Enable features in migration
- Create report result tables
- Run migrations from app UI
- Store CLI credentials in app

## Activation

After apply, enable `crm_v2_reports` and `crm_v2_operations` through existing approved feature-control authority only.
