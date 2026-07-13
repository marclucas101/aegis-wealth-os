# CRM V2 Phase 13 — Day 1 Go / No-Go

**Pilot type:** One low-risk real client — limited validation  
**Not:** Production launch approval

**Issue log:** [CRM_V2_PHASE_13_PILOT_ISSUE_LOG.md](./CRM_V2_PHASE_13_PILOT_ISSUE_LOG.md)  
**Rollback SQL:** [CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md](./CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md) §2

---

## 1. Pre-invite checklist (operator)

Mark: **PASS** / **FAIL** / **BLOCKED** / **NOT RUN** — evidence required for PASS.

| ID | Check | Status | Evidence | Notes |
|----|-------|--------|----------|-------|
| PI-01 | Branch / deploy target confirmed | NOT RUN | | |
| PI-02 | `git status` clean or only expected doc changes | NOT RUN | | |
| PI-03 | `npm run final:check` passed | NOT RUN | | 7/7 on 2026-07-13 (repo) |
| PI-04 | `npm run qa:crm-v2-pilot-readiness` passed | NOT RUN | | 382/382 on 2026-07-13 (repo) |
| PI-05 | `CRM_V2_PILOT_USER_IDS` in env + server restarted | NOT RUN | | |
| PI-06 | `/api/advisor-v2/shell` → `available: true` (pilot) | NOT RUN | | |
| PI-07 | Feature flags match Day 1 plan (SQL) | NOT RUN | | |
| PI-08 | Discrepancy SQL reviewed | NOT RUN | | |
| PI-09 | Adviser routes A1–A7 in Day 1 doc | NOT RUN | | |
| PI-10 | Client selected per criteria; exclusions none | NOT RUN | | |
| PI-11 | Client assigned to pilot adviser | NOT RUN | | |
| PI-12 | Client script reviewed by adviser | NOT RUN | | |
| PI-13 | Rollback drill done once | NOT RUN | | |
| PI-14 | Issue log file ready | NOT RUN | | |

**Pre-invite go:** All PI-01–PI-13 **PASS** or documented **BLOCKED** with waiver. Any **FAIL** → do not invite.

---

## 2. Live test checklist (during client pilot)

| ID | Check | Status | Evidence | Notes |
|----|-------|--------|----------|-------|
| LT-01 | Client received invite (manual channel) | NOT RUN | | |
| LT-02 | Client login successful | NOT RUN | | |
| LT-03 | C1 `/appointments` (if enabled) | NOT RUN | | |
| LT-04 | C2 `/appointments/request` (if enabled) | NOT RUN | | |
| LT-05 | C4–C6 service routes (if enabled) | NOT RUN | | |
| LT-06 | Data privacy D1–D3 | NOT RUN | | |
| LT-07 | No unintended external send | NOT RUN | | |
| LT-08 | Google checks G1–G6 (if calendar on) | NOT RUN | | BLOCKED if calendar off |
| LT-09 | Follow-up questions completed | NOT RUN | | |
| LT-10 | 24–48h observation period started | NOT RUN | | |

---

## 3. Post-test adviser verification

| ID | Check | Status | Evidence | Notes |
|----|-------|--------|----------|-------|
| PV-01 | Adviser sees client action in V2 (appointment/request) | NOT RUN | | |
| PV-02 | Assignment scope correct — no other clients leaked | NOT RUN | | |
| PV-03 | Legacy `/advisor` still usable | NOT RUN | | |
| PV-04 | No advocacy score used for prioritisation | NOT RUN | | |
| PV-05 | No ethnicity used outside festive/moment rules | NOT RUN | | |
| PV-06 | Issue log updated (or "no issues") | NOT RUN | | |

---

## 4. No-go conditions (immediate stop)

| # | Condition | Action |
|---|-----------|--------|
| 1 | Client sees another client's data | L0 rollback + Critical log |
| 2 | Unintended email/SMS/WhatsApp | Disable communications + L0 if needed |
| 3 | Non-pilot adviser accesses V2 | L3 + clear allowlist |
| 4 | `CRM_V2_PILOT_USER_IDS` missing at runtime | Fix env; do not invite |
| 5 | Client distress or complaint about pilot | Pause; adviser handles; rollback client flags |
| 6 | Google event contains sensitive fields | Disable `crm_v2_google_calendar` |
| 7 | Cannot rollback within 15 minutes | Escalate engineering |
| 8 | Pre-invite **FAIL** on PI-05 or PI-06 | Do not invite |

Full list: `CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md` §5.

---

## 5. Rollback SQL quick reference

See full runbook. Examples (staging operator SQL editor):

**Full CRM V2 lockout:**

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_master';
```

**Client portal only:**

```sql
UPDATE platform_feature_controls
SET enabled = false, client_visible = false, updated_at = now()
WHERE feature_key IN (
  'crm_v2_appointments_client',
  'crm_v2_client_service',
  'crm_v2_protection_portfolio',
  'crm_v2_client_profile',
  'crm_v2_advocacy',
  'crm_v2_communications'
);
```

**Google Calendar only:**

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_google_calendar';
```

Verify:

```sql
SELECT feature_key, enabled, client_visible
FROM platform_feature_controls
WHERE feature_key LIKE 'crm_v2_%'
ORDER BY feature_key;
```

---

## 6. Decision options (after live test + observation)

Select **one** after PI/LT/PV review and 24–48h rule (unless Critical stop):

| Option | When | Actions |
|--------|------|---------|
| **Continue with 1 client** | All critical checks PASS; minor issues logged | Keep flags; continue observation; no second client yet |
| **Pause pilot** | Medium issues; no data leak | Stop new client actions; adviser uses legacy; flags may stay on for investigation |
| **Rollback client portal only** | Client routes faulty; adviser V2 OK | L2 client flags SQL; confirm client sees "unavailable" |
| **Rollback Google Calendar only** | Calendar privacy/sync issue | Disable `crm_v2_google_calendar`; disconnect OAuth |
| **Rollback full CRM V2** | Master gate failure or Critical incident | L0 `crm_v2_master`; clear allowlist; legacy only |

---

## 7. Operator sign-off block

| Field | Value |
|-------|-------|
| Pilot adviser | |
| Client (first name / ID) | |
| Environment | local / staging / production |
| Day 1 flags enabled | |
| Pre-invite decision | GO / NO-GO |
| Live test decision | CONTINUE / PAUSE / ROLLBACK |
| Final Day 1 decision | |
| Date | |
| Operator name | |
| Evidence links | |

**Production launch approved?** ☐ Yes ☐ No — **must remain No for Phase 13 Day 1**

---

## 8. Manual commands (operator)

Run from repository root before invite:

```bash
git status
git diff --check
npm run final:check
npm run qa:crm-v2-pilot-readiness
```

Optional additional gates (not required for Day 1 doc but recommended):

```bash
npm run security:api
npm run security:advisor-access
npx supabase db query --linked "SELECT feature_key, enabled, client_visible FROM platform_feature_controls WHERE feature_key LIKE 'crm_v2_%' ORDER BY feature_key;"
```

**Do not** commit `.env` files. **Do not** print secret values.

---

## 9. Explicit statement

**This is limited real-client pilot validation, not production launch approval.**

Default status for all checklist rows: **NOT RUN** until operator executes with evidence.
