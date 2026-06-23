# Phase 9F.2 Manual Acceptance Tests

## Publication lifecycle

1. Publish a governed insight to a test client (manual admin publish). Confirm `new_insight` notification.
2. Withdraw the same content. Confirm single `withdrawn` lifecycle notification per client; no duplicate on retry.
3. Publish a superseding version. Confirm superseded notification for old version and publish notification for new.

## Published outputs

4. Publish financial overview for active client. Supersede with newer output. Confirm superseded notification.
5. Withdraw published output. Confirm withdrawn notification; portal shows safe unavailable when opened.

## Document vault

6. Save protection report twice for same client. Confirm `replaced` notification for archived report (not duplicate upload notification).
7. Adviser deletes client-visible document. Confirm withdrawn notification.
8. Client deletes own document. Confirm withdrawn-style notification (via removed delegate).

## Action workflows

9. Adviser uploads document with `requires_client_action=true`. Confirm action required notification.
10. Client submits goals review; adviser completes linked review task. Confirm action completed notification.

## Download audit

11. Client opens document signed URL. Confirm audit log `document_downloaded`; no in-app notification row.

## Idempotency

12. Repeat withdraw API call. Confirm no duplicate notification.
13. Retry scheduled publication job for already-published content. Confirm no duplicate lifecycle rows.

## Preferences and flags

14. Disable `client_in_app_notifications`. Confirm lifecycle hooks skip in-app creation.
15. Disable `document_event_notifications`. Confirm no new lifecycle notifications; lifecycle mutations still succeed.

## UI

16. Open Insights page. Confirm notifications panel shows title, summary, time, unread badge.
17. Mark notification read. Confirm unread state clears.
18. Open notification for withdrawn content. Confirm safe unavailable message if applicable.

## Privacy

19. Inspect API `GET /api/client/notifications` response. Confirm no raw metadata blob, emails, or storage paths.
20. Inspect notification row in DB. Confirm generic summary only.
