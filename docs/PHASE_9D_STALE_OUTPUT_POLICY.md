# Phase 9D — Stale Output Policy

## Principles

1. Never imply stale information remains current
2. Show **Review recommended** when thresholds exceeded or `expires_at` passed
3. Provide booking CTA (`/my-adviser`)
4. Preserve historical access where policy permits (superseded rows are not *current*)
5. Never auto-regenerate client-facing results

## Configuration

Central config: `lib/compliance/staleOutputPolicy.ts`

| Output type | Default threshold (days) |
|-------------|-------------------------|
| `financial_overview` | 180 |
| `financial_readiness_snapshot` | 90 |
| `client_plan_summary` | 365 |
| `roadmap_summary` | 180 |
| `annual_review_summary` | 365 |
| `goal_plan_summary` | 365 |
| `wealth_blueprint_summary` | 365 |
| `meeting_summary` | 180 |
| `insights_update` | 90 |

## Assessment logic

`assessOutputStaleness()` uses:

1. **Hard expiry** — `expires_at <= now()` → stale + review recommended
2. **Age threshold** — days since `dataAsAt` (fallback `publishedAt`) > configured threshold

## UI treatment

- Financial Overview: amber banner + book appointment link
- My Plan: per-publication **Review recommended** badge
- Fallback copy uses `CLIENT_TERMINOLOGY.reviewRecommended`

## Adviser responsibility

Advisers publish refreshed outputs through Phase 9A publication workflow. The platform does not refresh client views automatically.
