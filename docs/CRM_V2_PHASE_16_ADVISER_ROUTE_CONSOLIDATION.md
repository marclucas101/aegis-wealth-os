# CRM V2 Phase 16 — Adviser Route Consolidation and Client-Safe Hardening

**Type:** Adviser-side routing, navigation, compatibility redirects, copy polish  
**Status:** Complete  
**Verdict:** CRM V2 adviser modules are native under `/advisor/*`. `/advisor-v2/*` are compatibility redirects. Legacy tools and client portal untouched.

---

## Objective

Consolidate the adviser experience so the AEGIS Adviser Workspace feels fully native under `/advisor`, with `/advisor-v2` as a compatibility alias — not a visible product route.

**Not in scope:** client portal rollout, schema changes, legacy deletion.

---

## Route model before

| Area | Path |
|------|------|
| Home | `/advisor` (primary), `/advisor-v2` (redirect home only) |
| CRM V2 modules | `/advisor-v2/today`, `/relationships`, `/appointments`, `/service`, `/reports`, `/operations`, etc. |
| Legacy tools | `/advisor/appointments`, `/clients`, `/protection-report`, `/feedback`, `/classic`, etc. |
| Nav links | Pointed to `/advisor-v2/*` for CRM V2 modules |

---

## Route model after

| Area | Canonical path | Notes |
|------|----------------|-------|
| Home | `/advisor` | Unchanged |
| Today | `/advisor/today` | |
| Relationships | `/advisor/relationships` (+ sub-routes) | |
| Appointments (CRM V2) | `/advisor/workspace/appointments` | **Conflict** — legacy at `/advisor/appointments` |
| Service | `/advisor/service` | |
| Reports | `/advisor/reports` | |
| Operations | `/advisor/operations` (+ `/google-calendar`) | |
| Communications | `/advisor/communications` | More nav |
| Templates | `/advisor/templates` | More nav |
| Settings | `/advisor/settings` (+ integrations) | More nav |
| Compatibility | `/advisor-v2/*` → canonical paths | Access-gated redirects only |

Path constants: `lib/crm-v2/navigation.ts` (`CRM_V2_*_PATH`).

Layout: `app/advisor/(crm-v2)/layout.tsx` — `assertCrmV2Access` + `AdviserCrmV2Shell`.

---

## Conflicts found

| Preferred route | Conflict | Resolution |
|-----------------|----------|------------|
| `/advisor/appointments` | Legacy `AppointmentsManagerClient` | CRM V2 at `/advisor/workspace/appointments` |
| `/advisor/clients` | Classic client roster | Unchanged — Relationships is CRM V2 roster |
| `/advisor/protection-report` | Protection report generator | Unchanged |
| `/advisor/feedback` | Client feedback review | Unchanged |
| `/advisor/my-profile` | Adviser profile & calendar | Unchanged — workspace `/advisor/settings` is separate placeholder |

`/advisor/reports` and `/advisor/operations` had **no** top-level legacy page conflict (only nested client print routes).

---

## Canonical routes created

```
app/advisor/(crm-v2)/
  layout.tsx
  today/page.tsx
  relationships/page.tsx
  relationships/[relationshipId]/page.tsx
  relationships/[relationshipId]/protection/page.tsx
  relationships/[relationshipId]/moments/page.tsx
  relationships/[relationshipId]/advocacy/page.tsx
  workspace/appointments/page.tsx
  workspace/appointments/new/page.tsx
  workspace/appointments/[appointmentId]/page.tsx
  service/page.tsx
  reports/page.tsx
  operations/page.tsx
  operations/google-calendar/page.tsx
  communications/page.tsx
  templates/page.tsx
  settings/page.tsx
  settings/integrations/google-calendar/page.tsx
```

---

## `/advisor-v2` compatibility redirects

| Alias | Target |
|-------|--------|
| `/advisor-v2` | `/advisor` |
| `/advisor-v2/today` | `/advisor/today` |
| `/advisor-v2/relationships` | `/advisor/relationships` |
| `/advisor-v2/relationships/[id]` | `/advisor/relationships/[id]` (+ query) |
| `/advisor-v2/relationships/[id]/protection` | `/advisor/relationships/[id]/protection` |
| `/advisor-v2/relationships/[id]/moments` | `/advisor/relationships/[id]/moments` |
| `/advisor-v2/relationships/[id]/advocacy` | `/advisor/relationships/[id]/advocacy` |
| `/advisor-v2/appointments` | `/advisor/workspace/appointments` |
| `/advisor-v2/appointments/new` | `/advisor/workspace/appointments/new` |
| `/advisor-v2/appointments/[id]` | `/advisor/workspace/appointments/[id]` |
| `/advisor-v2/service` | `/advisor/service` |
| `/advisor-v2/reports` | `/advisor/reports` |
| `/advisor-v2/operations` | `/advisor/operations` |
| `/advisor-v2/operations/google-calendar` | `/advisor/operations/google-calendar` |
| `/advisor-v2/communications` | `/advisor/communications` |
| `/advisor-v2/templates` | `/advisor/templates` |
| `/advisor-v2/settings` | `/advisor/settings` |
| `/advisor-v2/settings/integrations/google-calendar` | `/advisor/settings/integrations/google-calendar` |

