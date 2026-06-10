# Monitoring & Logging — Phase 4W

**Date:** 2026-06-10  
**Purpose:** Lightweight production observability for Aegis Wealth OS without external SaaS dependencies.

**Related:** [Operations Runbook](./OPERATIONS_RUNBOOK.md) · [Environment Variables](./ENVIRONMENT_VARIABLES.md) · [Production Readiness Checklist](./PRODUCTION_READINESS_CHECKLIST.md)

---

## 1. Architecture overview

| Layer | Mechanism | Notes |
|-------|-----------|-------|
| Server logs | `lib/ops/logger.ts` | JSON lines to stdout → Vercel log drain |
| Error capture | `lib/ops/errorReporting.ts` | Normalizes errors; placeholder hooks for Sentry/Logtail/Axiom |
| App health | `GET /api/health/app` | Process/runtime probe; no secrets |
| DB health | `GET /api/health/supabase` | DB reachability; production-minimal errors |
| Audit trail | `audit_logs` table | Business-level write/access events |
| Client errors | Browser console | No client-side error SaaS in Phase 4W |

---

## 2. Structured logger (`lib/ops/logger.ts`)

### Levels

| Method | When to use |
|--------|-------------|
| `logger.info` | Successful operations, health checks, completion timing |
| `logger.warn` | Degraded state, recoverable failures, rate-limit adjacent issues |
| `logger.error` | Unhandled failures, audit log write failures, 500 paths |
| `logger.debug` | Verbose diagnostics — **suppressed in production** |

### Safe metadata fields

Include where available:

- `route` — API path or server action identifier
- `action` — business action name (e.g. `document_uploaded`)
- `userRole` — `client` | `advisor` | `admin` (never log raw user ids in public tickets)
- `status` — HTTP status or outcome code
- `timingMs` — request duration
- `requestId` — from `X-Request-Id` header or `logger.createRequestId()`

### Automatic redaction

Keys redacted (case-insensitive): `password`, `token`, `access_token`, `refresh_token`, `service_role`, `serviceRole`, `authorization`, `cookie`, and similar.

Values matching JWT, Bearer tokens, or Supabase key patterns are replaced with `[redacted]`.

**Never log:** `SUPABASE_SERVICE_ROLE_KEY`, session cookies, full Authorization headers, or upload file contents.

---

## 3. Error reporting (`lib/ops/errorReporting.ts`)

| Function | Purpose |
|----------|---------|
| `normalizeError(err)` | Stable `{ name, message, stack?, cause? }` shape |
| `publicErrorMessage(err, fallback)` | Safe message for API responses |
| `captureServerError(message, context)` | Logs via `logger.error` with redacted context |

### Future integrations (not implemented)

```typescript
// Sentry — add @sentry/nextjs and uncomment in captureServerError:
// Sentry.captureException(error, { extra: metadata });

// Logtail — stream JSON logs:
// logtail.error(message, metadata);

// Axiom — ingest structured events:
// axiom.ingest('aegis-logs', [{ level: 'error', ...metadata }]);
```

Phase 4W intentionally uses **stdout JSON only** so Vercel log drains remain the single source of truth until a SaaS tool is chosen.

---

## 4. Health endpoints

### `GET /api/health/app`

- **Auth:** None (public probe)
- **Rate limit:** `health` bucket — 20 req/min per IP
- **Response:** `ok`, `status`, `timestamp`, `environment`, `version`, `uptimeSeconds`
- **Secrets:** None exposed

### `GET /api/health/supabase`

- **Auth:** None (public probe)
- **Rate limit:** Same `health` bucket
- **Checks:** Service-role client can query `clients` (limit 1)
- **Production:** Omits raw `error` message on failure
- **Development / preview:** Includes sanitized `error` string for debugging

Both endpoints set `Cache-Control: no-store` and return `X-Request-Id`.

---

## 5. What to monitor (MVP checklist)

### Vercel

- [ ] Deployment build failures
- [ ] Function **5xx** rate spikes
- [ ] Elevated **429** on write routes (possible abuse or tight limits)
- [ ] Cold-start latency on command-center routes
- [ ] Log volume anomalies (possible log spam or retry storm)

### Supabase

- [ ] Auth error rate (invalid login, expired refresh)
- [ ] Postgres connection errors / pool exhaustion
- [ ] Storage upload failures on `client-documents`
- [ ] Disk / quota warnings (dashboard)

### Application signals

- [ ] `/api/health/app` and `/api/health/supabase` failing in synthetic checks
- [ ] `[auditLog]` or audit-related errors in server logs
- [ ] Repeated `captureServerError` for the same `metadata.route`

---

## 6. Log inspection workflows

### Vercel

1. Project → **Logs** → filter `level":"error"`.
2. Group by `metadata.route` to find hot spots.
3. Use deployment time range around a reported incident.

### Supabase

1. **Logs → Postgres** — query failures, timeouts.
2. **Logs → Auth** — signup/login/invite issues.
3. **Logs → Storage** — policy denials, missing bucket.

### Local development

Server logs print JSON to the terminal running `npm run dev`. Use `logger.debug` freely locally; it is muted when `NODE_ENV=production` or `VERCEL_ENV=production`.

---

## 7. Monitoring checklist (weekly / post-deploy)

| Check | Command / location | Pass criteria |
|-------|-------------------|---------------|
| Ops docs present | `npm run ops:check` | All checks green |
| App health | `curl /api/health/app` | `ok: true` |
| DB health | `curl /api/health/supabase` | `ok: true` |
| Smoke tests | `BASE_URL=... npm run qa:smoke` | All pass |
| Error log scan | Vercel Logs | No new recurring 500 pattern |
| Audit sample | [Audit Log Review](./AUDIT_LOG_REVIEW.md) | Writes match expected actions |
| Backup status | Supabase dashboard | Backups enabled / PITR per plan |

---

## 8. Known limitations

- No distributed tracing or APM in Phase 4W.
- No Sentry/Logtail/Axiom wiring — placeholders only.
- In-memory rate limits are not visible as a centralized metric.
- Health endpoints do not validate scoring engine, email delivery, or full RLS matrix — use QA smoke tests for that depth.
