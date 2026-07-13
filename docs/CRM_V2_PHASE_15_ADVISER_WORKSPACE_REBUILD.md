# CRM V2 Phase 15 — Adviser Workspace Rebuild and Client-Safe Cutover

**Type:** Adviser-side rework (routing, navigation, landing dashboard, copy polish)  
**Status:** Complete  
**Verdict:** `/advisor` is the single primary AEGIS adviser operating system for eligible advisers. `/advisor-v2` home redirects there. Classic fallback preserved. Client portal untouched.

---

## Objective

Rework the adviser side so **`/advisor` becomes the single primary AEGIS adviser workspace**, replacing the confusing dual old-adviser / CRM V2 pilot experience.

**This is adviser-side rework — not client portal rollout, not schema work, not destructive legacy cleanup.**

---

## Routing model

| Route | Behaviour |
|-------|-----------|
| **`GET /advisor`** | Primary AEGIS Adviser Workspace — shell + operating dashboard for eligible advisers; classic workspace for non-eligible advisers |
| **`GET /advisor-v2`** | **Redirects to `/advisor`** — bookmark alias only; no separate pilot home |
| **`GET /advisor-v2/*`** | **Compatibility redirects** to canonical `/advisor/*` paths (Phase 16) |
| **`GET /advisor/classic`** | Emergency fallback — full `ClassicAdvisorWorkspace`; not promoted in primary UI |
| **Client routes** | **Unchanged** — `/appointments`, `/actions`, `/requests`, `/protection`, `/preferences`, `/messages`, etc. |

### Decision: redirect vs duplicate home

**Chosen:** `/advisor-v2` **redirects** to `/advisor`.

**Why:** One canonical home avoids dual-product confusion. Sub-routes remain at `/advisor-v2/*` until a future route-prefix migration. No redirect loops — classic fallback links use `/advisor/classic`, not `/advisor`.

```text
GET /advisor
  requireAdvisorAccess() (layout)
    ├─ fails → AdvisorAccessDenied
    ├─ isCrmV2PilotAvailable() === true → AdviserCrmV2Shell + AdviserCrmV2LandingContent (dashboard)
    └─ otherwise → ClassicAdvisorWorkspace

GET /advisor-v2
  assertCrmV2Access() (layout)
    ├─ fails → AdvisorAccessDenied or CrmV2AccessDenied
    └─ passes → redirect(CRM_V2_HOME_PATH)  // /advisor

GET /advisor/classic
  requireAdvisorAccess() → ClassicAdvisorWorkspace (no redirect)
```

---

## What changed

| Area | Change |
|------|--------|
| **`/advisor` landing** | Operating dashboard with Today preview, relationships roster, appointments, service, tools, and operations sections — real data only |
| **`/advisor-v2` home** | Redirect to `/advisor` |
| **Shell branding** | "AEGIS Adviser Workspace" — pilot badge, parity notice, and prominent classic CTAs removed |
| **Primary nav** | Today, Relationships, Appointments, Service, Reports, Operations |
| **More nav** | Communications, Templates, Settings + grouped Tools (protection, documents, workflows, setup) |
| **Classic fallback** | Subtle footer/header link only — "Classic workspace (fallback)" |
| **Pilot copy** | Removed from main adviser UI (badge, banner, landing reassurance, access-denied pilot framing) |
| **Navigation config** | `CRM_V2_TOOLS_NAV_GROUPS` in `lib/crm-v2/navigation.ts` |

---

## What was intentionally not changed

- Database schema and migrations
- `.env` files and pilot allowlist configuration
- `requireAdvisorAccess()` and `assertCrmV2Access()` logic
- Feature flags and pilot gating
- Scoring, advice, advocacy, ethnicity, service, communications, Google Calendar, and work queue **business logic**
- Protection report generation, Shield diagnostics, planning, binder, vault, Meeting Studio logic
- Client portal routes and client-visible feature flags
- `/advisor-v2/*` sub-route prefixes (except home redirect)
- Automatic outreach, auto-send communications, Google Calendar auto-sync
- Emergency classic fallback at `/advisor/classic`

---

## Preserved legacy tools

All Phase 14 tools remain reachable under **More → Tools** (grouped):

| Tool | Route |
|------|-------|
| Protection Report Generator | `/advisor/protection-report` |
| Shield Diagnostic | `/advisor/clients` (client file tab) |
| Stress Test | `/advisor/clients` |
| Planning & Roadmap | `/advisor/clients` |
| Planning Outputs | `/advisor/clients` |
| Client Binder | `/advisor/clients` |
| Document Vault | `/advisor/clients` |
| Meeting Studio | `/advisor/clients` |
| Wealth Blueprint Print | `/advisor/clients` |
| Annual Review Print | `/advisor/clients` |
| Insights Authoring | `/advisor/insights` |
| Client Feedback | `/advisor/feedback` |
| Legacy Appointments | `/advisor/appointments` |
| Review Pipeline | `/advisor/classic#advisor-review-pipeline` |
| Client Onboarding | `/advisor/classic#advisor-onboarding` |
| Book Health & File Quality | `/advisor/classic` |
| Tasks & Follow-ups | `/advisor/classic#advisor-tasks` |
| Adviser Profile | `/advisor/my-profile` |
| Google Calendar Setup | `/advisor/my-profile?section=calendar` |
| Google Calendar Operations | `/advisor-v2/operations/google-calendar` |
| Classic Adviser Workspace | `/advisor/classic` |

