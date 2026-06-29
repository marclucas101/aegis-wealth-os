# CRM V2 Phase 03 — Migration Runbook

**Migrations (not applied):**

1. `202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql`
2. `202606290004_phase03_crm_v2_appointment_core.sql`

---

## Pre-apply

1. Run `preflight_202606290003_*.sql` — expect READY
2. Run `preflight_202606290004_*.sql` — expect READY
3. `npm run qa:crm-v2-appointments-adviser`
4. `npx supabase db push --dry-run` — only Phase 03 migrations
5. Operator approves Gate G4

## Apply order

```text
202606290003  (feature seed)
202606290004  (schema extension)
```

## Post-apply verify

1. `verify_202606290003_*.sql` — feature disabled
2. `verify_202606290004_*.sql` — columns/tables present, appointment count preserved
3. Discrepancy scripts return zero rows

## Rollback

- Leave migrations applied; set `crm_v2_appointments_adviser = false`
- No column drops required

## Operator decisions

- Confirm `legacy_cancelled` read mapping acceptable
- Confirm no backfill of historical lifecycle events
- Enable feature only after staging pilot validation
