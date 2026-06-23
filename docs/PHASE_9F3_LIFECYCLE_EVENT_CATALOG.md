# Phase 9F.3 Lifecycle Event Catalog (Binder)

Binder publication integrates with the Phase 9F.2 fixed event registry.

## Events used

| Event | When | Source entity | Notification |
|-------|------|---------------|--------------|
| `available` | First publication of binder document to client vault | `document` | In-app (`document_uploaded` type) |
| `superseded` | Newer version published in same lineage | `document` (prior) | In-app |
| `withdrawn` | Adviser withdrawal | `document` | In-app |
| `downloaded` | Client opens signed URL | `document` | Audit-only |

## Not used for binders

- `action_required` — not overloaded for availability
- `replaced` — protection-report pattern only

## Policy gates

- `document_event_notifications` must be enabled for in-app delivery
- `client_in_app_notifications` required for persistence
- Publication/withdrawal commits even if notification fails (`binder_lifecycle_notification_failed` audit)

## Payload rules

Generic copy only. Destination: `/document-vault` (allowlisted). No PDF titles, paths, or financial data in metadata.

See also `docs/PHASE_9F2_EVENT_CATALOG.md`.
