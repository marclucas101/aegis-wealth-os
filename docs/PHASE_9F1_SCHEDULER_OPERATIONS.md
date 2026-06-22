# Phase 9F.1 Scheduler Operations

Provider-neutral deployment guide for scheduled governed-content publication.

## Overview

Automated publication invokes:

`GET /api/internal/jobs/scheduled-publishing` (Vercel Cron — default HTTP method)

`POST /api/internal/jobs/scheduled-publishing` (manual operator / curl — same auth and execution path)

Both methods call the same internal handler. Authentication is **only** `CRON_SECRET` via `Authorization: Bearer` (or `x-cron-secret`). Do not rely on the Vercel cron user-agent.

## Required environment variable

| Variable | Scope | Purpose |
|----------|-------|---------|
| `CRON_SECRET` | Server only | Authenticates scheduler and internal job routes |

Set in Vercel Production (Sensitive). Never use `NEXT_PUBLIC_*`.

## Expected invocation frequency

- **Recommended:** every 5–15 minutes in production.
- Align frequency with your shortest acceptable publication delay after `scheduled_at`.
- More frequent invocations improve timeliness; each run is idempotent and batch-limited.

## Authentication

Send either:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

No browser session is accepted.

### Example (curl)

**Vercel Cron (GET — production default):**

```bash
curl "https://your-domain.com/api/internal/jobs/scheduled-publishing" \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Manual operator (POST — optional):**

```bash
curl -X POST "https://your-domain.com/api/internal/jobs/scheduled-publishing" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Timeout considerations

- Route `maxDuration`: 60 seconds (Vercel).
- Job internal deadline: 55 seconds (`SCHEDULED_PUBLISHING_TIMEOUT_MS`).
- Stale runs older than 5 minutes are marked failed before a new run starts.

## Batch-size considerations

- Maximum items per run: **25** (`SCHEDULED_PUBLISHING_MAX_BATCH`).
- If more than 25 items are due, subsequent scheduler invocations process the remainder.
- Increase frequency rather than batch size without engineering review.

## Enable automation

1. Apply migration `202606200008_phase9f_scheduled_publishing.sql` in staging first.
2. In admin feature controls (or `platform_feature_controls`), set `scheduled_content_automation` to **enabled**.
3. Configure scheduler to call the internal route.
4. Verify a successful run in **Admin → Communications → Scheduled publishing operations**.

## Disable automation

Set `scheduled_content_automation` to **disabled**. The next run records status `skipped` and publishes nothing. Manual admin publish remains available.

## Manual execution

1. Sign in as admin.
2. Open `/admin/communications/automation`.
3. Click **Run scheduled publishing now** and confirm.
4. Review sanitized summary and job history table.

## Verify a successful run

Check job history for:

- `status`: `success` (or `skipped` if nothing due / feature off)
- `itemsSucceeded` matches expected due items
- `sanitizedError` is null

Internal route response (sanitized):

```json
{
  "ok": true,
  "featureEnabled": true,
  "run": {
    "id": "...",
    "status": "success",
    "itemsExamined": 2,
    "itemsSucceeded": 2,
    "itemsSkipped": 0,
    "itemsFailed": 0,
    "sanitizedError": null
  }
}
```

## Stuck run response

If `activeRunBlocked` is true or UI shows "Run in progress":

1. Wait 5 minutes for stale-run cleanup, or
2. Manually mark stale `automation_job_runs` row `failed` in staging (see rollback doc), then retry.

## Rollback

See [PHASE_9F1_MIGRATION_AND_ROLLBACK.md](./PHASE_9F1_MIGRATION_AND_ROLLBACK.md).

## Vercel Cron (optional)

Add to `vercel.json` when ready (not provisioned automatically in Phase 9F.1):

```json
{
  "crons": [
    {
      "path": "/api/internal/jobs/scheduled-publishing",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Vercel Cron sends **GET** with `Authorization: Bearer <CRON_SECRET>`. Ensure `CRON_SECRET` is set in Vercel project settings (Sensitive). Test the GET route after deploy before enabling the schedule.
