# Phase 9E Document Notification Policy

## Implemented (Phase 9E)

| Event | Client notification | Route / trigger |
|-------|---------------------|-----------------|
| `uploaded` | `document_uploaded` | `POST /api/documents/upload` |
| `published_to_client` | `document_uploaded` | Adviser upload when client is active-client stage |
| `removed` | `document_removed` | `POST /api/documents/delete` |

## Deferred (post–Phase 9E)

| Event | Status |
|-------|--------|
| `replaced` | Type defined; hook not wired to replacement flow |
| `superseded` | Deferred |
| `withdrawn` | Deferred (access revocation via archive still enforced) |
| `action_required` | Deferred |
| `action_completed` | Deferred |
| `downloaded` | Audit-only deferred |

## Rules (all events)

1. Internal documents do not generate client notifications (`isClientVisible` gate).
2. Notification text is generic — no filenames, categories, or financial data.
3. Idempotent creation via `client_id + notification_type + reference_type + reference_id` unique index.
4. Signed URLs retain short expiry (300s client / 120s vault policy).
5. Document deletion does not delete audit history.
