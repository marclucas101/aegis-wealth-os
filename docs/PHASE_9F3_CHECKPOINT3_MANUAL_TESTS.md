# Phase 9F.3 Checkpoint 3 — Manual Tests

Prerequisites: migration `202606200010` applied in staging; `binder_export` and `binder_client_publication` enabled; test client with ready binder.

## Publication

1. Publish ready binder with `confirm: true` — expect `published_to_client`, document in vault list.
2. Retry identical publish — `reused: true`.
3. Publish without confirm — `BINDER_CONFIRMATION_REQUIRED`.
4. Publish failed/non-ready binder — rejected.
5. Publish with `binder_client_publication` disabled — 403.
6. Cross-client binder ID — 403.

## Supersession

7. Publish newer version in same lineage — prior withdrawn, prior document hidden, new document visible.
8. Unrelated lineage binder — prior lineage publication unaffected.

## Withdrawal

9. Withdraw published binder — client list hides document; signed URL unavailable.
10. Repeat withdraw — idempotent `reused: true`.
11. Invalid withdrawal reason — 400.

## Client access

12. Client sees published binder in document vault with `advisor_binder_export` source.
13. Client signed URL opens PDF.
14. After withdrawal — "This document is no longer available."
15. Stale notification link — same safe unavailable (no adviser details).

## Adviser UI

16. Meeting Packs tab lists versions with correct labels.
17. Publish requires confirmation dialog.
18. Controls disabled while request active.
19. Download does not trigger publish.

## Audit

20. `binder_published_to_client`, `binder_withdrawn_from_client`, `binder_client_downloaded` — no storage paths in metadata.
