# CRM V2 Phase 13 — Rollback Runbook

**Branch:** `crm-v2-13-pilot-activation`  
**Principle:** Disable flags — **never delete data** on rollback.

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

## 2. Immediate feature-disable rollback

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

Also remove or clear `CRM_V2_PILOT_USER_IDS` and restart server.

---

## 3. Module-specific rollback

Disable in **reverse activation order** (see `CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md` §5).

| Module | Flag key | Client also? |
|--------|----------|--------------|
| Operations | `crm_v2_operations` | No |
| Reports | `crm_v2_reports` | No |
| Today | `crm_v2_today`, `adviser_work_queue` | No |
| Communications | `crm_v2_communications` | Yes — disable client_visible |
| Advocacy | `crm_v2_advocacy` | Yes |
| Client profile | `crm_v2_client_profile` | Yes |
| Relationship moments | `crm_v2_relationship_moments` | No |
| Protection | `crm_v2_protection_portfolio` | Yes |
| Client service | `crm_v2_client_service` | Yes |
| Service | `crm_v2_service` | No |
| Google Calendar | `crm_v2_google_calendar` | No — see §5 |
| Client appointments | `crm_v2_appointments_client` | Yes |
| Appointments adviser | `crm_v2_appointments_adviser` | No |
| Relationships | `crm_v2_relationships` | No |

**Example — disable communications:**

```text
PATCH /api/admin/feature-controls
{ "feature_key": "crm_v2_communications", "enabled": false, "client_visible": false }
```

---

## 4. Pilot allowlist removal

1. Remove `CRM_V2_PILOT_USER_IDS` from staging environment **or** set to empty
2. Restart deployment
3. Optionally disable `crm_v2_pilot_mode`

**Effect:** All advisers denied even if flags remain enabled.

**Do not** delete auth users or adviser records.

---

## 5. Google Calendar disconnect / revoke safety

| Step | Action |
|------|--------|
| 1 | Disable `crm_v2_google_calendar` |
| 2 | Adviser disconnects via existing `/advisor/my-profile` calendar section if connected |
| 3 | Do not delete `adviser_calendar_connections` rows — preserve audit trail |
| 4 | Verify no outbound sync jobs running |
| 5 | Run `verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql` |

**Do not** revoke production Google OAuth credentials from this runbook.

---

## 6. Stop client-visible modules

Priority order (disable first):

1. `crm_v2_communications` — prevents client message surface
2. `crm_v2_advocacy`
3. `crm_v2_client_profile`
4. `crm_v2_protection_portfolio`
5. `crm_v2_client_service`
6. `crm_v2_appointments_client`

For each: `enabled=false` AND `client_visible=false`.

**Verify:** Test client cannot access `/appointments`, `/actions`, `/protection`, `/preferences`.

---

## 7. Preserve data after rollback

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

## 8. What not to delete

| Item | Reason |
|------|--------|
| `platform_feature_controls` rows | Required for future enable |
| CRM V2 schema tables | Additive migrations |
| `adviser_appointments` CRM columns | Legacy mapping depends on them |
| Google OAuth tokens | Disconnect via UI; don't raw-delete without ops review |
| Client records | Never delete for rollback |
| Audit / event tables | Compliance |

---

## 9. When to escalate

| Signal | Escalation |
|--------|------------|
| Wrong client saw another client's data | **P0** — disable master; security incident |
| External email/SMS sent unintentionally | **P0** — disable communications; review delivery logs |
| Production flag enabled without approval | **P1** — disable master; audit who changed |
| Migration partially applied | **P1** — engineering + DBA; do not destructive repair |
| Google sync wrote wrong events | **P2** — disable google_calendar; manual calendar review |

---

## 10. Diagnostics after rollback

| Diagnostic | Purpose |
|------------|---------|
| `verify_phase13_crm_v2_feature_control_pilot_readiness.sql` | Confirm enabled count |
| `verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql` | Detect orphan enabled states |
| Phase-specific verify SQL | Module migration state |
| `npm run qa:crm-v2-pilot-readiness` | Repository consistency |

---

## 11. Legacy portal fallback

After rollback:

- Advisers use `/advisor` — unchanged
- `crm_v2_cutover` remains false (Phase 14)
- No client route rewrites occurred

---

## 12. Destructive rollback — prohibited

The following are **not** approved rollback actions:

- `DROP TABLE` on CRM V2 tables
- `DELETE FROM platform_feature_controls WHERE feature_key LIKE 'crm_v2_%'`
- `TRUNCATE` on appointment, service, protection, advocacy tables
- Migration repair without engineering review
- Production deployment without go/no-go
