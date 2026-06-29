# CRM V2 Phase 04 — Migration Runbook

**Migration (not applied):**

- `202606290005_phase04_crm_v2_appointments_client_feature_control.sql`

## Pre-apply

1. Run `preflight_202606290005_phase04_crm_v2_appointments_client_feature_control.sql`
2. Run `npm run qa:crm-v2-appointments-client`
3. Run `npx supabase db push --dry-run` and confirm only Phase 04 migration pending

## Apply order

```text
202606290005 (feature seed only)
```

## Post-apply verify

1. Run `verify_202606290005_phase04_crm_v2_appointments_client_feature_control.sql`
2. Run discrepancy script and confirm zero rows:
   `verify_202606290005_phase04_crm_v2_appointments_client_feature_control_discrepancies.sql`

## Rollback

- Keep schema unchanged; set `crm_v2_appointments_client = false`.
- No destructive rollback required.
