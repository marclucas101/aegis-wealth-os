# Phase 9E Legacy Promotions Migration

## Strategy

1. **Do not** automatically publish legacy Promotion records as Insights.
2. Admin reviews each record via `GET /api/admin/promotions-migration`.
3. Classification: `safe_educational`, `market_update_review`, `event`, `product_promotional`, `expired`, `unsuitable`.
4. Migration creates `governed_content` as `draft` or `submitted_for_review` only.
5. Tracking table: `promotion_migration_reviews`.

## Retirement plan (Phase 9F)

- Keep `/promotions` and `/advisor/promotions` for compatibility during beta.
- Active clients already blocked via `features.promotions = false`.
- After migration review complete and Insights stable: redirect `/promotions` → `/insights` for active clients.
- Do **not** delete `promotions` table during Phase 9E.

## API

`POST /api/admin/promotions-migration` with `{ promotionId, classification }`.