Helper: `lib/crm-v2/aliasRedirects.ts`.

No redirect loops: aliases never redirect back to `/advisor-v2`.

---

## Preserved legacy tools

All Phase 14/15 tools remain reachable — routes unchanged:

- `/advisor/classic`, `/advisor/protection-report`, `/advisor/clients`, `/advisor/feedback`, `/advisor/insights`, `/advisor/appointments` (legacy), `/advisor/my-profile`, client file sub-routes (roadmap, planning-outputs, meeting-studio, print routes).

More → Tools nav unchanged in structure; Google Calendar Operations now links to `/advisor/operations/google-calendar`.

---

## Client safety freeze

Verified unchanged:

- `/appointments`, `/appointments/request`, `/actions`, `/requests`, `/protection`, `/preferences`, `/preferences/advocacy`, `/messages`

No new client links, notifications, sends, or rollout copy.

---

## What was intentionally not changed

- Database schema and migrations
- `.env` files and pilot allowlist
- `requireAdvisorAccess()` and `assertCrmV2Access()` logic
- `/api/advisor-v2/*` API prefix
- Scoring, service, communications, Google Calendar business logic
- Client portal routes and feature flags
- Automatic outreach, auto-send, Google Calendar auto-sync

---

## Hardening and polish

- Primary nav uses canonical `/advisor` paths (appointments → workspace prefix)
- Dashboard, Today quick links, route builders updated to canonical paths
- No visible `/advisor-v2` in primary nav or dashboard CTAs
- Google Calendar operations page styled to match workspace theme
- `/advisor-v2` alias layout does not render shell before redirect

---

## Manual QA checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | `/advisor` | AEGIS Adviser Workspace dashboard |
| 2 | `/advisor/today` | Today module |
| 3 | `/advisor/relationships` | Relationships list |
| 4 | `/advisor/workspace/appointments` | CRM V2 appointments |
| 5 | `/advisor/appointments` | Legacy appointment manager |
| 6 | `/advisor/service`, `/reports`, `/operations` | CRM V2 modules |
| 7 | `/advisor-v2/today` | Redirects to `/advisor/today` |
| 8 | `/advisor-v2/appointments` | Redirects to `/advisor/workspace/appointments` |
| 9 | `/advisor/classic` | Classic command centre |
| 10 | Protection report, Shield, binder, vault, Meeting Studio | Legacy routes work |
| 11 | Client routes | Unchanged |
| 12 | No redirect loops | Manual follow redirects |
| 13 | Non-eligible adviser | No expanded access |

---

## Rollback plan

### Code rollback

Revert Phase 16 commit(s). Restore `/advisor-v2/*` as rendering routes with shell layout; revert nav to `/advisor-v2` prefixes.

### Operational rollback

Disable `crm_v2_pilot_mode` or remove user from allowlist — `/advisor` shows classic workspace; legacy routes remain.

**No database rollback required.**

---

## Remaining gaps before client-facing rollout

| Gap | Notes |
|-----|-------|
| Appointments URL prefix | `/advisor/workspace/appointments` until legacy retirement approved |
| `/advisor/tools` landing | Not implemented — tools remain in More menu groups |
| API prefix unification | `/api/advisor-v2/*` cosmetic only |
| Classic retirement | Operator approval required |
| Client CRM V2 features | Separate rollout phase |

---

## Automated QA

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npm run qa:crm-v2-shell
npm run qa:crm-v2-today
npx tsc --noEmit
```

---

## Related documents

- [CRM_V2_PHASE_16_ADVISER_ROUTE_CONSOLIDATION_AUDIT.md](./CRM_V2_PHASE_16_ADVISER_ROUTE_CONSOLIDATION_AUDIT.md)
- [CRM_V2_PHASE_15_ADVISER_WORKSPACE_REBUILD.md](./CRM_V2_PHASE_15_ADVISER_WORKSPACE_REBUILD.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
