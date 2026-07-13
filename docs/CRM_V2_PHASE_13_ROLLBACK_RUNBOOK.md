# CRM V2 Phase 13 — Rollback Runbook

**Branch:** `crm-v2-13-pilot-activation`  
**Principle:** Disable flags — **never delete data** on rollback.  
**Status:** Limited pilot — not production launch rollback policy sign-off.

---

## 1. Rollback levels

| Level | Speed | Scope | Data impact |
|-------|-------|-------|-------------|
| **L0 Emergency** | Immediate | `crm_v2_master=false` | None — access denied |
| **L1 Module** | Minutes | Single sub-flag `enabled=false` | None — module read/write stops |
| **L2 Client surface** | Minutes | Client-visible flag off + `client_visible=false` | None |
| **L3 Pilot** | Minutes | `crm_v2_pilot_mode=false` or clear allowlist | None |
| **L4 Full V2 off** | Minutes | Master + pilot + all sub-flags off | None |
| **L5 Schema** | **Not supported** | DROP TABLE / DELETE rows | **Prohibited** |

---

## 2. Rollback SQL (operator — staging only)

**Prefer admin API when available:** `PATCH /api/admin/feature-controls`

Use SQL only when admin UI/API unavailable. All statements below are **non-destructive** (`UPDATE` only). Run in Supabase SQL editor for the target environment.

### L0 — Emergency: stop all CRM V2 access

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_master';
```

Also clear `CRM_V2_PILOT_USER_IDS` in deployment env and redeploy (allowlist is not in DB).

### L3 — Stop pilot only

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_pilot_mode';
```

Clear `CRM_V2_PILOT_USER_IDS`; redeploy.

### L1 — Disable single adviser module (example: relationships)

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_relationships';
```

### L2 — Disable client-visible module (example: communications)

```sql
UPDATE platform_feature_controls
SET enabled = false, client_visible = false, updated_at = now()
WHERE feature_key = 'crm_v2_communications';
```

### L4 — Disable all CRM V2 module flags (keep rows; master off is sufficient for lockout)

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key LIKE 'crm_v2_%' OR feature_key = 'adviser_work_queue';
```

**Verify after any rollback SQL:**

```sql
-- Read-only verification
SELECT feature_key, enabled, client_visible
FROM platform_feature_controls
WHERE feature_key LIKE 'crm_v2_%' OR feature_key = 'adviser_work_queue'
ORDER BY feature_key;
```

```sql
-- File: supabase/diagnostics/verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql
-- Expect empty or only informational rows (e.g. pilot_mode reminder)
```

### Prohibited rollback SQL

```sql
-- DO NOT RUN
DELETE FROM platform_feature_controls WHERE feature_key LIKE 'crm_v2_%';
DROP TABLE ...;
TRUNCATE ...;
```

---

## 3. Immediate feature-disable rollback (admin API)

### Stop all CRM V2 access now

```text
PATCH /api/admin/feature-controls
{ "feature_key": "crm_v2_master", "enabled": false }
```

**Confirm:**

- Pilot adviser cannot open `/advisor-v2`
- APIs return feature-disabled
- Legacy `/advisor` unaffected

### Stop pilot only (keep master for future)

```text
PATCH /api/admin/feature-controls
{ "feature_key": "crm_v2_pilot_mode", "enabled": false }
```

Also remove or clear `CRM_V2_PILOT_USER_IDS` and restart/redeploy.

---

## 4. Module-specific rollback

Disable in **reverse activation order** (see `CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md` §5).

| Module | Flag key | Client also? |
|--------|----------|--------------|
| Operations | `crm_v2_operations` | No |
| Reports | `crm_v2_reports` | No |
| Today | `crm_v2_today`, `adviser_work_queue` | No |
| Communications | `crm_v2_communications` | Yes — `client_visible=false` |
| Advocacy | `crm_v2_advocacy` | Yes |
| Client profile | `crm_v2_client_profile` | Yes |
| Relationship moments | `crm_v2_relationship_moments` | No |
| Protection | `crm_v2_protection_portfolio` | Yes |
| Client service | `crm_v2_client_service` | Yes |
| Service | `crm_v2_service` | No |
| Google Calendar | `crm_v2_google_calendar` | No — see §6 |
| Client appointments | `crm_v2_appointments_client` | Yes |
| Appointments adviser | `crm_v2_appointments_adviser` | No |
| Relationships | `crm_v2_relationships` | No |

---

## 5. Pilot allowlist removal

1. Remove `CRM_V2_PILOT_USER_IDS` from deployment environment **or** set to empty
2. Redeploy or restart server
3. Optionally disable `crm_v2_pilot_mode` (SQL or API above)

**Effect:** All advisers denied even if flags remain enabled.

**Do not** delete auth users or adviser records.

---

