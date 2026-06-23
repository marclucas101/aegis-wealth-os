# Phase 9F.2 Event Catalog

All implemented lifecycle events. Event names are fixed in `LIFECYCLE_EVENT_NAMES` and cannot be supplied by API clients.

## 0. `available` (Phase 9F.3 binder)

| Field | Value |
|-------|-------|
| Source entities | `document` |
| Recipients | Active client |
| In-app | Yes (`document_uploaded`) |
| Email | No |
| Trigger | `publishBinderToClient` — first binder vault publication |
| Idempotency | `available:document:{docId}:{clientId}:{version}:in_app` |

## 1. `replaced`

| Field | Value |
|-------|-------|
| Source entities | `document` |
| Recipients | Active client assigned to vault |
| In-app | Yes (`document_replaced`) |
| Email | No |
| Trigger | `uploadAdvisorProtectionReport` archives prior protection summaries |
| Idempotency | `replaced:document:{docId}:{clientId}:{transitionAt}:in_app` |

## 2. `superseded`

| Field | Value |
|-------|-------|
| Source entities | `published_output`, `governed_content` |
| Recipients | Client(s) in publication audience |
| In-app | Yes (`document_replaced`) |
| Email | No |
| Trigger | `publishOutput` supersedes prior output; `publishContent` withdraws superseded parent |
| Idempotency | `superseded:{entityType}:{entityId}:{clientId}:{transitionAt}:in_app` |

## 3. `withdrawn`

| Field | Value |
|-------|-------|
| Source entities | `document`, `governed_content`, `published_output` |
| Recipients | Assigned / audience-resolved clients |
| In-app | Yes (`document_removed`) |
| Email | No (pending insight emails cancelled separately) |
| Trigger | `withdrawOutput`, `withdrawContent`, `deleteAdvisorClientDocument`, client self-delete via `removed` delegate |
| Idempotency | `withdrawn:{entityType}:{entityId}:{clientId}:{transitionAt}:in_app` |

## 4. `action_required`

| Field | Value |
|-------|-------|
| Source entities | `document`, `client_review_submission` |
| Recipients | Active client |
| In-app | Yes (`document_action_required`) |
| Email | No |
| Trigger | Adviser upload with `requires_client_action`; `requestClientReviewAction` |
| Idempotency | `action_required:{entityType}:{entityId}:{clientId}:{transitionAt}:in_app` |

## 5. `action_completed`

| Field | Value |
|-------|-------|
| Source entities | `client_review_submission` |
| Recipients | Submitting client |
| In-app | Yes (`review_requested` type, title "Review complete") |
| Email | No |
| Trigger | `completeClientReviewSubmission` via adviser review task completion |
| Idempotency | `action_completed:client_review_submission:{submissionId}:{clientId}:reviewed:in_app` |

## 6. `downloaded`

| Field | Value |
|-------|-------|
| Source entities | `document` |
| Recipients | N/A (audit only) |
| In-app | No |
| Email | No |
| Trigger | `createDocumentSignedUrl` after access validation |
| Idempotency | `downloaded:document:{docId}:{clientUserId}:{date}:audit` |

## Allowed destinations (in-app metadata)

- `/document-vault`
- `/insights`
- `/goals-reviews`
- `/dashboard`
