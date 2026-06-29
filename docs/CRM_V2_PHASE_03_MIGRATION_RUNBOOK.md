# CRM V2 Phase 03 — Migration Runbook

**Migrations (applied):**

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

## Recovery record (applied)

1. `202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql` applied successfully.
2. `202606290004_phase03_crm_v2_appointment_core.sql` initially stopped because trigger `crm_appointment_checklist_items_set_updated_at` already existed.
3. Migration `202606290004` was patched for rerun safety by:
   - adding `DROP TRIGGER IF EXISTS crm_appointment_checklist_items_set_updated_at ON crm_appointment_checklist_items` before trigger creation;
   - adding `DROP POLICY IF EXISTS ...` before each of the five policy creations.
4. No tables, rows, or appointment IDs were deleted.
5. No migration-history repair command was used.
6. Migration `202606290004` subsequently applied successfully.
7. Remote migration state is up to date.
8. Trigger verification found exactly one checklist updated-at trigger.
9. All five appointment RLS policies exist exactly once.
10. Phase 03 verification diagnostics passed.
11. Phase 03 discrepancy diagnostics returned no rows.
12. `legacy_cancelled` remains the safe compatibility state for historical cancellations without reliable actor evidence.
13. No historical cancellation actor or lifecycle history was invented.
14. No CRM feature control was enabled.
15. All Phase 03 runtime manual tests remain **NOT RUN**.

## Rollback

- Leave migrations applied; set `crm_v2_appointments_adviser = false`
- No column drops required

## Operator decisions

- Confirm `legacy_cancelled` read mapping acceptable
- Confirm no backfill of historical lifecycle events
- Enable feature only after staging pilot validation
