# Phase 9E Manual Acceptance Tests

## Client Insights feed

1. Sign in as active client with `insights_and_updates` enabled.
2. Navigate to `/insights` — verify feed loads from API (empty or populated).
3. Verify no approval metadata, rejection notes, or targeting information visible.
4. Verify external links show third-party disclaimer and `rel="noopener noreferrer"`.
5. Verify inactive client cannot access insights (403).

## Adviser authoring

1. Sign in as adviser — navigate to `/advisor/insights`.
2. Create draft with category, title, summary, plain-text body.
3. Submit for review — status becomes `submitted_for_review`.
4. Verify adviser cannot approve own content (admin API returns error if same user).
5. Attempt to target unassigned client in `selected_clients` — rejected.

## Admin governance

1. Sign in as admin — navigate to `/admin/communications`.
2. Approve submitted content, then publish.
3. Reject with reason — verify reason required.
4. Request changes with reason.
5. Withdraw published content — verify it disappears from client feed.
6. Inspect delivery status at `/api/admin/communication-deliveries`.

## Notifications & preferences

1. Client receives in-app notification after insight published.
2. Client marks notification read via PATCH.
3. Client updates communication preferences — verify audit log.
4. Disable email preference — verify delivery status `suppressed_by_preference`.

## Document events

1. Adviser uploads client-visible document — client receives notification.
2. Internal document upload — no client notification.
3. Client deletes document — notification created.

## Binder export

1. Adviser generates binder for assigned client.
2. Verify binder is adviser-internal (not in client vault).
3. Unassigned client — export rejected.

## Legacy Promotions

1. Verify `/promotions` not in active client nav.
2. Run admin migration tool — items enter as draft/review only.

## Feature controls

1. Disable `insights_and_updates` — client feed empty/403.
2. Disable `product_related_content` — promotional drafts rejected.
3. Disable email — in-app notifications still work.

## Regression

1. Phase 9D portal pages load (dashboard, my-plan, roadmap).
2. Phase 9C Meeting Studio remains adviser-only.
3. Phase 9B prospect journey functional.
