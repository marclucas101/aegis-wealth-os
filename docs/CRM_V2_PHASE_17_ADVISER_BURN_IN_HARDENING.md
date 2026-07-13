# CRM V2 Phase 17 — Adviser Burn-In Regression Hardening

**Type:** Adviser-side QA, regression hardening, burn-in runbook (no schema, no client rollout)  
**Status:** Ready for adviser-only burn-in after QA passes  
**Verdict:** This is adviser-only burn-in — **not** client rollout approval.

---

## Objective

Harden the consolidated AEGIS Adviser Workspace after Phase 16 route consolidation. Validate stability, strengthen automated route regression checks, and keep client-facing rollout frozen while eligible advisers operate daily on `/advisor`.

**Not in scope:** client portal rollout, schema changes, legacy deletion, new features.

---

## Burn-in scope

| Area | In scope | Out of scope |
|------|----------|--------------|
| `/advisor` canonical CRM V2 workspace | Yes | Client portal routes |
| `/advisor-v2/*` compatibility redirects | Yes | Schema migrations |
| Legacy adviser tools (More → Tools) | Yes | Automatic outreach |
| Classic fallback `/advisor/classic` | Yes | Google Calendar auto-sync |
| Automated regression QA scripts | Yes | Client-facing CRM V2 flags |

---

## 48–72 hour adviser-only observation plan

### Day 0 (pre-burn-in)

1. Run automated QA (see § Automated QA below).
2. Confirm `crm_v2_pilot_mode` and allowlist include burn-in advisers only.
3. Confirm client-facing feature flags remain **off** (see § Client safety freeze).
4. Record baseline: adviser can open `/advisor`, `/advisor/today`, legacy tools.

### Days 1–2 (active use)

Eligible advisers use the workspace for real daily work:

| Session | Routes to exercise |
|---------|-------------------|
| Morning stand-up | `/advisor`, `/advisor/today` |
| Client work | `/advisor/relationships`, `/advisor/workspace/appointments`, `/advisor/service` |
| Reporting / ops | `/advisor/reports`, `/advisor/operations` |
| Communications | `/advisor/communications` (draft/log only) |
| Legacy as needed | `/advisor/protection-report`, `/advisor/clients`, `/advisor/feedback`, `/advisor/my-profile` |

### Day 3 (review)

1. Review issue log (severity definitions below).
2. Re-run `npm run qa:adviser-workspace-regression`.
3. Apply go/no-go criteria before any client-facing consideration.

---

## Routes to use daily

### Primary workspace (canonical)

- `/advisor` — AEGIS Adviser Workspace home
- `/advisor/today` — Today module
- `/advisor/relationships` — CRM V2 roster
- `/advisor/workspace/appointments` — CRM V2 appointments (not legacy `/advisor/appointments`)
- `/advisor/service` — Service and commitments
- `/advisor/reports` — Adviser reports
- `/advisor/operations` — Operator diagnostics
- `/advisor/communications` — Governed communications bridge (More nav)
- `/advisor/templates`, `/advisor/settings` — Workspace placeholders

### Compatibility aliases (bookmark safety)

- `/advisor-v2` → `/advisor`
- `/advisor-v2/today` → `/advisor/today`
- `/advisor-v2/appointments` → `/advisor/workspace/appointments`
- Other `/advisor-v2/*` → matching `/advisor/*` paths

### Classic fallback

- `/advisor/classic` — Emergency command centre; subtle link in shell footer only

---

## Legacy tools to test

Exercise from **More → Tools** at least once during burn-in:

| Tool | Route |
|------|-------|
| Protection Report Generator | `/advisor/protection-report` |
| Shield Diagnostic | `/advisor/clients` → client file tab |
| Planning & Roadmap | `/advisor/clients` |
| Client Binder / Vault / Meeting Studio | `/advisor/clients` |
| Insights Authoring | `/advisor/insights` |
| Client Feedback | `/advisor/feedback` |
| Legacy Appointments | `/advisor/appointments` |
| Adviser Profile / Calendar setup | `/advisor/my-profile` |
| Google Calendar Operations | `/advisor/operations/google-calendar` |
| Classic workspace | `/advisor/classic` |

Client-context tools must route through roster — **no fake client IDs** in navigation.

---

## Client safety freeze

**Client-facing features remain frozen.** No client portal rollout is approved by this phase.

Verified unchanged and **must not be modified** during burn-in:

| Route | Owner |
|-------|-------|
| `/appointments`, `/appointments/request` | Client portal |
| `/actions`, `/requests` | Client portal |
| `/protection` | Client portal |
| `/preferences`, `/preferences/advocacy` | Client portal |
| `/messages` | Client portal |

### Explicit prohibitions during burn-in

- No client-facing CRM V2 feature enablement
- No client-facing promotion or rollout copy
- No automatic message sends
- No automatic calendar invites to clients
- No new client links from adviser workspace changes

---

## Feature flags to keep off for client-facing modules

Keep **disabled** (`enabled: false`, `client_visible: false`) unless a separate approved client rollout phase explicitly enables them:

