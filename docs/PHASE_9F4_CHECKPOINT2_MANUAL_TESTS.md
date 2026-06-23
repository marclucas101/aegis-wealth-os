# Phase 9F.4 Checkpoint 2 — Manual Tests

Run after applying migration `202606200011` to staging.

## Write freeze (default)

1. Confirm `legacy_promotions_write` is **disabled** in `platform_feature_controls`.
2. As adviser: open `/advisor/promotions` — read-only banner and Governed Communications link visible.
3. Confirm **New promotion** button hidden; list/historical view still loads.
4. `POST /api/advisor/promotions` → 403 `LEGACY_PROMOTIONS_WRITE_DISABLED`.
5. `PATCH` publish/archive on own promotion → 403 with same code.
6. `POST` upload on own promotion → 403.
7. Audit log contains `legacy_promotion_write_blocked` (no body in metadata).

## Ownership (enable write temporarily in staging only)

8. As adviser A: `GET` adviser B promotion by ID → 404.
9. As adviser A: `PATCH` adviser B promotion → 404.
10. As adviser A: upload to B promotion → 404.
11. As adviser A: list promotions — only own rows.
12. As admin: list promotions — all rows.

## Client entitlement

13. As authenticated client: `GET /api/promotions` → `{ ok: true, promotions: [] }` (dormant).
14. Confirm response has `Cache-Control: private, no-store`.
15. As unauthenticated: `GET /api/promotions` → 401.

## Admin migration

16. As non-admin: `GET/POST /api/admin/promotions-migration` → 403.
17. As admin with `admin_content_approval`: `GET` lists unmigrated promotions.
18. `POST` with valid `promotionId` + classification → governed draft or skip record.
19. Repeat same `POST` → idempotent (`alreadyMigrated` or same content ID).
20. Invalid `promotionId` / classification → 400.

## Rollback drill

21. Enable `legacy_promotions_write` via admin feature controls.
22. Confirm adviser mutations succeed for **own** promotions only.
23. Disable flag again — read-only restored without data loss.

## Phase 9F.3 regression

24. Binder export generate/publish/withdraw still works for assigned clients.
25. Insights feed unaffected.
