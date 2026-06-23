# Phase 9F.2 Notification Architecture

## Overview

Phase 9F.2 implements the six deferred document/publication lifecycle notification hooks from Phase 9E through a single governed service layer. Notifications are server-side only, privacy-safe, idempotent, and fail-safe relative to authoritative lifecycle transitions.

## Components

| Module | Responsibility |
|--------|----------------|
| `lifecycleNotificationTypes.ts` | Fixed union of six approved event names |
| `lifecycleNotificationPolicy.ts` | Per-event recipient/channel/title/idempotency policy |
| `lifecycleNotificationPayload.ts` | Metadata allowlist, destination allowlist, text sanitization |
| `lifecycleNotificationRecipients.ts` | Server-side recipient resolution (fail-closed) |
| `lifecycleNotificationPersistence.ts` | Idempotent notification insert |
| `lifecycleNotificationService.ts` | Central `emitLifecycleNotification` orchestration |
| `documentEventNotifications.ts` | Backward-compatible delegate for document routes |
| `publicationDelivery.ts` | Unchanged governed-content publish path (Phase 9E/9F.1) |

## Event flow

```
Authoritative lifecycle mutation (service layer)
        │
        ▼
emitLifecycleNotification / emitLifecycleNotificationSafe
        │
        ├─ Feature gates (document_event_notifications, client_in_app_notifications)
        ├─ Recipient resolution (client active, audience, visibility)
        ├─ Policy copy (generic title/summary only)
        ├─ Idempotent persistence (idempotency_key + legacy unique index)
        └─ Audit log (created / skipped / failed)
```

## Failure semantics

| Scenario | Behavior |
|----------|----------|
| Lifecycle succeeds, notification fails | Lifecycle state retained; audit `lifecycle_notification_failed`; safe retry |
| Duplicate invocation | `skipped_duplicate`; no second row |
| Recipient ineligible | `skipped_ineligible`; sanitized audit reason |
| Email unavailable | N/A for lifecycle document events (in-app only) |
| Downloaded event | Audit log only (`audit_only`); no in-app row |

## Feature control

Reuses `document_event_notifications`. No separate `document_lifecycle_notifications` flag.

## Integration points

- Document vault: upload, delete, signed URL, protection report replacement
- Publication workflow: supersede, withdraw `published_outputs`
- Governed content: withdraw/supersede via `contentWorkflow.withdrawContent`
- Review submissions: adviser task completion → `action_completed`

Manual and scheduled publication continue to use `deliverPublicationNotifications` for new insight delivery; lifecycle hooks fire on withdrawal/supersession outcomes.
