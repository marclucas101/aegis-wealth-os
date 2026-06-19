# Phase 9E Approval Workflow

## Lifecycle

```
draft → submitted_for_review → approved | changes_requested | rejected
approved → scheduled | published
published → expired | withdrawn
```

## Rules

| Rule | Implementation |
|------|----------------|
| Adviser may draft permitted content | `POST /api/advisor/insights` |
| Adviser may submit for review | `POST /api/advisor/insights/[id]/submit` |
| Admin approves/rejects/requests changes | `/api/admin/communications/[id]/*` |
| Author cannot self-approve | `approveContent()` checks `approverUserId !== authorUserId` |
| Published content cannot be silently edited | `createContentEditVersion()` creates new version |
| Withdrawn content hidden from feed | `isPublishedAndCurrent()` + `withdrawn_at` |
| Expired content not current | `expires_at` check |
| Idempotent publish | `publishContent()` returns existing if already published |
| Audit every transition | `writeAuditLog` in `contentWorkflow.ts` |

## Approval role

Until a dedicated compliance role exists, **admins** act as content approvers via `/admin/communications`. A future compliance role may replace this without schema changes.

## Scheduling (Phase 9E)

Phase 9E does **not** include a background scheduler or cron worker. When `scheduled_at` is in the future, content moves to `scheduled` status and remains **invisible** to clients until an admin calls publish again after the scheduled time (manual activation). This avoids a misleading non-functional scheduling state.

Legal transitions are enforced in `lib/communications/contentLifecycle.ts`.
