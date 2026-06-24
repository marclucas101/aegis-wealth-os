# Phase 10 — Production Operations Audit

**Checkpoint:** 10.1 Discovery  
**Branch:** `phase-10-product-roadmap-discovery`  
**Date:** 2026-06-24  

---

## Summary

AEGIS has **documented ops scaffolding** (`docs/MONITORING_AND_LOGGING.md`, `docs/OPERATIONS_RUNBOOK.md`, health routes, `lib/ops/logger.ts`) but **shallow adoption** in application code. No external APM vendor is wired. Scaling beyond the current user base requires closing observability and operator-surface gaps — preferably via Track F enhancements bundled with Track A ops panels.

**Phase 9F.4 observation:** 30-day observation period active per `docs/PHASE_9F4_OBSERVATION_PLAN.md`. No schema retirement during observation.

---

## Application error capture

| Component | Status | Evidence |
|-----------|--------|----------|
| `lib/ops/errorReporting.ts` | Exists | `captureServerError`, `publicErrorMessage` |
| `lib/security/apiGuards.ts` | Duplicate | `toPublicErrorMessage` — parallel allowlist |
| API route adoption | **Poor** | ~120 routes use `console.error`; `captureServerError` only in health/supabase |
| Client error boundaries | Basic | `app/error.tsx` — console only |
| Audit log failures | Silent | `auditLog.ts` swallows throws, console.error only |

**Gap:** Production error grouping by route will not work for most failures.

---

## Structured logs and request IDs

| Component | Status |
|-----------|--------|
| `lib/ops/logger.ts` | JSON stdout, redaction, debug suppressed in prod |
| Health routes | Use logger + `X-Request-Id` |
| Binder generation | Partial structured logging |
| Majority of API routes | Unstructured console.error |

---

## Failed background / scheduled work

| Job | Persistence | Cron | Failure visibility |
|-----|-------------|------|-------------------|
| Scheduled publishing | `automation_job_runs`, `automation_job_items` | **Not in vercel.json** — manual/external | Admin UI last 50 runs |
| Birthday reminders | None | `vercel.json` daily 01:00 UTC | Response JSON counts only |
| Communication delivery | `communication_deliveries` | Event-driven | Admin API — no UI |
| Binder PDF generation | `binder_exports` status | On-demand | Per-client panel |

**Gap:** Job failures not emitted to structured logger; scheduled publishing relies on operator cron setup.

---

## Email / PDF / storage / notification failures

| Area | Handling | Gap |
|------|----------|-----|
| Email delivery | Status in `communication_deliveries` | No alert on spike; admin UI absent |
| PDF generation | Binder export status + logging | No book-level failure queue |
| Storage | Signed URL errors per request | No aggregate monitoring |
| Appointment notifications | Retry endpoint | Manual adviser retry |
| Client lifecycle notifications | Idempotent inserts | Failures in service — audit only |

---

## Audit review

- **Write path:** Extensive `writeAuditLog()` across routes
- **Read path:** Manual SQL only (`docs/AUDIT_LOG_REVIEW.md`)
- **Gap:** No admin audit viewer; analytics events may be lost silently

---

## Feature-control state

| Aspect | Detail |
|--------|--------|
| Storage | `platform_feature_controls` + defaults in `featureFlags.ts` |
| API | `/api/admin/feature-controls` |
| UI | **None** |
| Cache | 30s in-memory; fail-closed on DB error |
| Risk | Operators must use API/SQL for emergency toggles |

Critical defaults off: `binder_client_publication`, `raw_client_financial_views`, `scheduled_content_automation`, `legacy_promotions_write`.

---

## Support diagnostics

| Tool | Access | Depth |
|------|--------|-------|
| `/supabase-health` | Authenticated | DB connectivity |
| `/api/health/app` | Rate-limited | Process uptime only |
| `/api/health/supabase` | Rate-limited | clients limit 1 probe |
| `/api/me` | Session debug | Auth state |
| `/api/debug/*` | Should be restricted in prod | Cookie tests |
| `npm run ops:check` | File presence | No live HTTP |
| `npm run final:check` | Docs/scripts | No build/test |

**Gap:** Smoke tests hit `/api/health/supabase` but not `/api/health/app`.

---

## Health checks

- App health: shallow by design
- Supabase health: single-table probe
- No scoring, email, or RLS matrix probes (documented as future)

---

## Backup and recovery documentation

| Document | Content |
|----------|---------|
| `docs/OPERATIONS_RUNBOOK.md` | Incident response outline |
| `docs/DEPLOYMENT_VERCEL_SUPABASE.md` | Deploy steps |
| `docs/INCIDENT_RESPONSE.md` | Escalation |
| `docs/PHASE_9F3_INCIDENT_RESPONSE.md` | Binder-specific |

**Gap:** On-call contacts table unfilled in runbook; backup restore drill frequency not verified in repo.

---

## Vercel and Supabase operational runbooks

- Vercel: `vercel.json` crons (birthday only), env vars in `docs/ENVIRONMENT_VARIABLES.md`
- Supabase: `docs/SUPABASE_MIGRATION_OPERATOR_CHECKLIST.md`, migration reconciliation docs
- **No observability vendor** introduced in this checkpoint (per restrictions)

---

## Scaling blockers

| Blocker | Severity | Track |
|---------|----------|-------|
| Unstructured errors in most routes | High | F |
| No operator feature-control UI | High | F |
| Scheduled publishing cron gap | Medium | F |
| No delivery failure dashboard | Medium | F |
| Audit log read surface absent | Medium | F |
| In-memory rate limits (per instance) | Medium | Defer |
| No external log aggregation | Medium | F (without new vendor — stdout drain optional) |

---

## Phase 10 production ops recommendation

Bundle **minimal ops hardening** into the selected Track A implementation:

1. Admin read-only **ops panel** for feature flags, job runs, delivery failures (reuse existing APIs).
2. Adopt `logger` + `captureServerError` in new queue APIs only — defer repo-wide migration.
3. Add scheduled publishing to `vercel.json` when operator approves automation enablement.
4. Document weekly audit SQL cadence for 9F.4 observation + queue metrics.

Full **Track F** as standalone phase is valid but **does not close adviser workflow gap** — defer as parallel hardening stream within Phase 10 checkpoints 10.6–10.7.
