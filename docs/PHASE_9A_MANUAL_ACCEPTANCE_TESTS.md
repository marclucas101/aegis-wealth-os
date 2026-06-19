# Phase 9A — Manual Acceptance Tests

Execute after applying migration `202606200001_phase9a_compliance_access_architecture.sql`.

---

## A. Prospect client access

| # | Steps | Expected |
|---|-------|----------|
| A1 | Log in as prospect client; open `/dashboard` | Financial Readiness Snapshot view (no raw shield score) |
| A2 | Call `GET /api/dashboard/current` | Response contains `envelope.accessMode` — not raw `shield` object |
| A3 | Call `GET /api/shield-diagnostic/current` | Fallback envelope; no pillar scores |
| A4 | Call `GET /api/stress-testing/current` | Fallback envelope |
| A5 | Open sidebar navigation | No Shield Diagnostic, Stress Testing, Roadmap, Wealth Blueprint for prospect |

---

## B. Active client access

| # | Steps | Expected |
|---|-------|----------|
| B1 | Admin sets client `relationship_stage` to `active_client` | Stage updated; audit log `relationship_stage_changed` |
| B2 | Client opens dashboard without published output | Fallback: "No current published summary" or review in progress |
| B3 | After adviser publishes output, client refreshes dashboard | Published safe snapshot visible |
| B4 | Client calls shield/stress/roadmap APIs | Fallback unless `raw_client_financial_views` enabled |

---

## C. Adviser access

| # | Steps | Expected |
|---|-------|----------|
| C1 | Assigned adviser opens client workspace dashboard tab | Full read-only dashboard (Phase 8C) |
| C2 | Unassigned adviser calls `/api/advisor/clients/[id]/dashboard` | 403 |
| C3 | Assigned adviser: POST prepare → review → publish | Publication lifecycle completes; audit entries created |
| C4 | Unassigned adviser attempts publish | 403 |

---

## D. Admin access

| # | Steps | Expected |
|---|-------|----------|
| D1 | Admin updates relationship stage to `active_client` | Success |
| D2 | Admin disables `prospect_readiness_snapshot` via feature controls | Client dashboard shows feature disabled fallback; adviser views still work |
| D3 | Admin withdraws published output | Client no longer sees withdrawn summary |

---

## E. Security

| # | Steps | Expected |
|---|-------|----------|
| E1 | Client attempts `PATCH /api/admin/clients/[id]/relationship-stage` | 403 |
| E2 | Client attempts adviser publication POST | 403 |
| E3 | Browser sends forged `relationshipStage` in body | Ignored; server reads DB only |
| E4 | Inspect client API JSON | No `rawShieldScore`, `productName`, `shield.pillarScores`, etc. |

---

## F. Regression (must pass)

| # | Command | Expected |
|---|---------|----------|
| F1 | `npm run qa:phase9a-access` | Pass |
| F2 | `npm run qa:adviser-client-views` | Pass |
| F3 | `npm run qa:adviser-appointments` | Pass |
| F4 | `npm run qa:my-clients` | Pass |
| F5 | `npm run qa:my-adviser` | Pass |
| F6 | `npm run qa:calendar` | Pass |
| F7 | `npm run security:api` | Pass |
| F8 | `npm run security:advisor-access` | Pass |
| F9 | `npm run security:service-role` | Pass |
| F10 | `npm run final:check` | Pass |
| F11 | `npx tsc --noEmit` | Pass |
| F12 | `npm run lint` | Pass |
| F13 | `npm run build` | Pass |

---

## G. Publication edge cases

| # | Scenario | Expected |
|---|----------|----------|
| G1 | Draft output exists | Client cannot see it |
| G2 | New publish while old published exists | Old marked `superseded` |
| G3 | Expired output (`expires_at` in past) | Not returned as current |
| G4 | Withdrawn output | Not visible to client |
