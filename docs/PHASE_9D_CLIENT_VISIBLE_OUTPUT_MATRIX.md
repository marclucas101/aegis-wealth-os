# Phase 9D — Client Visible Output Matrix

| Output type | Audience | Client route | DTO | Feature flag | Stale threshold (days) |
|-------------|----------|--------------|-----|--------------|------------------------|
| `financial_overview` | `client_published` | `/dashboard` | `ClientSafeFinancialReadinessSnapshot` | `client_published_financial_overview` | 180 |
| `client_plan_summary` | `client_published` | `/my-plan` | `ClientSafePlanSummary` | — | 365 |
| `wealth_blueprint_summary` | `client_published` | `/my-plan` (legacy) | `ClientSafePlanSummary` | — | 365 |
| `annual_review_summary` | `client_published` | `/goals-reviews` | `ClientSafePlanSummary` | — | 365 |
| `goal_plan_summary` | `client_published` | `/goals-reviews` | `ClientSafePlanSummary` | — | 365 |
| `meeting_summary` | `client_published` | `/my-plan` | `ClientSafeMeetingSummary` | `meeting_summary_publication` | 180 |
| `roadmap_summary` | `client_published` | `/roadmap` (supplement) | `ClientSafePlanSummary` | — | 180 |
| `financial_readiness_snapshot` | `client_published` | `/dashboard` (prospect only) | `ClientSafeFinancialReadinessSnapshot` | `prospect_readiness_snapshot` | 90 |

## Never client-visible

- `adviser_internal` outputs
- `meeting_presentation` payloads
- Draft / `adviser_reviewed` / withdrawn / superseded / expired rows
- Raw Meeting Studio session records
- Internal roadmap items (`client_visible = false`)
- Shield/stress raw engine output

## Configuration

Stale thresholds: `lib/compliance/staleOutputPolicy.ts` (`STALE_OUTPUT_THRESHOLDS_DAYS`).
