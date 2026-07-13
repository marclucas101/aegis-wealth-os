# CRM V2 Phase 16 — Adviser Route Consolidation Audit

**Type:** Route audit (no schema changes)  
**Status:** Complete — codebase audit as of Phase 16 implementation  
**Verdict:** Canonical CRM V2 adviser modules live under `/advisor/*`; `/advisor-v2/*` are compatibility redirects; legacy adviser tools preserved.

---

## Purpose

Document every adviser route, classify ownership, identify conflicts, and record the preservation plan before Phase 16 canonical route implementation.

Routes verified in the repository — no invented URLs.

---

## Status legend

| Status | Meaning |
|--------|---------|
| **New adviser workspace** | CRM V2 module under canonical `/advisor` path with `assertCrmV2Access` |
| **Legacy adviser tool** | Pre-CRM V2 adviser route preserved unchanged |
| **Shared** | Used by both workspace and legacy flows |
| **Compatibility alias** | `/advisor-v2/*` redirect only |

---

## Primary workspace routes

| Existing route | Current owner | Can become canonical `/advisor` route | Conflict risk | Preservation plan | Notes |
|--------------|---------------|--------------------------------------|---------------|-------------------|-------|
| `GET /advisor` | New adviser workspace | Yes (home) | None | Primary landing with `AdviserCrmV2Shell` + dashboard | Classic fallback when pilot unavailable |
| `GET /advisor/classic` | Legacy adviser tool | No (fallback) | None | **Preserved** — emergency command centre | Not promoted in primary nav |
| `GET /advisor/today` | New adviser workspace | Yes | None | Canonical Today module | Was `/advisor-v2/today` |
| `GET /advisor/relationships` | New adviser workspace | Yes | None | Canonical Relationships list | Was `/advisor-v2/relationships` |
| `GET /advisor/relationships/[relationshipId]` | New adviser workspace | Yes | None | Relationship 360 | Sub-routes: protection, moments, advocacy |
| `GET /advisor/workspace/appointments` | New adviser workspace | Needs alias (`/advisor/workspace/*`) | **High** — `/advisor/appointments` is legacy | CRM V2 appointments at workspace prefix | Legacy manager stays at `/advisor/appointments` |
| `GET /advisor/workspace/appointments/new` | New adviser workspace | Needs alias | **High** | Same as above | |
| `GET /advisor/workspace/appointments/[appointmentId]` | New adviser workspace | Needs alias | **High** | Same as above | |
| `GET /advisor/service` | New adviser workspace | Yes | None | Canonical Service module | Was `/advisor-v2/service` |
| `GET /advisor/reports` | New adviser workspace | Yes | Low | Canonical Reports — no legacy `/advisor/reports` page | Client print routes are nested under `/advisor/clients/.../reports/...` |
| `GET /advisor/operations` | New adviser workspace | Yes | Low | Canonical Operations | No legacy `/advisor/operations` page |
| `GET /advisor/operations/google-calendar` | New adviser workspace | Yes | Low | Google Calendar operations telemetry | |
| `GET /advisor/communications` | New adviser workspace | Yes | None | Canonical Communications | Was `/advisor-v2/communications` |
| `GET /advisor/templates` | New adviser workspace | Yes | None | Placeholder templates page | |
| `GET /advisor/settings` | New adviser workspace | Yes | Low | Workspace settings placeholder | Distinct from `/advisor/my-profile` |
| `GET /advisor/settings/integrations/google-calendar` | New adviser workspace | Yes | Low | Google Calendar integration UI | |

---

## Conflict routes (legacy preserved)

