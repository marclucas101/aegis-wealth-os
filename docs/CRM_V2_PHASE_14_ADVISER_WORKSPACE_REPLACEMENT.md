# CRM V2 Phase 14 — Adviser Workspace Replacement

**Branch:** `crm-v2-14-cutover` (or current working branch)  
**Type:** Adviser workspace replacement with legacy feature preservation  
**Status:** Complete  
**Verdict:** `/advisor` is the primary CRM V2 entry for eligible pilot advisers; classic workspace and all audited legacy routes remain available.

---

## Objective

Convert the adviser side so **`/advisor` becomes the CRM V2 adviser workspace** for eligible pilot advisers, while preserving important existing adviser features (protection reports, Shield diagnostics, planning, binder, vault, Meeting Studio, governed communications, templates, operations, reports, and other legacy workflows).

**This is adviser workspace replacement with legacy feature preservation — not destructive legacy cleanup.**

---

## What changed

| Area | Change |
|------|--------|
| **`/advisor`** | Eligible pilot advisers see CRM V2 shell + landing home in place (no redirect to `/advisor-v2`) |
| **`/advisor/classic`** | Unchanged — full legacy `ClassicAdvisorWorkspace` |
| **`/advisor-v2`** | Pilot alias home — same landing content inside existing CRM V2 layout; sub-routes unchanged |
| **CRM V2 shell** | Home link → `/advisor`; **More** expanded with **Classic tools** section |
| **Parity notice** | Subtle adviser-only note in CRM V2 main area |
| **Navigation config** | `CRM_V2_HOME_PATH`, `CRM_V2_LEGACY_TOOLS_NAV` in `lib/crm-v2/navigation.ts` |
| **Landing** | Extracted to `AdviserCrmV2LandingContent.tsx` (shared by `/advisor` and `/advisor-v2`) |
| **Access denied** | Classic escape hatch → `/advisor/classic` (avoids pilot redirect loop) |

**Not changed:** database schema, feature flags, env configuration, business logic (scoring, advice, protection, advocacy, ethnicity, communications send, Google Calendar sync behaviour), client portal routes, `requireAdvisorAccess()`, `assertCrmV2Access()`.

---

## Route behaviour

### `GET /advisor`

```text
requireAdvisorAccess() (layout)
  │
  ├─ fails → AdvisorAccessDenied
  │
  ├─ isCrmV2PilotAvailable() === true
  │     → AdviserCrmV2Shell + AdviserCrmV2LandingContent
  │
  └─ otherwise
        → ClassicAdvisorWorkspace
```

### `GET /advisor/classic`

```text
requireAdvisorAccess() (layout)
  │
  └─ passes → ClassicAdvisorWorkspace (no CRM V2 redirect, no pilot banner)
```

### `GET /advisor-v2` and `/advisor-v2/*`

```text
assertCrmV2Access() (advisor-v2 layout)
  │
  ├─ fails → AdvisorAccessDenied or CrmV2AccessDenied
  │
  └─ passes → AdviserCrmV2Shell + route content
```

- **`/advisor-v2` home:** Same landing as `/advisor` (alias for bookmarks and Phase 01–13 links).
- **Sub-routes** (`/today`, `/relationships`, etc.): Unchanged under `/advisor-v2/*`.
- **No redirect loop:** Classic escape links use `/advisor/classic`, not `/advisor`.

### Non-pilot advisers

- `/advisor` → classic workspace
- `/advisor-v2` → fail closed (`CrmV2AccessDenied`)
- `/advisor/classic` → classic workspace

### Clients

- Blocked by `requireAdvisorAccess()` on all `/advisor/*` routes
- No adviser CRM V2 exposure

---

## Legacy feature parity summary

See full audit: [CRM_V2_PHASE_14_ADVISER_FEATURE_PARITY_INVENTORY.md](./CRM_V2_PHASE_14_ADVISER_FEATURE_PARITY_INVENTORY.md).

