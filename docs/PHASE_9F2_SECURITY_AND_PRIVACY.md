# Phase 9F.2 Security and Privacy

## Payload restrictions

Lifecycle notifications never include:

- Document bodies or filenames in notification text
- Financial values, policy details, or health data
- Identity numbers or recipient email addresses
- Provider responses or raw database errors
- Signed or long-lived storage URLs
- Internal review or compliance notes

Only generic title/summary strings and allowlisted `metadata.destinationRoute` are persisted.

## Authorization

- Notification creation is server-side only (service role)
- Client `GET /api/client/notifications` scoped to authenticated client
- `PATCH` mark-read requires matching `client_id`
- No public endpoint to send arbitrary notifications
- Recipient IDs are never accepted from browser payloads

## Metadata schema

Allowlisted keys per event (see `lifecycleNotificationPolicy.ts`):

- `destinationRoute` — must match internal allowlist
- `successorReferenceId` — UUID reference only (supersede)

## Injection controls

- External URLs rejected in metadata and summary text
- HTML/script patterns rejected
- Client UI renders title/summary as plain text only (no arbitrary HTML)
- Navigation uses internal allowlisted routes only

## Idempotency keys

Keys encode event, entity type, entity ID, recipient, version, and channel. They contain no PII or financial data.

## Logging

Lifecycle failures write sanitized audit actions. Provider errors and recipient emails are not logged in notification flows.

## RLS

`client_notifications` RLS unchanged — clients access own rows via API service-role enforcement. New columns are non-sensitive operational metadata.

## Stale destinations

Notifications remain in history. Opening reauthorizes via portal routes; UI shows safe unavailable copy when destination cannot be resolved.
