# CRM V2 — Phase 01 Feature Gating

**Phase:** 01  
**Branch:** `crm-v2-01-shell`

---

## Effective access rule

```text
authenticated adviser
AND crm_v2_master enabled
AND pilot mode requirements satisfied
AND authenticated adviser is pilot eligible
```

Enabling `crm_v2_master` alone **cannot** grant access to every adviser. Both `crm_v2_pilot_mode` must be enabled **and** the authenticated adviser's auth user ID must appear in the operator-configured `CRM_V2_PILOT_USER_IDS` allowlist with valid parsing.

---

## Master feature key

| Property | Value |
|----------|-------|
| **Key** | `crm_v2_master` |
| Constant | `CRM_V2_MASTER_FEATURE_KEY` in `lib/crm-v2/constants.ts` |
| Union member | `lib/compliance/types.ts` → `PlatformFeatureKey` |
| Code default (`FEATURE_DEFAULTS`) | `enabled: false`, `client_visible: false`, `adviser_visible: true` |
| Migration seed | `enabled: false`, `client_visible: false`, `adviser_visible: true` |
| Fail-closed on DB lookup failure | Yes — `loadFeatureControls()` falls back to code defaults |

---

## Secondary pilot-mode control (`crm_v2_pilot_mode`)

`crm_v2_pilot_mode` is **both**:

1. **Persisted feature control** — row in `platform_feature_controls` (seeded by migration `202606290001_phase01_crm_v2_feature_controls.sql`) and readable via `isFeatureEnabled()`.
2. **Code control** — `FEATURE_DEFAULTS.crm_v2_pilot_mode` in `lib/compliance/featureFlags.ts` with `enabled: false` as fail-closed default when DB row is absent.

Pilot **membership** (which advisers are eligible) is **not** a feature flag. It is enforced exclusively via server environment variable `CRM_V2_PILOT_USER_IDS` parsed by `lib/crm-v2/pilotConfig.ts`.

### Why pilot is not a second uncontrolled general-release system

- `crm_v2_pilot_mode` defaults **disabled** in code and migration — it cannot widen access without explicit operator enablement alongside `crm_v2_master`.
- Even with both flags enabled, access still requires a valid, non-empty, well-formed allowlist in server environment configuration.
- The allowlist is never exposed to the browser, never accepted from request parameters, and never hardcoded in source.
- All non-pilot advisers receive the same generic denial UI regardless of which gate failed.
- Sub-feature flags (`crm_v2_relationships`, etc.) remain documented for Phases 02+ but are **not** seeded or checked in Phase 01.

---

## Exact order of access checks

Implemented in `assertCrmV2Access()` (`lib/crm-v2/access.ts`):

| Step | Check | Denial reason | UI |
|------|-------|---------------|-----|
| 1 | `requireAdvisorAccess()` | `unauthenticated` or `forbidden` | `AdvisorAccessDenied` |
| 2 | `isFeatureEnabled(CRM_V2_MASTER_FEATURE_KEY)` | `feature_disabled` | `CrmV2AccessDenied` |
| 3 | `isFeatureEnabled(CRM_V2_PILOT_MODE_FEATURE_KEY)` | `pilot_mode_disabled` | `CrmV2AccessDenied` |
| 4 | `parsePilotAllowlistFromEnv()` | `pilot_not_eligible` | `CrmV2AccessDenied` |
| 5 | `isUserInPilotAllowlist(adviserAccess.authUser.id, allowlist)` | `pilot_not_eligible` | `CrmV2AccessDenied` |

Master and pilot flag checks occur **before** allowlist parsing (fail-closed ordering verified by QA).

---

## Authenticated identity source

- `requireAdvisorAccess()` → `requireAuthenticatedUser()` → `supabase.auth.getUser()`.
- Pilot membership uses `adviserAccess.authUser.id` (Supabase auth UID).
- **No** `searchParams`, cookies supplied by client, or browser-supplied adviser identity.

---

## Adviser-role requirement

