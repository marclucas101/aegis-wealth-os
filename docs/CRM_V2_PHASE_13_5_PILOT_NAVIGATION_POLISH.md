# CRM V2 Phase 13.5 — Pilot Navigation and Polish

**Branch:** `crm-v2-13-pilot-activation`  
**Type:** UI / navigation polish (not a feature or schema phase)  
**Status:** Complete — limited pilot presentation pass  
**Verdict:** Improves discoverability for authorised pilot advisers; does not change business logic or access rules.

---

## Purpose

Prepare CRM V2 for a limited real-client pilot by making the workspace discoverable from legacy `/advisor`, improving shell presentation, and polishing empty/disabled states — without weakening gates, enabling features, or promoting client portal routes.

---

## What changed

### 1. Legacy adviser entry point

| Item | Detail |
|------|--------|
| **Component** | `components/aegis/advisor/CrmV2PilotEntryBanner.tsx` |
| **Placement** | Top of `/advisor` page (`app/advisor/page.tsx`), above the existing advisor console |
| **Label** | “Open CRM V2 Pilot” |
| **Supporting copy** | “New adviser workspace for relationships, appointments, service, and operations.” |
| **Destination** | `/advisor-v2` |

### 2. CRM V2 → classic adviser link

| Item | Detail |
|------|--------|
| **Location** | `components/aegis/advisor-v2/AdviserCrmV2Shell.tsx` |
| **Sidebar** | “← Back to classic adviser workspace” → `/advisor` |
| **Desktop header** | “Classic workspace” → `/advisor` |
| **Scope** | Adviser CRM V2 shell only (not client portal) |

### 3. Pilot marker

| Item | Detail |
|------|--------|
| **Component** | `components/aegis/advisor-v2/CrmV2PilotBadge.tsx` |
| **Copy** | “CRM V2 Limited Pilot” |
| **Placement** | CRM V2 sidebar + desktop header subtitle |
| **Not shown on** | Client portal routes, legacy `/advisor` (uses “Limited pilot” on entry banner only) |

### 4. Shell and landing polish

- **`AdviserCrmV2Shell`:** Clear titles, Home nav item, active states, mobile drawer, classic-workspace escape hatch, pilot badge.
- **`/advisor-v2` landing:** Replaced blind redirect to Today with a pilot home hub linking to all primary/more areas (`app/advisor-v2/page.tsx`).
- **`lib/crm-v2/navigation.ts`:** Home (`/advisor-v2`) and Today are separate active states.

### 5. Disabled-module and empty-state polish

| Route | Change |
|-------|--------|
| `/advisor-v2` | Pilot home hub with area cards and pilot reassurance copy |
| `/advisor-v2/today` | `CrmV2ModuleUnavailablePage` when disabled; clearer subtitle (projection-only) |
| `/advisor-v2/relationships` | Module unavailable page instead of full access-denied wall |
| `/advisor-v2/appointments` | Same; improved list empty messages |
| `/advisor-v2/appointments/new` | Same |
| `/advisor-v2/service` | Same |
| `/advisor-v2/communications` | Same |
| `/advisor-v2/reports` | Same; removed phase badge from header |
| `/advisor-v2/operations` | Same; removed phase badge from header |

**New shared helpers/components:**

- `lib/crm-v2/pilotAvailability.ts` — `isCrmV2PilotAvailable()` (wraps `assertCrmV2Access`, fail-closed)
- `lib/crm-v2/modulePlaceholder.ts` — adviser-safe unavailable copy
- `components/aegis/advisor-v2/CrmV2ModuleUnavailablePage.tsx`
- `components/aegis/advisor-v2/CrmV2FoundationEmptyState.tsx` — variants: foundation / unavailable / empty

---

## How visibility is gated

### CRM V2 pilot entry banner (`/advisor`)

```
requireAdvisorAccess()  (layout — non-advisers never reach page)
        ↓
isCrmV2PilotAvailable()
        ↓
assertCrmV2Access()  (same gate as /advisor-v2 layout)
        ↓
allowed === true  →  show banner
allowed === false →  render null (no button)
```

**Not used:** hardcoded user IDs in UI, client-side-only checks, feature-flag row edits.

### Direct `/advisor-v2` access

Unchanged: `app/advisor-v2/layout.tsx` still calls `assertCrmV2Access()`. Non-pilot advisers and clients fail closed with `CrmV2AccessDenied` or `AdvisorAccessDenied`.

---

## What was intentionally not changed

- No migrations or schema changes
- No `feature_controls` row updates
- No `.env` changes
- `requireAdvisorAccess()` and `assertCrmV2Access()` logic unchanged
- Scoring, advice, service, advocacy, ethnicity, queue logic unchanged
- No fake data or automatic outreach
- Google Calendar remains manual sync only
- Client portal routes not promoted from adviser shell
- Legacy `/advisor` retained as primary book command centre
- Communications remain draft/log only
- Today remains projection only

---

## Manual QA checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Pilot adviser opens `/advisor` | “Open CRM V2 Pilot” banner visible |
| 2 | Click banner | Navigates to `/advisor-v2` home hub |
| 3 | CRM V2 sidebar | “CRM V2 Limited Pilot” badge + back link to `/advisor` |
| 4 | Non-pilot adviser on `/advisor` | No CRM V2 banner |
| 5 | Client user | Cannot reach `/advisor` or `/advisor-v2` (existing gates) |
| 6 | Non-pilot direct `/advisor-v2` | Access denied (fail closed) |
| 7 | Disabled sub-module (if any flag off) | Friendly unavailable state, not broken layout |
| 8 | Empty relationships/appointments | Clear next-step copy |
| 9 | Mobile viewport | CRM V2 nav drawer opens/closes; no horizontal overflow |
| 10 | No secrets in UI | No env values, allowlist IDs, or debug JSON in pages |

---

## Rollback note

All changes are application UI only. Roll back by reverting this commit (or branch) — no database rollback required.

To hide CRM V2 from advisers without code deploy:

1. Disable `crm_v2_pilot_mode` or `crm_v2_master` per Phase 13 rollback runbook, **or**
2. Remove pilot user from `CRM_V2_PILOT_USER_IDS` and restart the app server.

Entry banner and `/advisor-v2` both respect the same gates; disabling flags or allowlist hides entry and blocks shell without touching legacy `/advisor`.

---

## Automated QA (Phase 13.5)

Run after merge:

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
```

Optional regression (landing hub replaced Today redirect):

```bash
npm run qa:crm-v2-shell
npm run qa:crm-v2-today
```

Update shell/today validation expectations if those scripts still assert a Today redirect.

---

## Related documents

- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
- [CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md](./CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md)
- [CRM_V2_PHASE_13_DAY_1_REAL_CLIENT_PILOT.md](./CRM_V2_PHASE_13_DAY_1_REAL_CLIENT_PILOT.md)
- [CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md](./CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md)
