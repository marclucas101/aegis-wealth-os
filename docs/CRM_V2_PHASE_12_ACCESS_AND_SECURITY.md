# CRM V2 Phase 12 — Access and Security

---

## Reports (`crm_v2_reports`)

| Rule | Implementation |
|------|----------------|
| Gate | `assertCrmV2ReportsAccess()` |
| Master + pilot | Required via `assertCrmV2Access()` |
| Client access | Denied — `client_visible=false` |
| Adviser ID | From session only |
| Assignment | Counts filtered `advisor_user_id = auth.uid()` |
| Admin | `admin_scope_deferred` — no book-wide report data |
| Feature disabled | No business loading |
| Cross-adviser IDs | Reveal nothing |

## Operations (`crm_v2_operations`)

| Rule | Implementation |
|------|----------------|
| Gate | `assertCrmV2OperationsAccess()` |
| Roles | Advisor and admin via `requireAdvisorAccess()` |
| Client access | Denied |
| Adviser-scoped panels | Advisor role only |
| Feature controls | Read-only from `loadFeatureControls()` |
| No new feature-control authority | Confirmed |

## APIs

All report and operations GET routes: `private, no-store`, `X-Request-Id`, no writes.

## IDOR

Section keys validated against allowlists. Invalid keys return 404 without data leak.
