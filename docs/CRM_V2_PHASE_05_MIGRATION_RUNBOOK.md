# CRM V2 Phase 05 — Migration Runbook

## Migrations (do not auto-apply)

- `202606290006_phase05_crm_v2_google_calendar_feature_control.sql`
- `202606290007_phase05_crm_v2_google_calendar_core.sql`

## Diagnostics

- `preflight_202606290006_phase05_crm_v2_google_calendar_feature_control.sql`
- `verify_202606290006_phase05_crm_v2_google_calendar_feature_control.sql`
- `verify_202606290006_phase05_crm_v2_google_calendar_feature_control_discrepancies.sql`
- `preflight_202606290007_phase05_crm_v2_google_calendar_core.sql`
- `verify_202606290007_phase05_crm_v2_google_calendar_core.sql`
- `verify_202606290007_phase05_crm_v2_google_calendar_core_discrepancies.sql`

## Apply order

1. Execute preflight diagnostics.
2. Apply migration `202606290006`.
3. Verify/discrepancy diagnostics for `202606290006`.
4. Apply migration `202606290007`.
5. Verify/discrepancy diagnostics for `202606290007`.

## Safety notes

- Additive schema only.
- No token plaintext columns added.
- No feature activation performed by migration (default disabled).
