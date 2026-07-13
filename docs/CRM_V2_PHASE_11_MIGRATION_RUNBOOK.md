# CRM V2 Phase 11 — Migration Runbook

**Phase:** 11  
**Branch:** `crm-v2-11-today`

---

## 1. Migration file

| File | Purpose |
|------|---------|
| `202606290018_phase11_crm_v2_today_feature_control.sql` | Seed `crm_v2_today` and `adviser_work_queue` disabled |

**No schema tables.** Feature control seeds only.

---

## 2. Preflight

```bash
# Run against target database (read-only)
psql -f supabase/diagnostics/preflight_202606290018_phase11_crm_v2_today_feature_control.sql
```

Expect `platform_feature_controls_present = true`.

---

## 3. Apply

```bash
npx supabase db push
```

Or apply `202606290018` individually in order after Phase 10 migrations.

---

## 4. Verify

```bash
psql -f supabase/diagnostics/verify_202606290018_phase11_crm_v2_today_feature_control.sql
```

Expect both flags disabled, `crm_v2_today` adviser-only.

---

## 5. Discrepancies

```bash
psql -f supabase/diagnostics/verify_202606290018_phase11_crm_v2_today_feature_control_discrepancies.sql
```

Expect zero rows (no enabled flags, no client_visible on today).

---

## 6. Dry-run

```bash
npx supabase db push --dry-run
```

Should show only Phase 11 migration when Phases 01–10 already applied.

---

## 7. Feature activation (operator only)

1. Enable `crm_v2_master`
2. Enable `crm_v2_pilot_mode` + configure `CRM_V2_PILOT_USER_IDS`
3. Enable source module flags as needed
4. Enable `crm_v2_today`
5. Optionally enable `adviser_work_queue` for queue panel

**Not performed in blueprint phase.**

---

## 8. Rollback

Migration is additive `ON CONFLICT DO NOTHING`. Disable flags to deactivate; no destructive rollback required.