| Category | Preservation |
|----------|--------------|
| Protection report generator | `/advisor/protection-report` + CRM V2 More link |
| Shield / scoring | Client file tabs + classic dashboard; linked via client roster |
| Planning / roadmap | Client routes + More link |
| Binder / vault / Meeting Studio | Client routes + More links |
| Governed content | `/advisor/insights` + More link |
| Templates / reports / operations | Native CRM V2 More nav |
| Google Calendar | Manual connect at profile; operations at CRM V2 |
| Classic command centre | `/advisor/classic` + More link |

---

## Preserved legacy tools in CRM V2 navigation

Located under **More → Classic tools** in `AdviserCrmV2Shell` (Phase 14 + 14.1):

1. Protection Report Generator  
2. Shield Diagnostic  
3. Stress Test  
4. Planning & Roadmap  
5. Planning Outputs  
6. Client Binder  
7. Document Vault  
8. Meeting Studio  
9. Wealth Blueprint Print  
10. Annual Review Print  
11. Insights Authoring  
12. Client Feedback  
13. Legacy Appointments  
14. Review Pipeline  
15. Client Onboarding  
16. Book Health & File Quality  
17. Tasks & Follow-ups  
18. Adviser Profile  
19. Google Calendar Setup  
20. Google Calendar Operations  
21. Classic Adviser Workspace  

Client-context items link to `/advisor/clients` with tooltip guidance (no fake client IDs). Classic-dashboard items link to `/advisor/classic` with verified section anchors where available.

Adviser-only parity notice (all CRM V2 shell pages):

> CRM V2 is now your primary adviser workspace. Classic tools remain available under More.

---

## Phase 14.1 Navigation Completeness

**Type:** Navigation polish only — not a feature or schema phase.

### Tools added to More (Phase 14.1)

| Tool | Link |
|------|------|
| Client Feedback | `/advisor/feedback` |
| Stress Test | `/advisor/clients` |
| Planning Outputs | `/advisor/clients` |
| Review Pipeline | `/advisor/classic#advisor-review-pipeline` |
| Client Onboarding | `/advisor/classic#advisor-onboarding` |
| Book Health & File Quality | `/advisor/classic` |
| Tasks & Follow-ups | `/advisor/classic#advisor-tasks` |
| Wealth Blueprint Print | `/advisor/clients` |
| Annual Review Print | `/advisor/clients` |
| Adviser Profile | `/advisor/my-profile` |

### Tools still classic-only in practice (and why)

| Tool | Reason |
|------|--------|
| Book health / file quality panels | No standalone route — panels live on classic dashboard; nav opens `/advisor/classic` |
| Print views | Require `clientId` + report id — roster-first entry only |
| Client-tab workflows (Shield, stress, binder, vault, etc.) | Require selected client — `/advisor/clients` entry with tooltip |
| Legacy promotions | Retired redirect — intentionally not linked |

### Could not be directly deep-linked

Per hard rule: no `/advisor/clients/[id]` links without a real client id. Client-context and print workflows route through the client roster or classic workspace instead.

---

## What was intentionally not changed

- Legacy components, routes, and APIs under `/advisor/*` and `/api/advisor/*`
- CRM V2 sub-route prefix (`/advisor-v2/*`) — future migration optional
- Protection report generation logic
- Shield diagnostic / scoring / planning calculation
- Binder publication and vault permissions
- Meeting Studio authority model
- Today work queue as **projection only**
- Communications as draft/log unless explicit governed send flows
- Google Calendar **manual** sync only
- Advocacy — not used for sales ranking or queue priority
- Ethnicity — festive/moment context only
- Client portal behaviour
- `.env` files and pilot allowlist configuration

---

## Safety rules preserved