| Flag | Notes |
|------|-------|
| `crm_v2_master` | Master gate — adviser burn-in uses pilot path |
| `crm_v2_pilot_mode` | Adviser pilot only — not client rollout |
| `crm_v2_appointments_client` | Client appointment collaboration |
| `crm_v2_advocacy` | Client advocacy preferences |
| `crm_v2_client_profile` | Client profile / moments preferences |
| Any `client_visible: true` CRM V2 flag | Requires separate operator approval |

Adviser-side flags (`crm_v2_today`, `crm_v2_reports`, etc.) may be enabled for pilot advisers per Phase 13 activation order — **adviser scope only**.

---

## Issue severity definitions

| Severity | Definition | Action |
|----------|------------|--------|
| **S0 — Blocker** | Data loss, auth bypass, client route regression, redirect loop, unintended client send | Stop burn-in; operational rollback |
| **S1 — Critical** | Primary workspace unusable; legacy tool unreachable; wrong adviser data shown | Fix or rollback within 4 hours |
| **S2 — Major** | Module degraded but workaround exists (e.g. use classic fallback) | Log; fix before extending burn-in |
| **S3 — Minor** | Copy, styling, non-blocking nav quirk | Log; fix in next hardening pass |
| **S4 — Observation** | UX improvement; no functional impact | Log only |

---

## Rollback plan

### Operational rollback (preferred — no deploy)

1. Disable `crm_v2_pilot_mode` or remove adviser from `CRM_V2_PILOT_USER_IDS`.
2. `/advisor` renders classic workspace for affected advisers.
3. `/advisor/classic` and all legacy `/advisor/*` routes remain available.

### Code rollback

Revert Phase 16–17 commits if structural routing regression is found. Restore prior nav/redirect behaviour.

**No database rollback required.**

---

## Go/no-go criteria

### Go — continue adviser burn-in

- All automated QA passes (§ Automated QA)
- No S0 or S1 issues open
- `/advisor-v2` aliases redirect correctly; no loops
- Legacy tools reachable
- Client routes verified untouched
- No pilot language or debug strings in main adviser shell
- No unintended client notifications or sends

### No-go — pause burn-in

- Any S0 issue
- Unresolved S1 after 4 hours
- Client route behaviour changed
- `requireAdvisorAccess()` or `assertCrmV2Access()` weakened
- Evidence of automatic outreach or calendar invite sends

### Not a go for client rollout

Passing adviser burn-in **does not** approve client-facing CRM V2 rollout. Client enablement requires a separate phase, operator sign-off, and client safety checklist.

---

## Automated QA

```bash
npm run final:check
npm run qa:crm-v2-pilot-readiness
npm run qa:crm-v2-shell
npm run qa:crm-v2-today
npm run qa:adviser-workspace-regression
npx tsc --noEmit
```

Regression script: `scripts/run-adviser-workspace-regression.ts`

---

## Manual QA checklist

| # | Check | Expected |
|---|-------|----------|
| 1 | `/advisor` | AEGIS Adviser Workspace dashboard |
| 2 | `/advisor/today` | Today module |
| 3 | `/advisor/relationships` | Relationships list |
| 4 | `/advisor/workspace/appointments` | CRM V2 appointments |
| 5 | `/advisor/service` | Service module |
| 6 | `/advisor/reports` | Reports module |
| 7 | `/advisor/operations` | Operations module |
| 8 | `/advisor/classic` | Classic command centre |
| 9 | `/advisor/protection-report` | Protection report generator |
| 10 | `/advisor/feedback` | Client feedback review |
| 11 | `/advisor/my-profile` | Adviser profile |
| 12 | `/advisor-v2` | Redirects to `/advisor` |
| 13 | `/advisor-v2/today` | Redirects to `/advisor/today` |
| 14 | `/advisor-v2/appointments` | Redirects to `/advisor/workspace/appointments` |
| 15 | No redirect loops | Follow redirects manually |
| 16 | No pilot language | Clean product copy |
| 17 | No raw JSON / debug logs | Visual check |
| 18 | Client portal routes | Unchanged behaviour |

---

## Remaining adviser burn-in risks

| Risk | Mitigation |
|------|------------|
| Appointments URL confusion (`/advisor/workspace/appointments` vs legacy `/advisor/appointments`) | More → Legacy Appointments link; burn-in observation |
| Bookmarked `/advisor-v2/*` URLs | Compatibility redirects tested in regression script |
| Partial feature flag state | Phase 13 activation order; operational rollback |
| Classic fallback over-use masking workspace issues | Log classic usage during burn-in |
| API prefix `/api/advisor-v2/*` vs UI `/advisor/*` | Cosmetic only; no functional change |

---

## Related documents

- [CRM_V2_PHASE_16_ADVISER_ROUTE_CONSOLIDATION.md](./CRM_V2_PHASE_16_ADVISER_ROUTE_CONSOLIDATION.md)
- [CRM_V2_PHASE_15_ADVISER_WORKSPACE_REBUILD.md](./CRM_V2_PHASE_15_ADVISER_WORKSPACE_REBUILD.md)
- [CRM_V2_ROLLOUT_INDEX.md](./CRM_V2_ROLLOUT_INDEX.md)
- [CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md](./CRM_V2_PHASE_13_PILOT_OPERATING_NOTE.md)
