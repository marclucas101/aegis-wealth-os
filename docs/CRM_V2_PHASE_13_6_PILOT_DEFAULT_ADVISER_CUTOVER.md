# CRM V2 Phase 13.6 — Pilot Default Adviser Workspace Cutover

**Branch:** `crm-v2-13-pilot-activation` (or `main`)  
**Type:** Pilot routing cutover (not production replacement)  
**Status:** Complete  
**Verdict:** Eligible pilot advisers land in CRM V2 by default; classic workspace preserved at `/advisor/classic`.

---

## Purpose

Make CRM V2 the **default adviser entry** for authorised pilot advisers while keeping the legacy adviser command centre available as an explicit fallback. This is a **limited pilot default cutover** — not Phase 14 full production replacement and not legacy deletion.

---

## What changed

### 1. Classic adviser workspace extracted

| Item | Detail |
|------|--------|
| **Component** | `components/aegis/advisor/ClassicAdvisorWorkspace.tsx` |
| **Contents** | `AuthenticatedAppShell` + `AdvisorDashboardClient` (no CRM V2 banner, no redirect) |
| **Route** | `/advisor/classic` → `app/advisor/classic/page.tsx` |

The classic workspace renders the same adviser console as before Phase 13.5 (Shield Score, pipeline, clients, tasks).

### 2. `/advisor` redirect for pilot advisers

| Item | Detail |
|------|--------|
| **File** | `app/advisor/page.tsx` |
| **Logic** | `isCrmV2PilotAvailable()` → if `true`, `redirect("/advisor-v2")`; else render `ClassicAdvisorWorkspace` |

**Why:** Pilot advisers should not need a separate “Open CRM V2” step; `/advisor` becomes their natural entry. Non-pilot advisers continue to use `/advisor` unchanged.

### 3. Back-to-classic links avoid redirect loop

| Item | Detail |
|------|--------|
| **Constant** | `CRM_V2_CLASSIC_ADVISER_PATH` = `/advisor/classic` in `lib/crm-v2/navigation.ts` |
| **Updated** | `AdviserCrmV2Shell`, `CrmV2FoundationEmptyState`, `app/advisor-v2/error.tsx` |

Pilot advisers clicking “Back to classic adviser workspace” go to `/advisor/classic`, not `/advisor` (which would redirect back to CRM V2).

`CrmV2AccessDenied` still links to `/advisor` for non-pilot advisers who cannot access CRM V2 — no redirect loop for that cohort.

### 4. Pilot marker unchanged

CRM V2 shell still displays **“CRM V2 Limited Pilot”** — does not imply full production launch.

### 5. Unchanged from Phase 13.5

- `CrmV2PilotEntryBanner` component remains in codebase (no longer rendered on `/advisor`; redirect supersedes the banner entry pattern).
- CRM V2 gates, feature flags, and env configuration unchanged.

---

## Redirect behaviour

```text
GET /advisor
  │
  ├─ requireAdvisorAccess() fails (layout)
  │     → AdvisorAccessDenied (unchanged)
  │
  ├─ assertCrmV2Access() would allow (pilot adviser)
  │     → redirect → /advisor-v2
  │
  └─ otherwise (non-pilot adviser)
        → ClassicAdvisorWorkspace (same as before)

GET /advisor/classic
  │
  └─ requireAdvisorAccess() passes
        → ClassicAdvisorWorkspace (no redirect)
```

---

## How non-pilot advisers are protected

1. **`isCrmV2PilotAvailable()`** wraps **`assertCrmV2Access()`** — same fail-closed gate as `/advisor-v2` layout (adviser role, master flag, pilot mode, env allowlist).
2. Non-pilot advisers: `/advisor` renders classic workspace; no redirect.
3. Direct `/advisor-v2`: still blocked by layout `assertCrmV2Access()`.
4. Clients: blocked by `requireAdvisorAccess()` on `/advisor` and `/advisor/classic`; no CRM V2 exposure.

No hardcoded user IDs in UI or routing.

---

## Rollback plan

**Code rollback:** Revert this commit. `/advisor` returns to rendering classic workspace (or Phase 13.5 banner + dashboard) for all advisers.

**No database rollback** — routing only.

**Operational rollback (without code):**

1. Disable `crm_v2_pilot_mode` or remove pilot user from `CRM_V2_PILOT_USER_IDS` → `isCrmV2PilotAvailable()` returns `false` → `/advisor` shows classic workspace for everyone with adviser access.
2. Pilot advisers can still use `/advisor/classic` explicitly if code remains deployed.

---

## Manual QA checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Pilot adviser visits `/advisor` | Redirects to `/advisor-v2` |
| 2 | Pilot adviser visits `/advisor/classic` | Classic adviser console loads |
| 3 | CRM V2 “Back to classic” link | Opens `/advisor/classic` (no loop) |
| 4 | Non-pilot adviser visits `/advisor` | Classic workspace; no redirect |
| 5 | Non-pilot direct `/advisor-v2` | Access denied (fail closed) |
| 6 | Client user | Cannot access adviser routes |
| 7 | Classic features on `/advisor/classic` | Clients, tasks, pipeline work as before |
| 8 | Client portal routes | Unchanged |
| 9 | Communications | Draft/log only; no auto-send |
| 10 | Google Calendar | Manual sync only |

---

## Automated QA

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npx tsc --noEmit
```

---

## Explicit scope statement

**This is a pilot default cutover, not production replacement.**

- Legacy `/advisor` functionality is **not deleted** — it lives at `/advisor/classic`.
- CRM V2 is **not** globally available to all advisers.
- Phase 14 full cutover and Phase 15 legacy retirement remain future, operator-approved work.

---

## Related documents

- [CRM_V2_PHASE_13_5_PILOT_NAVIGATION_POLISH.md](./CRM_V2_PHASE_13_5_PILOT_NAVIGATION_POLISH.md)
- [CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md](./CRM_V2_PHASE_13_DAY_1_GO_NO_GO.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
