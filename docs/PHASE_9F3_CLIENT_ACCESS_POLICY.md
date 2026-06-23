# Phase 9F.3 Client Access Policy

## Principle

Clients access published binders **only** through the document vault — never direct `binder_exports` or storage enumeration.

## Visibility

| State | Client list | Signed URL |
|-------|-------------|------------|
| Unpublished (ready) | Hidden | Denied |
| Published to client | Visible | Allowed (if not withdrawn) |
| Withdrawn | Hidden (archived document) | Denied — safe unavailable message |
| Superseded | Hidden (prior document archived) | Denied |

## Authorization

- Session-scoped client profile (`ensureUserClientProfile`)
- `documents.client_id` must match session client
- `assertBinderDocumentClientAccessible()` verifies linked binder row
- Binder/document ID possession does not bypass ownership

## Response hygiene

Client APIs omit: storage bucket, storage path, content hash, lineage internals, audit metadata.

## Stale notifications

Notifications may reference withdrawn/superseded documents. Opening the destination reauthorizes access and returns a generic unavailable state without adviser-only details.

## Feature-disabled behavior

When `binder_client_publication` is disabled:

- New publish/withdraw blocked
- Existing published binders remain readable until withdrawn
