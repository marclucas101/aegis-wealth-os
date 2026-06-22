# Phase 9F.1 Job Security

## Secret handling

| Control | Implementation |
|---------|----------------|
| `CRON_SECRET` server-only | Read from `process.env.CRON_SECRET`; never `NEXT_PUBLIC_*` |
| Constant-time comparison | `timingSafeEqual` in `lib/security/cronAuth.ts` |
| No secret in responses | Routes return aggregate counts and statuses only |
| No secret in job metadata | `sanitizeJobMetadata` allowlist |

## Route access matrix

| Route | Auth | Client | Adviser | Admin session alone |
|-------|------|--------|---------|---------------------|
| `POST /api/internal/jobs/scheduled-publishing` | `CRON_SECRET` | ❌ | ❌ | ❌ |
| `POST /api/admin/jobs/scheduled-publishing/run` | `requireAdminAccess` | ❌ | ❌ | ✅ |
| `GET /api/admin/jobs/runs` | `requireAdminAccess` | ❌ | ❌ | ✅ |

## Fail-closed behaviour

- Missing `CRON_SECRET` → internal route returns 401.
- Invalid secret → 401 (timing-safe compare).
- `scheduled_content_automation` disabled → run status `skipped`; no publications.
- DB feature-control lookup failure → code default `enabled: false`.

## Data minimization

Job records and API responses exclude:

- Content bodies, titles, summaries
- Recipient emails and client lists
- Provider payloads and references
- Stack traces and raw exceptions

Item-level records store only `reference_id` (UUID) and `sanitized_reason`.

## Concurrency

- Partial unique index `idx_automation_job_runs_single_active` — one `running` row per job name.
- `dbPublishGovernedContent` conditional UPDATE — no double publish.
- Notification and email delivery idempotency unchanged from Phase 9E.

## No arbitrary job dispatch

- Job names are a fixed registry (`scheduled_publishing` only).
- No user-supplied job names or handlers.
- Admin manual route hard-codes job name.

## Caching

All job API responses set `Cache-Control: private, no-store`.

## Service role

`automation_job_runs` / `automation_job_items` writes use `createAdminSupabaseClient()` only. RLS enabled with **no** client or adviser policies.