| Rule | Status |
|------|--------|
| No automatic outreach | Preserved |
| No Google Calendar auto-sync | Preserved |
| No auth bypass | Preserved |
| `requireAdvisorAccess()` unchanged | Preserved |
| `assertCrmV2Access()` unchanged | Preserved |
| No client CRM V2 exposure | Preserved |
| No fake data in UI | Preserved |
| Classic fallback at `/advisor/classic` | Preserved |

---

## Manual QA checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | Eligible adviser visits `/advisor` | CRM V2 shell + landing (not classic) |
| 2 | Eligible adviser visits `/advisor/classic` | Classic adviser console |
| 3 | Eligible adviser visits `/advisor-v2` | CRM V2 landing (alias) |
| 4 | Eligible adviser visits `/advisor-v2/today` | Today workspace |
| 5 | CRM V2 “Classic workspace” link | `/advisor/classic` (no loop) |
| 6 | Non-pilot adviser visits `/advisor` | Classic workspace |
| 7 | Non-pilot direct `/advisor-v2` | Access denied |
| 8 | Client user | No adviser CRM V2 access |
| 9 | Protection Report Generator from More | `/advisor/protection-report` loads |
| 10 | Shield Diagnostic entry | `/advisor/clients` loads |
| 11 | Binder / vault / Meeting Studio | Client roster → client file tabs |
| 12 | Insights Authoring | `/advisor/insights` loads |
| 13 | Templates / Reports / Operations | CRM V2 routes load when flags on |
| 14 | Google Calendar setup | Profile calendar section; manual connect |
| 15 | Communications | Draft/log only; no auto-send |
| 16 | Parity notice visible in CRM V2 | Yes, adviser shell only |
| 17 | Parity notice on client portal | No |
| 18 | No deleted routes | All `/advisor/*` routes respond |
| 19 | No raw JSON / debug copy in UI | Visual check |
| 20 | No secrets in browser console logs | Visual check |
| 21 | Client Feedback from More | `/advisor/feedback` loads |
| 22 | Planning Outputs from More | `/advisor/clients` loads (client-file entry) |
| 23 | Print routes from More | `/advisor/clients` loads; no fake client IDs in nav |
| 24 | Review Pipeline / Onboarding from More | `/advisor/classic` with section anchors |
| 25 | More shows all classic tools | 21 items under Classic tools |

---

## Rollback plan

### Code rollback

Revert Phase 14 commit(s). `/advisor` returns to Phase 13.6 behaviour (redirect to `/advisor-v2` for pilot advisers) or classic-only rendering.

### Operational rollback (no code deploy)

1. Disable `crm_v2_pilot_mode` or remove user from `CRM_V2_PILOT_USER_IDS`
2. `isCrmV2PilotAvailable()` returns `false` → `/advisor` shows classic workspace for all advisers
3. Pilot advisers retain `/advisor/classic` and direct legacy sub-routes

**No database rollback required** — routing and navigation only.

---

## Automated QA

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npx tsc --noEmit
```

---

## Explicit scope statement

**This is adviser workspace replacement with legacy feature preservation, not destructive legacy cleanup.**

- Legacy routes, APIs, and report generators are **not deleted**
- CRM V2 is **not** globally available to all advisers or clients
- Phase 15 legacy retirement remains **conditional** and operator-approved
- Classic fallback at `/advisor/classic` remains until native CRM V2 replacements exist

---

## Related documents

- [CRM_V2_PHASE_14_ADVISER_FEATURE_PARITY_INVENTORY.md](./CRM_V2_PHASE_14_ADVISER_FEATURE_PARITY_INVENTORY.md)
- [CRM_V2_PHASE_13_6_PILOT_DEFAULT_ADVISER_CUTOVER.md](./CRM_V2_PHASE_13_6_PILOT_DEFAULT_ADVISER_CUTOVER.md)
- [CRM_V2_PHASE_13_5_PILOT_NAVIGATION_POLISH.md](./CRM_V2_PHASE_13_5_PILOT_NAVIGATION_POLISH.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