## 6. Google Calendar disconnect / revoke safety

| Step | Action |
|------|--------|
| 1 | Disable `crm_v2_google_calendar` (SQL or API) |
| 2 | Adviser disconnects via `/advisor-v2/settings/integrations/google-calendar` or `/advisor/my-profile` |
| 3 | Do not delete `adviser_calendar_connections` rows — preserve audit trail |
| 4 | Verify no outbound sync jobs running |
| 5 | Run discrepancy diagnostic SQL |

**Do not** revoke production Google OAuth credentials from this runbook without ops review.

---

## 7. Stop client-visible modules (priority order)

1. `crm_v2_communications`
2. `crm_v2_advocacy`
3. `crm_v2_client_profile`
4. `crm_v2_protection_portfolio`
5. `crm_v2_client_service`
6. `crm_v2_appointments_client`

For each: `enabled=false` AND `client_visible=false`.

**Verify:** Test client cannot access `/appointments`, `/actions`, `/protection`, `/preferences`.

---

## 8. Preserve data after rollback

| Data type | On rollback |
|-----------|-------------|
| Appointments (CRM lifecycle) | Retained |
| Service commitments / requests | Retained |
| Protection policies / versions | Retained |
| Relationship moments | Retained |
| Advocacy events | Retained |
| Communication drafts | Retained |
| Feature-control rows | Retained — only `enabled` toggled |
| Pilot-created test records | Retained — mark as test data in operator log |

**Rollback does not delete pilot-created records.**

---

## 9. What not to delete

| Item | Reason |
|------|--------|
| `platform_feature_controls` rows | Required for future enable |
| CRM V2 schema tables | Additive migrations |
| `adviser_appointments` CRM columns | Legacy mapping depends on them |
| Google OAuth tokens | Disconnect via UI; don't raw-delete without ops review |
| Client records | Never delete for rollback |
| Audit / event tables | Compliance |

---

## 10. No-go conditions (rollback required)

Rollback immediately if:

| Condition | Action |
|-----------|--------|
| Cross-client data visible | L0 + incident log |
| Unintended external send | Disable communications + L0 if needed |
| Non-pilot adviser gained access | L3 + clear allowlist |
| Client-visible flags enabled without sign-off | L2 all client flags |
| Advocacy used for ranking/sales priority | Stop module; log; review |
| Ethnicity used outside festive/moment context | Stop module; log; review |

Full list: `docs/CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md` §5.

---

## 11. Issue logging procedure

Log **before** resuming pilot after any rollback.

| Field | Required |
|-------|----------|
| Incident ID / ticket | Yes |
| Date/time | Yes |
| Environment | staging / local / production |
| Trigger | What operator or user observed |
| Severity | Low / Medium / High / Critical |
| Rollback level used | L0–L4 |
| SQL or API commands run | Copy commands (not secrets) |
| Flag state after rollback | Paste verification SQL output |
| Evidence | Screenshot / HAR / recording link |
| Resume approved by | Operator name — Yes/No |

Store logs per team policy. Do not include passwords, service role keys, or OAuth secrets.

---

## 12. When to escalate

| Signal | Escalation |
|--------|------------|
| Wrong client saw another client's data | **P0** — L0; security incident |
| External email/SMS sent unintentionally | **P0** — disable communications; delivery log review |
| Production flag enabled without approval | **P1** — L0; audit who changed |
| Migration partially applied | **P1** — engineering + DBA; no destructive repair |
| Google sync wrote wrong events | **P2** — disable google_calendar; manual calendar review |

---

## 13. Diagnostics after rollback

| Diagnostic | Purpose |
|------------|---------|
| `verify_phase13_crm_v2_feature_control_pilot_readiness.sql` | Confirm enabled count |
| `verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql` | Detect orphan enabled states |
| Phase-specific verify SQL | Module migration state |
| `npm run qa:crm-v2-pilot-readiness` | Repository consistency |

---

## 14. Legacy portal fallback

After rollback:

- Advisers use `/advisor` — unchanged
- `crm_v2_cutover` remains false (Phase 14)
- No client route rewrites occurred

---

## 15. Destructive rollback — prohibited

- `DROP TABLE` on CRM V2 tables
- `DELETE FROM platform_feature_controls WHERE feature_key LIKE 'crm_v2_%'`
- `TRUNCATE` on appointment, service, protection, advocacy tables
- Migration repair without engineering review
- Production deployment without go/no-go

---

## 16. Related documents

| Document | Purpose |
|----------|---------|
| `CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md` | Day-to-day pilot scope and rules |
| `CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md` | Pre-pilot checklist and no-go |
| `CRM_V2_PHASE_13_STAGING_ACTIVATION_RUNBOOK.md` | Enable procedures |
| `CRM_V2_PHASE_13_PILOT_DATA_SAFETY.md` | Test data rules |
