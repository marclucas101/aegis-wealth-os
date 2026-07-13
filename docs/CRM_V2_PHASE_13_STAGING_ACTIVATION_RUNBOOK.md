# CRM V2 Phase 13 — Staging Activation Runbook

**Branch:** `crm-v2-13-pilot-activation`  
**Environment:** Staging only  
**Rule:** No production secrets. No destructive SQL. No automatic activation.

---

## 1. Pre-activation checks

| # | Check | Pass criteria |
|---|-------|---------------|
| 1 | Branch | `crm-v2-13-pilot-activation` or merge target reviewed |
| 2 | QA suite | All `npm run qa:crm-v2-*` through Phase 13 pass locally |
| 3 | Build | `npm run build` succeeds |
| 4 | Typecheck | `npx tsc --noEmit` clean |
| 5 | Security | `npm run security:api`, `security:advisor-access`, `security:service-role` pass |
| 6 | Legacy portal | `/advisor` loads for test adviser |
| 7 | Promotions 9F.4 | `legacy_promotions_write` remains false |
| 8 | Manual tests | Phase 13 master checklist printed — not pre-marked passed |

---

## 2. Environment checks

| Variable | Staging requirement | Notes |
|----------|---------------------|-------|
| `CRM_V2_PILOT_USER_IDS` | Set before pilot access tests | Comma-separated auth user UUIDs; restart after change |
| Supabase URL/keys | Staging project only | Never commit values |
| Google OAuth | Only if enabling step 8 | Staging OAuth client; not production Google accounts for first test |

**Inspect pilot config (server logs only — never expose allowlist to clients):**

After deployment, confirm `parsePilotAllowlistFromEnv()` would succeed — missing/malformed values deny all V2 access.

---

## 3. Migration state checks

```bash
npx supabase db push --dry-run
```

**Expected:** Remote database up to date OR lists pending CRM V2 migrations operator has approved.

**Before apply (operator decision):**

1. Run preflight diagnostics for each pending migration
2. Run verify diagnostics post-apply
3. Run discrepancy diagnostics — expect empty for disabled seeds

**Phase 13 adds diagnostic-only SQL** — no Phase 13 migration required.

---

## 4. Inspect feature-control states (read-only SQL)

Run in Supabase SQL editor (staging):

```sql
-- File: supabase/diagnostics/verify_phase13_crm_v2_feature_control_pilot_readiness.sql
```

Review summary row:

- `enabled_crm_v2_flag_count` should be `0` before activation
- `crm_v2_master_enabled` and `crm_v2_pilot_mode_enabled` should be `0`

Run discrepancies:

```sql
-- File: supabase/diagnostics/verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql
```

Empty result = safe baseline. Non-empty = investigate before enabling.

---

## 5. Set `CRM_V2_PILOT_USER_IDS`

1. Identify staging pilot adviser's Supabase auth user UUID
2. In staging deployment environment (Vercel/hosting dashboard — not git):
   - Set `CRM_V2_PILOT_USER_IDS=<uuid>` (single adviser for first pilot)
3. Redeploy or restart server process
4. Confirm non-pilot adviser still denied at `/advisor-v2`

**Do not commit real UUIDs to the repository.**

---

## 6. Enable only one pilot adviser

Activation order per `docs/CRM_V2_PHASE_13_FEATURE_ACTIVATION_ORDER.md`:

### Step A — Master gates

Via admin API or controlled SQL **UPDATE** on `platform_feature_controls` (operator-approved only):

1. Enable `crm_v2_master`
2. Enable `crm_v2_pilot_mode`
3. Confirm `CRM_V2_PILOT_USER_IDS` includes exactly one test adviser

**Verify:** Pilot adviser opens `/advisor-v2`. Non-pilot adviser denied. Client denied.

### Step B — One module at a time

Example — relationships only:

1. Enable `crm_v2_relationships`
2. Visit `/advisor-v2/relationships` as pilot adviser
3. Confirm other modules still show feature-disabled or placeholder state
4. Run module manual tests from Phase 02 before enabling next module

Repeat for each module in activation order document.

---

## 7. Verify each route

| Route | Required flags | Role |
|-------|----------------|------|
| `/advisor-v2` | master + pilot + allowlist | pilot adviser |
| `/advisor-v2/relationships` | + `crm_v2_relationships` | pilot adviser |
| `/advisor-v2/appointments` | + `crm_v2_appointments_adviser` | pilot adviser |
| `/advisor-v2/service` | + `crm_v2_service` | pilot adviser |
| `/advisor-v2/communications` | + `crm_v2_communications` | pilot adviser |
| `/advisor-v2/today` | + `crm_v2_today` | pilot adviser |
| `/advisor-v2/reports` | + `crm_v2_reports` | pilot adviser |
| `/advisor-v2/operations` | + `crm_v2_operations` | pilot adviser |
| `/appointments` | `crm_v2_appointments_client` + `client_visible` | test client |
| `/actions` | `crm_v2_client_service` | test client |
| `/protection` | `crm_v2_protection_portfolio` + `client_visible` | test client |

See `docs/CRM_V2_ROUTE_MAP.md` for full mapping.

---

## 8. Disable a module immediately

**Fastest — single module:**

```text
PATCH /api/admin/feature-controls
{ "feature_key": "crm_v2_relationships", "enabled": false }
```

Or operator SQL:

```sql
UPDATE platform_feature_controls
SET enabled = false, updated_at = now()
WHERE feature_key = 'crm_v2_relationships';
```

**Verify:** Route returns feature-disabled; no business data loaded.

For client-visible modules, also set `client_visible = false` if removing client access.

---

## 9. Disable CRM V2 master immediately

```text
PATCH /api/admin/feature-controls
{ "feature_key": "crm_v2_master", "enabled": false }
```

**Effect:** All `/advisor-v2` routes deny access for all advisers regardless of sub-flags.

**Verify:** Pilot adviser sees access denied. Legacy `/advisor` still works.

---

## 10. Preserve legacy `/advisor` access

| Rule | Action |
|------|--------|
| Do not enable `crm_v2_cutover` | Phase 14 only |
| Do not modify `/advisor` routes | Unchanged in Phase 13 |
| Do not add V2 links to legacy nav | Confirmed in Phase 01 manual tests |
| Rollback | Master off → advisers use `/advisor` |

---

## 11. Supabase dry-run requirement

Before any migration apply on staging:

```bash
npx supabase db push --dry-run
```

Document output in operator log. Do not apply without explicit approval.

---

## 12. Post-activation diagnostics

After each activation step:

1. `verify_phase13_crm_v2_feature_control_pilot_readiness.sql`
2. `verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql`
3. Module-specific phase verify SQL if migration was applied
4. `npm run qa:crm-v2-pilot-readiness` (repository checks)

---

## 13. Escalation

| Condition | Action |
|-----------|--------|
| Client-visible flag enabled unexpectedly | Disable flag; run discrepancy SQL |
| Non-pilot adviser gains access | Disable master; review allowlist |
| Data written to wrong client | Disable module; preserve data; incident log |
| Google OAuth misconfigured | Disable `crm_v2_google_calendar`; revoke tokens |

See `docs/CRM_V2_PHASE_13_ROLLBACK_RUNBOOK.md`.

---

## 14. Production go/no-go

**Do not use this runbook for production.** Production activation requires separate operator sign-off using `docs/CRM_V2_PHASE_13_MASTER_MANUAL_ACCEPTANCE.md` production section.