| Existing route | Current owner | Can become canonical | Conflict risk | Preservation plan | Notes |
|--------------|---------------|---------------------|---------------|-------------------|-------|
| `GET /advisor/appointments` | Legacy adviser tool | **No** | **High** — `AppointmentsManagerClient` classic manager | **Preserved** — linked as "Legacy Appointments" in More → Tools | CRM V2 uses `/advisor/workspace/appointments` |
| `GET /advisor/clients` | Legacy adviser tool | No | Medium — classic client roster | **Preserved** — entry for Shield, binder, vault, Meeting Studio | CRM V2 Relationships is separate roster |
| `GET /advisor/clients/[clientId]` | Legacy adviser tool | No | Medium | **Preserved** — classic client file / 360 | |
| `GET /advisor/protection-report` | Legacy adviser tool | No | **High** — standalone generator | **Preserved** — More → Protection Report Generator | Not CRM V2 protection portfolio |
| `GET /advisor/feedback` | Legacy adviser tool | No | Low | **Preserved** — More → Client Feedback | |
| `GET /advisor/my-profile` | Legacy adviser tool | No | Low | **Preserved** — More → Adviser Profile | Calendar setup alias |
| `GET /advisor/setup` | Legacy adviser tool | No | Low | Redirect to profile | |
| `GET /advisor/calendar` | Legacy adviser tool | No | Low | Redirect to profile calendar section | |
| `GET /advisor/insights` | Legacy adviser tool | No | Low | **Preserved** — Insights Authoring | |
| `GET /advisor/promotions` | Legacy (retired) | No | None | Retired redirect notice | Not linked |

---

## `/advisor-v2` compatibility aliases

| Existing route | Current owner | Canonical target | Notes |
|--------------|---------------|------------------|-------|
| `GET /advisor-v2` | Compatibility alias | `/advisor` | Home redirect (Phase 15) |
| `GET /advisor-v2/today` | Compatibility alias | `/advisor/today` | |
| `GET /advisor-v2/relationships` | Compatibility alias | `/advisor/relationships` | |
| `GET /advisor-v2/relationships/[id]/*` | Compatibility alias | `/advisor/relationships/[id]/*` | Preserves query strings |
| `GET /advisor-v2/appointments` | Compatibility alias | `/advisor/workspace/appointments` | Conflict avoidance |
| `GET /advisor-v2/appointments/new` | Compatibility alias | `/advisor/workspace/appointments/new` | |
| `GET /advisor-v2/appointments/[id]` | Compatibility alias | `/advisor/workspace/appointments/[id]` | |
| `GET /advisor-v2/service` | Compatibility alias | `/advisor/service` | |
| `GET /advisor-v2/reports` | Compatibility alias | `/advisor/reports` | |
| `GET /advisor-v2/operations` | Compatibility alias | `/advisor/operations` | |
| `GET /advisor-v2/operations/google-calendar` | Compatibility alias | `/advisor/operations/google-calendar` | |
| `GET /advisor-v2/communications` | Compatibility alias | `/advisor/communications` | |
| `GET /advisor-v2/templates` | Compatibility alias | `/advisor/templates` | |
| `GET /advisor-v2/settings` | Compatibility alias | `/advisor/settings` | |
| `GET /advisor-v2/settings/integrations/google-calendar` | Compatibility alias | `/advisor/settings/integrations/google-calendar` | |

Alias layout: `assertCrmV2Access` only — no shell (avoids flash before redirect).

---

## API routes (unchanged)

| Prefix | Owner | Notes |
|--------|-------|-------|
| `/api/advisor/*` | Legacy adviser APIs | Unchanged |
| `/api/advisor-v2/*` | CRM V2 APIs | Unchanged — UI routes moved; APIs retain prefix |

---

## Client routes (frozen)

| Route | Owner | Modified in Phase 16 |
|-------|-------|---------------------|
| `/appointments` | Client portal | **No** |
| `/appointments/request` | Client portal | **No** |
| `/actions` | Client portal | **No** |
| `/requests` | Client portal | **No** |
| `/protection` | Client portal | **No** |
| `/preferences` | Client portal | **No** |
| `/preferences/advocacy` | Client portal | **No** |
| `/messages` | Client portal | **No** |

---

## Related documents

- [CRM_V2_PHASE_16_ADVISER_ROUTE_CONSOLIDATION.md](./CRM_V2_PHASE_16_ADVISER_ROUTE_CONSOLIDATION.md)
- [CRM_V2_PHASE_15_ADVISER_WORKSPACE_REBUILD.md](./CRM_V2_PHASE_15_ADVISER_WORKSPACE_REBUILD.md)
