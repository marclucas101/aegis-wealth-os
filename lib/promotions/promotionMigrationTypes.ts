import "server-only";

import type { PromotionMigrationClassification } from "./promotionMigrationConstants";
import { PROMOTION_MIGRATION_CLASSIFICATIONS } from "./promotionMigrationConstants";
export {
  PROMOTION_MIGRATION_CLASSIFICATIONS,
  type PromotionMigrationClassification,
};

/** Classifications that may create a governed-content draft when migrated explicitly. */
export const MIGRATION_DRAFT_CLASSIFICATIONS: readonly PromotionMigrationClassification[] = [
  "safe_educational",
  "market_update_review",
  "event",
  "product_promotional",
] as const;

/** Classifications that record review only — no governed draft. */
export const MIGRATION_REVIEW_ONLY_CLASSIFICATIONS: readonly PromotionMigrationClassification[] = [
  "expired",
  "unsuitable",
] as const;

export type PromotionAssetStatus =
  | "no_asset"
  | "existing_governed_reference"
  | "copy_required"
  | "manual_review_required"
  | "unsupported";

export const PROMOTION_ASSET_STATUSES: readonly PromotionAssetStatus[] = [
  "no_asset",
  "existing_governed_reference",
  "copy_required",
  "manual_review_required",
  "unsupported",
] as const;

export type PromotionMigrationListFilter = {
  migrationStatus?: "unmigrated" | "migrated" | "reviewed_no_destination" | "all";
  publicationStatus?: "draft" | "published" | "archived" | "all";
  activeState?: "active" | "expired" | "scheduled" | "all";
  classification?: PromotionMigrationClassification;
  assetStatus?: PromotionAssetStatus;
  adviserUserId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "created_at" | "updated_at" | "title" | "priority";
  sortDir?: "asc" | "desc";
};

export const PROMOTION_MIGRATION_MAX_PAGE_SIZE = 50;
export const PROMOTION_MIGRATION_DEFAULT_PAGE_SIZE = 20;
export const PROMOTION_MIGRATION_MAX_OPERATOR_NOTE = 500;

export const PROMOTION_MIGRATION_LIST_SORT_KEYS = [
  "created_at",
  "updated_at",
  "title",
  "priority",
] as const;

export type PromotionMigrationSortKey = (typeof PROMOTION_MIGRATION_LIST_SORT_KEYS)[number];

export function isMigrationDraftClassification(
  classification: PromotionMigrationClassification,
): boolean {
  return (MIGRATION_DRAFT_CLASSIFICATIONS as readonly string[]).includes(classification);
}

export function sanitizeOperatorNote(note: string | null | undefined): string | null {
  if (!note?.trim()) {
    return null;
  }

  const trimmed = note.trim().replace(/<[^>]+>/g, "").slice(0, PROMOTION_MIGRATION_MAX_OPERATOR_NOTE);
  return trimmed || null;
}
