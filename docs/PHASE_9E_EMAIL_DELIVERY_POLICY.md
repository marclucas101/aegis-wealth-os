# Phase 9E Email Delivery Policy

## Provider

Reuses `lib/email/emailProvider.ts` — Resend in production, console dev adapter otherwise. No Resend credentials required for dev/staging.

## Delivery states

`pending`, `sent`, `failed`, `retrying`, `suppressed_by_preference`, `skipped_no_email`, `cancelled_withdrawn`

## Rules

1. Email send failure does **not** roll back content publication or document events.
2. Retries use the same `communication_deliveries` record (`retryFailedDelivery()`).
3. Retries are idempotent — already-sent deliveries return early.
4. Client email loaded from authoritative server data (`clients` → `users.email`).
5. Browser cannot provide recipient address.
6. Email contains minimal sensitive information; links back to Aurelis portal.
7. Provider secrets/errors sanitized in audit metadata.
8. Withdrawal cancels pending deliveries (`dbCancelPendingDeliveriesForContent`).
9. Disabling `client_email_notifications` retains in-app notifications.

## Records

Table: `communication_deliveries`. Clients cannot read provider metadata.