- `isAdvisorRole(auth.user.role)` must pass in `requireAdvisorAccess()`.
- Non-adviser roles fail at step 1 with `forbidden`.

---

## Admin behavior

- **No admin bypass** in `assertCrmV2Access()` — no `isAdminRole`, `requireAdminAccess`, or impersonation path.
- Admin users who are not adviser-role receive `forbidden` → `AdvisorAccessDenied` (same as clients).
- Matches Phase 00 blueprint: no broad admin impersonation of adviser CRM sessions.

---

## Client denial

- Client-role users fail `isAdvisorRole` at step 1 → `forbidden` → `AdvisorAccessDenied`.
- `client_visible: false` on both CRM V2 flags — flags are not client-facing.

---

## Pilot configuration

| Item | Value |
|------|-------|
| Environment variable | `CRM_V2_PILOT_USER_IDS` |
| Constant | `CRM_V2_PILOT_USER_IDS_ENV` in `lib/crm-v2/constants.ts` |
| Format | Comma-separated UUIDs |
| Identifier type | Supabase `auth.users.id` / `auth.uid()` |
| Delimiter | Comma (`,`) |
| Encoding | Plain text; tokens trimmed; case-insensitive match after lowercasing |
| Missing variable (`undefined`) | Deny all — reason `missing` |
| Empty / whitespace-only | Deny all — reason `empty` |
| Any malformed UUID token | Deny **entire** allowlist — reason `malformed` |
| Hardcoded pilot adviser in repo | **None** — QA scans lib/crm-v2 for UUIDs |
| Default in repository | **Unset** |

### Allowlist confidentiality

- Allowlist contents are not returned in API responses, error messages, or `CrmV2AccessDenied` UI.
- Parse failures are not logged with token values.
- Shell API returns only `{ available, requestId }`.

---

## Fail-closed behavior summary

| Condition | Result |
|-----------|--------|
| Unauthenticated | Denied |
| Non-adviser (client, admin) | Denied |
| `crm_v2_master` disabled or absent | Denied |
| `crm_v2_pilot_mode` disabled or absent | Denied |
| `CRM_V2_PILOT_USER_IDS` missing | Denied |
| `CRM_V2_PILOT_USER_IDS` empty | Denied |
| Malformed token in allowlist | Denied |
| Adviser not in allowlist | Denied |
| `platform_feature_controls` DB unavailable | Code defaults (both flags false) → Denied |

---

## Migration

| Item | Detail |
|------|--------|
| **Identifier** | `202606290001_phase01_crm_v2_feature_controls.sql` |
| **Action** | `INSERT INTO platform_feature_controls ... ON CONFLICT (feature_key) DO NOTHING` |
| **Keys seeded** | `crm_v2_master`, `crm_v2_pilot_mode` |
| **Enabled state** | `false` for both |
| **client_visible** | `false` for both |
| **adviser_visible** | `true` for both |
| **Idempotency** | `ON CONFLICT DO NOTHING` — no `UPDATE` of existing rows |
| **Applied** | **No** — remains unapplied until operator approval |

### Why the migration remains unapplied

Phase 01 delivers code and documentation only. Applying the seed is an operator action (Gate G2) after QA and security review sign-off. Until applied, `isFeatureEnabled()` uses `FEATURE_DEFAULTS` (both false) when DB rows are absent.

### Diagnostics

| File | Purpose |
|------|---------|
| `preflight_202606290001_phase01_crm_v2_feature_controls.sql` | Pre-apply readiness probes |
| `verify_202606290001_phase01_crm_v2_feature_controls.sql` | Post-apply verification |
| `verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql` | Failing rows only |

---

## Operator enablement (not performed in Phase 01)

1. Approve and apply `202606290001_phase01_crm_v2_feature_controls.sql`.
2. Set `CRM_V2_PILOT_USER_IDS` in deployment environment.
3. Enable `crm_v2_master` and `crm_v2_pilot_mode` via admin API or SQL (staging first).
4. Execute manual tests in `CRM_V2_PHASE_01_MANUAL_TESTS.md`.

**No remote activation** was performed during Phase 01 implementation.
