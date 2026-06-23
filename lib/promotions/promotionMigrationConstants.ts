/** Client-safe promotion migration classification allowlist (shared with server). */

export const PROMOTION_MIGRATION_CLASSIFICATIONS = [
  "safe_educational",
  "market_update_review",
  "event",
  "product_promotional",
  "expired",
  "unsuitable",
] as const;

export type PromotionMigrationClassification =
  (typeof PROMOTION_MIGRATION_CLASSIFICATIONS)[number];
