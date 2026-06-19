# Phase 9E Document Notification Policy

## Events

| Event | Client notification | Condition |
|-------|---------------------|-----------|
| `uploaded` | `document_uploaded` | Client-visible document |
| `published_to_client` | `document_uploaded` | `client_visible` tag |
| `replaced` | `document_replaced` | Client-visible |
| `removed` / `withdrawn` | `document_removed` | Was client-visible |
| `action_required` | `document_action_required` | Client-visible |
| `downloaded` | None | Audit only |

## Rules

1. Internal documents (no `client_visible` tag for prospects; adviser-only uploads) do **not** generate client notifications.
2. Notification text does not reveal inaccessible filenames, categories, or financial data.
3. Document removal immediately removes future access; signed URLs retain short expiry (300s).
4. Audit history is never deleted when a file is removed.
5. Controlled by `document_event_notifications` feature flag.

## Implementation

`lib/communications/documentEventNotifications.ts` — called from document upload/delete API routes.
