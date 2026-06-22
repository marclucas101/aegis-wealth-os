# Phase 9F.1 Manual Acceptance Tests

Execute in **staging** after migration apply and before production enablement.

## Prerequisites

- Migration `202606200008` applied
- Admin account available
- At least one approved content item schedulable for testing
- `CRON_SECRET` configured in staging

## Feature control

| # | Test | Expected |
|---|------|----------|
| 1 | Default `scheduled_content_automation` in DB | `enabled = false` |
| 2 | Run internal route while disabled | `status: skipped`; no publications |
| 3 | Enable feature; run again with due content | Publications occur |
| 4 | Disable feature mid-day | Next run skipped; manual publish still works |

## Eligibility

| # | Test | Expected |
|---|------|----------|
| 5 | Schedule content 1 minute ahead | Not published until due |
| 6 | Wait until due; run job | Published |
| 7 | Draft / approved (unscheduled) content | Not auto-published |
| 8 | Withdrawn scheduled content | Skipped |
| 9 | Expired scheduled content | Skipped |
| 10 | Market update without source/expiry | Skipped |

## Concurrency

| # | Test | Expected |
|---|------|----------|
| 11 | Two simultaneous internal POSTs | One blocked or one succeeds; no double publish |
| 12 | Retry same request after success | Idempotent; no duplicate notifications/emails |
| 13 | Manual publish while job running | Safe; conditional publish |

## Notifications

| # | Test | Expected |
|---|------|----------|
| 14 | Automated publish with email enabled | One email per client |
| 15 | Re-run job after success | No duplicate emails |
| 16 | Email failure (disable provider) | Content remains published |

## Authorization

| # | Test | Expected |
|---|------|----------|
| 17 | Internal route without secret | 401 |
| 18 | Internal route with wrong secret | 401 |
| 19 | Client session POST to internal route | 401 |
| 20 | Non-admin manual run | 403 |
| 21 | Admin manual run with confirm | 200 + summary |

## Operations UI

| # | Test | Expected |
|---|------|----------|
| 22 | Job history loads | Sanitized columns only |
| 23 | Active run disables button | Button disabled during run |
| 24 | Empty history state | Friendly empty message |
| 25 | Feature disabled banner | Shown on automation page |

## Scheduler integration

| # | Test | Expected |
|---|------|----------|
| 26 | Configure external cron (or Vercel) | Authenticated POST succeeds |
| 27 | Verify `Cache-Control: no-store` on response | Present |

## Sign-off

- [ ] All tests passed in staging
- [ ] No sensitive data in job history or logs
- [ ] Rollback procedure reviewed
- [ ] Production `CRON_SECRET` rotated and stored securely