Client-context tools route through `/advisor/clients` or classic workspace — no fake client IDs.

---

## Client safety freeze

Verified unchanged:

- `/appointments`, `/appointments/request`
- `/actions`, `/requests`
- `/protection`
- `/preferences`, `/preferences/advocacy`
- `/messages`

No new client links, modules, notifications, external sends, or Google Calendar invite sends introduced by this phase.

---

## Fallback strategy

| Scenario | Path |
|----------|------|
| Primary workspace issue | `/advisor/classic` — full legacy command centre |
| CRM V2 access denied | `CrmV2AccessDenied` → classic workspace link |
| Pilot flags disabled | `/advisor` renders classic workspace automatically |
| Operational rollback | Disable `crm_v2_pilot_mode` or remove user from allowlist — no code deploy required |

Classic fallback remains until explicitly approved for retirement.

---

## Manual QA checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Eligible adviser visits `/advisor` | AEGIS Adviser Workspace dashboard |
| 2 | Eligible adviser visits `/advisor-v2` | Redirects to `/advisor` |
| 3 | Eligible adviser visits `/advisor/classic` | Classic command centre |
| 4 | Eligible adviser visits `/advisor-v2/today` | Today workspace (no redirect loop) |
| 5 | No "CRM V2 Pilot" in main adviser UI | Clean product language |
| 6 | Protection Report Generator from More | `/advisor/protection-report` loads |
| 7 | Shield Diagnostic entry | `/advisor/clients` loads |
| 8 | Planning, binder, vault, Meeting Studio | Client roster entry |
| 9 | Reports, Operations, Templates | CRM V2 routes load when flags on |
| 10 | Google Calendar setup | Profile calendar section; manual connect |
| 11 | Communications | Draft/log only; no auto-send |
| 12 | Client routes | Unchanged behaviour |
| 13 | Client users | No adviser nav or CRM V2 exposure |
| 14 | No deleted routes | All legacy `/advisor/*` routes respond |
| 15 | No raw JSON / debug copy in UI | Visual check |
| 16 | Classic fallback link | Subtle only; `/advisor/classic` works |

---

## Rollback plan

### Code rollback

Revert Phase 15 commit(s). `/advisor-v2` home returns to shared landing alias; shell restores Phase 14 pilot framing if desired.

### Operational rollback (no code deploy)

1. Disable `crm_v2_pilot_mode` or remove user from `CRM_V2_PILOT_USER_IDS`
2. `/advisor` shows classic workspace for all advisers
3. `/advisor/classic` and direct legacy sub-routes remain available

**No database rollback required.**

---

## Automated QA

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npm run qa:crm-v2-shell
npm run qa:crm-v2-today
npx tsc --noEmit
```

Shell and Today validation scripts were aligned in **Phase 15.1** to expect `/advisor` as the primary home, `/advisor-v2` redirect, Communications under More, and AEGIS Adviser Workspace branding (no pilot UI copy).

---

## Phase 15.1 — QA alignment

**Type:** Validation script and documentation alignment only.

| Script | Updated expectations |
|--------|---------------------|
| `scripts/run-crm-v2-shell-validation.ts` | `/advisor` primary entry, `/advisor-v2` redirect, Reports/Operations in primary nav, Communications in More, workspace branding, no pilot badge |
| `scripts/run-crm-v2-today-validation.ts` | Same routing model; landing uses `AdviserWorkspaceDashboard` with real projection data |

---

## Remaining gaps before client-facing rollout

| Gap | Notes |
|-----|-------|
| Route prefix unification | **Phase 16 complete** — canonical `/advisor/*`; `/advisor-v2/*` redirects; appointments at `/advisor/workspace/appointments` due to legacy conflict |
| Native book health in workspace | Classic dashboard panels only |
| Client-context deep links | Roster-first routing; optional relationship-scoped links later |
| Classic retirement | Conditional on operator approval — not Phase 15 |
| Client CRM V2 features | Intentionally frozen — separate rollout phase |

---

## Related documents

- [CRM_V2_PHASE_14_ADVISER_WORKSPACE_REPLACEMENT.md](./CRM_V2_PHASE_14_ADVISER_WORKSPACE_REPLACEMENT.md)
- [CRM_V2_PHASE_14_ADVISER_FEATURE_PARITY_INVENTORY.md](./CRM_V2_PHASE_14_ADVISER_FEATURE_PARITY_INVENTORY.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
