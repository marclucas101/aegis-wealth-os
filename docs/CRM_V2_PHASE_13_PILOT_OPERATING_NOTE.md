# CRM V2 Phase 13 — Pilot Operating Note

**Status:** Limited pilot readiness — **not** a production launch  
**Audience:** Operators, pilot advisers, engineering support  
**Branch:** `crm-v2-13-pilot-activation`

This note is the day-to-day operating guide for a **controlled staging pilot** (or tightly scoped pre-production pilot). It does not authorise book-wide rollout, production cutover, or automatic client onboarding.

---

## 1. What this pilot is

| In scope | Out of scope |
|----------|--------------|
| One or few pilot advisers on allowlist | All advisers enabled |
| Staging or isolated test environment first | Production launch without go/no-go |
| Module-by-module enablement | Bulk flag enablement |
| Manual acceptance tracking | Automated outreach or campaigns |
| Legacy `/advisor` remains primary for non-pilot advisers | Phase 14 `/advisor` cutover |
| Test or explicitly consented clients | Real sensitive client data in smoke tests |

**Verdict to use:** *Limited pilot readiness* — engineering artefacts are in place; operator execution and manual acceptance remain outstanding.

---

## 2. Pilot scope

### Adviser scope

- **Allowlist:** `CRM_V2_PILOT_USER_IDS` — comma-separated auth user UUIDs (server env only; restart required after change).
- **Start:** exactly **one** pilot adviser UUID.
- **Expand:** only after module manual tests pass and rollback drill completed.
- **Non-pilot advisers:** must continue to see access denied at `/advisor-v2`.

### Client scope

- **Start:** zero client-visible modules until adviser shell is stable.
- **Add clients:** one test client at a time, assigned to pilot adviser only.
- **No bulk onboarding** of real clients during Phase 13.

### Data scope

- Staging or synthetic test records only for initial passes.
- Pilot-created rows are retained on rollback (flags off; data not deleted).

---

## 3. Feature flags (reference — operator sets per environment)

**Gates (required before any V2 access):**

| Flag | Purpose |
|------|---------|
| `crm_v2_master` | Entire `/advisor-v2` portal |
| `crm_v2_pilot_mode` | Requires allowlist |
| `CRM_V2_PILOT_USER_IDS` | Server environment (not a DB flag) |

**Typical pilot module flags (enable one at a time):**

| Flag | `client_visible` | Notes |
|------|------------------|-------|
| `crm_v2_relationships` | false | Relationship list + 360 |
| `crm_v2_appointments_adviser` | false | Adviser appointments |
| `crm_v2_appointments_client` | set true for client routes | Enable after adviser appointments |
| `crm_v2_google_calendar` | false | Only after staging OAuth configured |
| `crm_v2_service` | false | Adviser service workspace |
| `crm_v2_client_service` | true | Client `/actions`, `/requests` |
| `crm_v2_protection_portfolio` | true for client `/protection` | Adviser + client surfaces |
| `crm_v2_relationship_moments` | false | Per-relationship workspace |
| `crm_v2_client_profile` | true | Client `/preferences` |
| `crm_v2_advocacy` | true | Client `/preferences/advocacy` |
| `crm_v2_communications` | true | Drafts bridge; **no automatic send** |
| `crm_v2_today` | false | Today homepage |
| `adviser_work_queue` | false | Enable with Today |
| `crm_v2_reports` | false | Projection only |
| `crm_v2_operations` | false | Diagnostics panel |

**Not enabled in Phase 13:** `crm_v2_cutover`, `crm_v2_legacy_fallback` (Phase 14).

**Inspect current state (read-only):**

```sql
SELECT feature_key, enabled, client_visible, adviser_visible
FROM platform_feature_controls
WHERE feature_key LIKE 'crm_v2_%' OR feature_key = 'adviser_work_queue'
ORDER BY feature_key;
```

Full sequence: `docs/CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md`.

---

## 4. Adviser routes to test

Test as **pilot adviser** after gates + module flag enabled. Record results in `docs/CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md`.

| Priority | Route | Flag required |
|----------|-------|---------------|
| P0 | `/advisor-v2` | master + pilot + allowlist |
| P0 | `/api/advisor-v2/shell` | same (expect `available: true`) |
| P1 | `/advisor-v2/relationships` | `crm_v2_relationships` |
| P1 | `/advisor-v2/relationships/[id]` | `crm_v2_relationships` |
| P2 | `/advisor-v2/appointments` | `crm_v2_appointments_adviser` |
| P2 | `/advisor-v2/appointments/new` | `crm_v2_appointments_adviser` |
| P2 | `/advisor-v2/appointments/[id]` | `crm_v2_appointments_adviser` |
| P3 | `/advisor-v2/service` | `crm_v2_service` |
| P3 | `/advisor-v2/relationships/[id]/protection` | `crm_v2_protection_portfolio` |
| P3 | `/advisor-v2/relationships/[id]/moments` | `crm_v2_relationship_moments` |
| P3 | `/advisor-v2/relationships/[id]/advocacy` | `crm_v2_advocacy` |
| P4 | `/advisor-v2/communications` | `crm_v2_communications` |
| P4 | `/advisor-v2/today` | `crm_v2_today` (+ `adviser_work_queue` for queue panel) |
| P5 | `/advisor-v2/reports` | `crm_v2_reports` |
| P5 | `/advisor-v2/operations` | `crm_v2_operations` |
| P5 | `/advisor-v2/settings/integrations/google-calendar` | `crm_v2_google_calendar` |

