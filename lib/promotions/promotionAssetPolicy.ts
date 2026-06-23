import "server-only";

import type { PromotionAssetStatus } from "./promotionMigrationTypes";

export type PromotionAssetSource = {
  imagePath: string | null;
  attachmentPath: string | null;
};

export function classifyPromotionAssetStatus(
  source: PromotionAssetSource,
): PromotionAssetStatus {
  const hasImage = Boolean(source.imagePath?.trim());
  const hasAttachment = Boolean(source.attachmentPath?.trim());

  if (!hasImage && !hasAttachment) {
    return "no_asset";
  }

  // Checkpoint 3: no secure asset-copy helper — legacy bucket paths require manual review.
  if (hasImage && hasAttachment) {
    return "manual_review_required";
  }

  if (hasAttachment) {
    return "unsupported";
  }

  return "manual_review_required";
}

export function migrationBlockedByAssetPolicy(assetStatus: PromotionAssetStatus): boolean {
  return assetStatus !== "no_asset";
}

export function assetBlockMessage(assetStatus: PromotionAssetStatus): string {
  switch (assetStatus) {
    case "manual_review_required":
      return "This promotion has legacy assets that require manual review before migration. Classify as unsuitable or migrate content manually after asset handling.";
    case "copy_required":
      return "Asset copy is required but not available in this checkpoint.";
    case "unsupported":
      return "Attachment assets are not supported for automatic migration in this checkpoint.";
    case "existing_governed_reference":
      return "Asset reference cannot be migrated automatically.";
    default:
      return "Migration blocked by asset policy.";
  }
}
