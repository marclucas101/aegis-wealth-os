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

## Concurrency

Updates use single-row `UPDATE ... WHERE id` via service role. Version increments on supersede create new rows rather than mutating published rows.