**Always verify:** `/advisor` still works for pilot and non-pilot advisers.

**Denial checks:** non-pilot adviser and client must not access `/advisor-v2`.

---

## 5. Client routes to test

Enable **one client-visible flag at a time**. Use test client assigned to pilot adviser only.

| Route | Flag | `client_visible` |
|-------|------|------------------|
| `/appointments` | `crm_v2_appointments_client` | true |
| `/appointments/request` | `crm_v2_appointments_client` | true |
| `/appointments/[id]` | `crm_v2_appointments_client` | true |
| `/actions` | `crm_v2_client_service` | true |
| `/requests`, `/requests/[id]` | `crm_v2_client_service` | true |
| `/protection`, `/protection/[id]` | `crm_v2_protection_portfolio` | true |
| `/preferences` | `crm_v2_client_profile` | true |
| `/preferences/advocacy` | `crm_v2_advocacy` | true |
| `/messages` (if enabled) | `crm_v2_communications` | true |

**Client onboarding order:**

1. Confirm adviser module stable for assigned relationship.
2. Enable single client-visible flag.
3. Log in as test client — confirm **own data only**.
4. Run manual checks; capture evidence link.
5. Roll back flag before enabling next client module (recommended for first pass).

---

## 6. Google Calendar — deployed testing

**Prerequisites:** `crm_v2_appointments_adviser` enabled; staging OAuth credentials in deployment env (not committed).

| Step | Action |
|------|--------|
| 1 | Enable `crm_v2_google_calendar` only on staging |
| 2 | Use **staging Google OAuth app** and a **test calendar** — not production Google account for first test |
| 3 | Connect via `/advisor-v2/settings/integrations/google-calendar` or legacy `/advisor/my-profile` calendar section |
| 4 | Create test appointment in AEGIS; verify single outbound sync (no duplicate events) |
| 5 | Reschedule test appointment; verify update not duplicate |
| 6 | Disconnect via UI; disable `crm_v2_google_calendar` if issues |
| 7 | Check Operations panel (`/advisor-v2/operations`) for sync health — no tokens in UI |

**Do not:** revoke production OAuth client secrets from this pilot. See secret rotation reminder in `docs/CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md`.

---

## 7. Hard rules (operator)

### No bulk rollout

- Do not enable all sub-flags in one change.
- Do not add entire adviser book to `CRM_V2_PILOT_USER_IDS` on day one.
- Do not onboard all clients to client-visible modules simultaneously.

### No automatic outreach

- Communications module is **drafts bridge** only during pilot unless explicit governed-send test is approved.
- No campaign automation, scheduled bulk email/SMS/WhatsApp, or Promotions Stage 6.
- `legacy_promotions_write` must remain **false** (9F.4 observation continues).

### Advocacy — not ranking or sales priority

- Advocacy yearly score is **restricted** — not for client ranking, servicing priority, or sales targeting.
- Do not use advocacy events to prioritise outreach lists or work queue ordering.
- See `docs/CRM_V2_PHASE_09_ADVOCACY_SCORE_RESTRICTIONS.md`.

### Ethnicity — festive/moment context only

- Ethnicity fields are for optional festive/moment suggestions only.
- **Prohibited:** advice tailoring, service priority, sales targeting, or reports ranking by ethnicity.
- See `docs/CRM_V2_PHASE_08_SENSITIVITY_AND_ETHNICITY_RULES.md`.

---

## 8. Issue logging procedure

Log every pilot incident or anomaly before resuming testing.

| Field | Required |
|-------|----------|
| Date/time (UTC+8) | Yes |
| Environment | staging / local / other |
| Pilot adviser email (not password) | Yes |
| Module / route | Yes |
| Severity | Low / Medium / High / Critical |
| Symptoms | What user saw |
| Flag state snapshot | SQL output or admin screenshot |
| Rollback action taken | Yes / No — what |
| Evidence link | Screenshot, HAR, ticket URL |
| Blocker for continue? | Yes / No |

**Critical (stop pilot immediately):** cross-client data visible, unintended external send, wrong assignment exposed.

After logging: follow `docs/CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` if needed; run Phase 13 discrepancy SQL before resuming.

---

## 9. Daily operator checklist

| # | Check |
|---|-------|
| 1 | `verify_phase13_crm_v2_feature_control_pilot_readiness.sql` — enabled flags match intent |
| 2 | Discrepancy SQL returns empty or explained rows |
| 3 | Non-pilot adviser still denied |
| 4 | Legacy `/advisor` functional |
| 5 | Manual acceptance rows updated (not pre-marked PASS) |
| 6 | No undocumented client-visible flags enabled |

---

## 10. Related documents

| Document | Purpose |
|----------|---------|
| `CRM_V2_PHASE_13_DEPLOYMENT_READINESS.md` | Pre-deploy / pre-pilot checklist |
| `CRM_V2_PHASE_13_STAGING_ACTIVATION_RUNBOOK.md` | Step-by-step activation |
| `CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md` | Rollback SQL and flag disable |
| `CRM_V2_PHASE_13_PILOT_DATA_SAFETY.md` | Test data rules |
| `CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md` | Manual test tracking |
| `CRM_V2_PHASE_13_PILOT_SMOKE_TESTS.md` | Safe smoke tests |

---

**Reminder:** Saving `CRM_V2_PILOT_USER_IDS` in `.env.local` is not enough — the file must be **saved to disk** and the dev server **restarted**. Production/staging deployments require env set in the hosting dashboard and redeploy.
