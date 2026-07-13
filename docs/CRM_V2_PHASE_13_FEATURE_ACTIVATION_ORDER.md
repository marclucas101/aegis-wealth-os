# CRM V2 Phase 13 — Feature Activation Order

**Branch:** `crm-v2-13-pilot-activation`  
**Rule:** Operator-only activation on staging. **Do not enable in production** without go/no-go sign-off.

All keys are defined in `lib/crm-v2/constants.ts` and `lib/compliance/featureFlags.ts`.

---

## 1. Prerequisites (before step 1)

| Prerequisite | Verification |
|--------------|--------------|
| Staging deployment running | Health check |
| Migrations applied or dry-run reviewed | `npx supabase db push --dry-run` |
| Test pilot adviser UUID known | Auth user ID from Supabase |
| Legacy `/advisor` functional | Smoke visit |
| Phase 13 diagnostics run | `verify_phase13_crm_v2_feature_control_pilot_readiness.sql` |

---

## 2. Activation sequence

Enable in this exact order. Do not skip steps. Do not enable multiple client-visible modules simultaneously on first pilot day.

| Step | Key / config | Visibility | Depends on | Routes unlocked |
|------|--------------|------------|------------|-----------------|
| **1** | `crm_v2_master` | adviser-only | adviser auth | None alone — shell still blocked |
| **2** | `crm_v2_pilot_mode` | adviser-only | step 1 | None alone — allowlist required |
| **3** | `CRM_V2_PILOT_USER_IDS` | server env | steps 1–2 | `/advisor-v2` shell (restart required) |
| **4** | Shell only (no sub-flags) | — | steps 1–3 | `/advisor-v2`, `/advisor-v2/settings`, placeholder modules show gated state |
| **5** | `crm_v2_relationships` | adviser-only | steps 1–3 | `/advisor-v2/relationships`, Relationship 360 |
| **6** | `crm_v2_appointments_adviser` | adviser-only | steps 1–3 | `/advisor-v2/appointments/*` |
| **7** | `crm_v2_appointments_client` | client (`client_visible=true` required) | step 6 recommended | `/appointments`, `/appointments/request`, `/appointments/[id]` |
| **8** | `crm_v2_google_calendar` | adviser-only | step 6 + **staging OAuth configured** | Calendar sync under appointments / operations |
| **9** | `crm_v2_service` | adviser-only | steps 1–3 | `/advisor-v2/service/*` |
| **9b** | `crm_v2_client_service` | client | step 9 recommended | `/actions`, `/requests`, `/document-vault` |
| **10** | `crm_v2_protection_portfolio` | adviser + client | steps 1–3 | Adviser protection workspace; client `/protection` when `client_visible=true` |
| **11** | `crm_v2_relationship_moments` | adviser-only | step 5 recommended | `/advisor-v2/relationships/[id]/moments` |
| **11b** | `crm_v2_client_profile` | client | step 11 recommended | `/preferences` |
| **12** | `crm_v2_advocacy` | adviser + client | step 5 recommended | Advocacy workspace; `/preferences/advocacy` |
| **13** | `crm_v2_communications` | adviser + client | steps 1–3 | `/advisor-v2/communications/*`; client messages when `client_visible=true` |
| **14** | `crm_v2_today` | adviser-only | steps 1–3 | `/advisor-v2/today` |
| **14b** | `adviser_work_queue` | adviser-only | step 14 | Today work queue panel |
| **15** | `crm_v2_reports` | adviser-only | steps 1–3 | `/advisor-v2/reports` |
| **16** | `crm_v2_operations` | adviser-only | steps 1–3 | `/advisor-v2/operations` |

**Not in Phase 13 scope:**

- `crm_v2_cutover` — Phase 14
- `crm_v2_legacy_fallback` — Phase 14

---

## 3. Adviser-only vs client-visible flags

### Adviser-only (require `assertCrmV2Access()` chain)

`crm_v2_master`, `crm_v2_pilot_mode`, `crm_v2_relationships`, `crm_v2_appointments_adviser`, `crm_v2_google_calendar`, `crm_v2_service`, `crm_v2_relationship_moments`, `crm_v2_today`, `adviser_work_queue`, `crm_v2_reports`, `crm_v2_operations`

### Client-visible (require `enabled=true` AND `client_visible=true`)

| Key | Client routes | Adviser also uses |
|-----|---------------|-------------------|
| `crm_v2_appointments_client` | `/appointments/*` | No direct adviser route |
| `crm_v2_client_service` | `/actions`, `/requests/*` | No |
| `crm_v2_protection_portfolio` | `/protection/*` | Adviser protection workspace |
| `crm_v2_client_profile` | `/preferences` | No |
| `crm_v2_advocacy` | `/preferences/advocacy` | Advocacy workspace |
| `crm_v2_communications` | Client messages inbox | Communications workspace |

**Caution:** Enabling client-visible flags exposes client portal surfaces. Enable one at a time during pilot; use test clients only.

---

## 4. Dependency graph

```text
crm_v2_master
  └── crm_v2_pilot_mode
        └── CRM_V2_PILOT_USER_IDS (env)
              ├── crm_v2_relationships
              │     ├── crm_v2_relationship_moments
              │     │     └── crm_v2_client_profile (client)
              │     └── crm_v2_advocacy (client + adviser)
              ├── crm_v2_appointments_adviser
              │     └── crm_v2_google_calendar (requires OAuth)
              │     └── crm_v2_appointments_client (client)
              ├── crm_v2_service
              │     └── crm_v2_client_service (client)
              ├── crm_v2_protection_portfolio (client + adviser)
              ├── crm_v2_communications (client + adviser)
              ├── crm_v2_today
              │     └── adviser_work_queue
              ├── crm_v2_reports
              └── crm_v2_operations
```

---

## 5. Safe rollback order (reverse activation)

Disable in reverse order. Prefer flag disable over data deletion.

| Order | Action |
|-------|--------|
| 1 | Disable client-visible flags first (`crm_v2_communications`, `crm_v2_advocacy`, `crm_v2_client_profile`, `crm_v2_protection_portfolio`, `crm_v2_client_service`, `crm_v2_appointments_client`) |
| 2 | Disable `crm_v2_google_calendar` (revoke OAuth if needed — see rollback runbook) |
| 3 | Disable adviser modules in reverse: operations → reports → today/work queue → communications → advocacy → moments → protection → service → appointments → relationships |
| 4 | Clear `CRM_V2_PILOT_USER_IDS` or remove pilot UUIDs |
| 5 | Disable `crm_v2_pilot_mode` |
| 6 | Disable `crm_v2_master` |

**Immediate full lockout:** Set `crm_v2_master=false` — stops all adviser V2 access regardless of sub-flags.

---

## 6. Admin API

```text
PATCH /api/admin/feature-controls
Body: { "feature_key": "<key>", "enabled": true|false, "client_visible": true|false }
```

Requires admin authentication. Does not set `CRM_V2_PILOT_USER_IDS` — that is deployment environment configuration.

---

## 7. Verification after each step

| Check | Method |
|-------|--------|
| Flag state | `verify_phase13_crm_v2_feature_control_pilot_readiness.sql` |
| Discrepancies | `verify_phase13_crm_v2_feature_control_pilot_readiness_discrepancies.sql` |
| Route gate | Visit route as pilot / non-pilot / client per smoke tests doc |
| Legacy unaffected | Visit `/advisor` |

**Nothing in this document enables flags automatically.**
