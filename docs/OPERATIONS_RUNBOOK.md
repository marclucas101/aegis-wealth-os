# Operations Runbook — Phase 4W

**Date:** 2026-06-10  
**Purpose:** Day-to-day operational procedures for Aegis Wealth OS on Vercel + Supabase.

**Related:** [Monitoring & Logging](./MONITORING_AND_LOGGING.md) · [Incident Response](./INCIDENT_RESPONSE.md) · [Backup & Recovery](./BACKUP_AND_RECOVERY.md) · [Audit Log Review](./AUDIT_LOG_REVIEW.md) · [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)

---

## 1. Quick health checks

Run after every deploy and during incidents.

### App process (no database)

```bash
curl -s https://<host>/api/health/app
```

Expected (200):

```json
{
  "ok": true,
  "status": "ok",
  "timestamp": "...",
  "environment": "production",
  "version": "0.1.0",
  "uptimeSeconds": 123
}
```

### Supabase connectivity

```bash
curl -s https://<host>/api/health/supabase
```

Expected when healthy (200):

```json
{
  "ok": true,
  "databaseReachable": true,
  "tablesAccessible": true,
  "timestamp": "..."
}
```

In **production mode**, failed checks omit internal `error` strings. Use Vercel/Supabase logs for diagnosis.

### Local / staging

```bash
npm run dev
curl -s http://localhost:3000/api/health/app
curl -s http://localhost:3000/api/health/supabase
```

### Automation

```bash
npm run ops:check
npm run deploy:check
BASE_URL=https://<host> npm run qa:smoke
```

---

## 2. Deployment health workflow

1. Confirm Vercel build succeeded (install + `next build`).
2. Hit `GET /api/health/app` — confirms the Next.js runtime is serving.
3. Hit `GET /api/health/supabase` — confirms env vars and DB reachability.
4. Run [Post-Deployment QA](./POST_DEPLOYMENT_QA.md) smoke paths.
5. Spot-check Vercel **Functions** logs for structured JSON errors (`level: "error"`).
6. Spot-check Supabase **Logs** for auth or Postgres errors in the last 15 minutes.

---

## 3. Inspecting Vercel logs

1. Vercel dashboard → project → **Logs** (or **Deployments → [deployment] → Functions**).
2. Filter by route (e.g. `/api/documents/upload`) or status **500**.
3. Look for JSON log lines from `lib/ops/logger.ts`:
   - `level`: `info` | `warn` | `error` | `debug`
   - `metadata.route`, `metadata.action`, `metadata.timingMs`, `metadata.requestId`
4. Correlate with `X-Request-Id` response header on health endpoints when debugging a single request.
5. **Do not** paste full log lines containing tokens or cookies into tickets — redact first.

---

## 4. Inspecting Supabase logs

1. Supabase dashboard → **Logs** → choose **API**, **Auth**, **Postgres**, or **Storage**.
2. **Auth failures:** filter Auth logs for `401`, invalid refresh, or redirect URL mismatches.
3. **Database errors:** Postgres logs for constraint violations, connection limits, or slow queries.
4. **Storage failures:** Storage logs for upload/download policy denials or bucket errors.
5. Cross-reference `audit_logs` for successful writes (see [Audit Log Review](./AUDIT_LOG_REVIEW.md)).

---

## 5. Common failure playbooks

### Upload failures (client or advisor)

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 413 / size error | File > 10 MB | User-facing; confirm limit in API route |
| 400 MIME / extension | Disallowed type | Check allowed types in upload route |
| 403 | RLS / assignment | Verify advisor assignment or client ownership |
| 500 | Storage or DB | Check Vercel function log + Supabase Storage logs |
| No audit row | Audit insert failed | Search Vercel logs for `[auditLog]` or structured `audit` errors |

Steps:

1. Reproduce with a small test PDF in staging.
2. Check Vercel log for route `/api/documents/upload` or advisor upload path.
3. Check Supabase Storage → `client-documents` policies and object list.
4. Confirm `document_uploaded` / `advisor_document_uploaded` in `audit_logs`.

### Auth failures

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Redirect loop | Callback URL not allow-listed | Supabase Auth → URL Configuration |
| 401 on `/api/me` | Expired session / cookie issue | Test login flow; check middleware |
| Invite link broken | Wrong Site URL or `redirectTo` | Verify production origin in Supabase |
| 403 on advisor/admin routes | Role not set in `public.users` | Admin console or SQL role check |

Steps:

1. Confirm redirect URLs in [Supabase Production Setup](./SUPABASE_PRODUCTION_SETUP.md).
2. Test signup → callback → dashboard on production URL.
3. Review Supabase Auth logs for the user email (redact in tickets).

### API 500 errors

1. Identify route from client network tab or Vercel log `metadata.route`.
2. Search Vercel logs for `captureServerError` / `level":"error"` near the timestamp.
3. If DB-related, run `GET /api/health/supabase`.
4. If env-related, verify Vercel env vars (names only — never log values).
5. Escalate per [Incident Response](./INCIDENT_RESPONSE.md) if user-facing impact is broad.

### Rate-limit issues (429)

1. Expected during burst testing — in-memory limiter returns `Too many requests`.
2. Check `Retry-After` header; advise user to wait and retry.
3. **Known limitation:** limits are per serverless instance, not global ([Deployment docs](./DEPLOYMENT_VERCEL_SUPABASE.md#rate-limiting-limitation)).
4. If legitimate traffic is blocked, tune presets in `lib/security/rateLimit.ts` or plan Redis/KV upgrade.

---

## 6. Structured logging usage (server routes)

For new or updated API routes (when permitted), prefer:

```typescript
import { logger } from "@/lib/ops/logger";
import { captureServerError, publicErrorMessage } from "@/lib/ops/errorReporting";

logger.info("Action completed", {
  route: "/api/example",
  action: "example_action",
  userRole: "advisor",
  status: 200,
  timingMs: 42,
  requestId,
});

captureServerError("Example action failed", {
  route: "/api/example",
  action: "example_action",
  error: err,
});
```

Secrets are redacted automatically — do not log raw request bodies or Authorization headers.

---

## 7. Pre-production ops gate

- [ ] `npm run ops:check` passes
- [ ] Health endpoints return 200 on staging
- [ ] [Backup & Recovery](./BACKUP_AND_RECOVERY.md) reviewed
- [ ] [Incident Response](./INCIDENT_RESPONSE.md) owner assigned
- [ ] [Audit Log Review](./AUDIT_LOG_REVIEW.md) cadence scheduled
- [ ] External error tracking (Sentry/Axiom/Logtail) planned but not required for MVP

---

## 8. Contacts and ownership (fill before go-live)

| Role | Name | Contact |
|------|------|---------|
| Primary on-call | | |
| Supabase admin | | |
| Vercel admin | | |
| Security / compliance | | |
