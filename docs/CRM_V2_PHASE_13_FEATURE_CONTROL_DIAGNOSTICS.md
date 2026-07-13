# CRM V2 Phase 13 — Feature Control Diagnostics

**Branch:** `crm-v2-13-pilot-activation`  
**Rule:** Read-only. Does not mutate feature-control state.

---

## 1. Diagnostic files

| File | Purpose |
|------|---------|
| `supabase/diagnostics/preflight_phase13_crm_v2_feature_control_pilot_readiness.sql` | Table presence + CRM V2 row count |
| `supabase/diagnostics/verify_phase13_crm_v2_feature_control_pilot_readiness.sql` | Full state catalog + safety summary |
| `supabase/diagnostics/verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql` | Returns rows only on unsafe state |

**No Phase 13 migration.** Diagnostics are operator-run SQL only.

---

## 2. What each diagnostic detects

### Preflight

- `platform_feature_controls` table exists
- Count of `crm_v2_*` rows

### Verify (summary row)

| Field | Meaning |
|-------|---------|
| `crm_v2_flag_rows` | Total CRM V2 + `adviser_work_queue` rows |
| `enabled_crm_v2_flag_count` | Count of enabled flags |
| `enabled_feature_keys` | Comma-separated enabled keys |
| `crm_v2_master_enabled` | 0/1 master state |
| `crm_v2_pilot_mode_enabled` | 0/1 pilot mode state |
| `client_visible_enabled_count` | Enabled flags with `client_visible=true` |
| `client_visible_enabled_keys` | Which client-visible flags are on |
| `sub_flags_enabled_without_master_or_pilot` | Dependency violation count |
| `sub_flags_without_gates_keys` | Which sub-flags violate gate order |
| `duplicate_feature_key_count` | Duplicate row detection |
| `pilot_allowlist_env_note` | Reminder that env is not SQL-detectable |

### Verify (detail rows)

One row per CRM V2 feature key with `enabled`, `client_visible`, `adviser_visible`.

### Discrepancies

| Issue code | Condition |
|------------|-----------|
| `sub_flag_enabled_without_master_or_pilot` | Sub-flag on while master or pilot off |
| `client_visible_flag_enabled` | Any client-visible flag enabled (staging baseline should be off) |
| `duplicate_feature_control_row` | More than one row per feature key |
| `pilot_mode_enabled_operator_must_confirm_CRM_V2_PILOT_USER_IDS` | Pilot on — operator must confirm env |
| `crm_v2_flag_missing_from_catalog` | Expected seed key absent from DB |

---

## 3. Required checks (operator)

| # | Check | SQL / command |
|---|-------|---------------|
| 1 | List all CRM V2 states | `verify_phase13_*_pilot_readiness.sql` detail rows |
| 2 | List enabled flags | Summary `enabled_feature_keys` |
| 3 | Detect flags without master/pilot | Summary `sub_flags_without_gates_keys` |
| 4 | Detect client-visible enabled | Summary `client_visible_enabled_keys` |
| 5 | Pilot without allowlist | **Manual** — confirm `CRM_V2_PILOT_USER_IDS` in deployment env when pilot_mode on |
| 6 | Duplicate rows | Summary `duplicate_feature_key_count` |

---

## 4. Expected baseline (pre-activation)

| Signal | Expected |
|--------|----------|
| `enabled_crm_v2_flag_count` | `0` |
| `crm_v2_master_enabled` | `0` |
| `crm_v2_pilot_mode_enabled` | `0` |
| `client_visible_enabled_count` | `0` |
| `sub_flags_enabled_without_master_or_pilot` | `0` |
| Discrepancies query | Empty result set |

---

## 5. Post-activation expectations

After controlled staging activation:

- `enabled_feature_keys` matches operator intent only
- `sub_flags_enabled_without_master_or_pilot` = `0`
- If pilot_mode = 1, operator has confirmed allowlist in env
- Client-visible keys enabled only when deliberately testing client modules

---

## 6. Integration with Operations projection

Phase 12 Operations workspace (`/advisor-v2/operations`) includes a Feature Controls panel when `crm_v2_operations` is enabled. Phase 13 diagnostics are the **authoritative SQL catalog** for operator pre-flight — Operations panel is supplementary.

---

## 7. Syntax validation

```bash
npm run qa:diagnostic-sql-syntax
```

Includes Phase 13 diagnostic files.

---

## 8. What diagnostics do not do

- Do not `UPDATE` or `DELETE` feature controls
- Do not read `CRM_V2_PILOT_USER_IDS` (not in database)
- Do not apply migrations
- Do not connect to production from repository scripts
