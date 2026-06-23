import "server-only";

import type { PromotionMigrationClassification } from "./types";

type PromotionRow = {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  cta_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
};

export function classifyPromotion(promo: PromotionRow): PromotionMigrationClassification {
  if (promo.status === "archived") {
    return "expired";
  }

  if (promo.ends_at && new Date(promo.ends_at) < new Date()) {
    return "expired";
  }

  const cat = promo.category.toLowerCase();
  if (cat.includes("product") || cat.includes("promo") || cat.includes("offer")) {
    return "product_promotional";
  }
  if (cat.includes("market") || cat.includes("economic")) {
    return "market_update_review";
  }
  if (cat.includes("event")) {
    return "event";
  }
  if (cat.includes("education") || cat.includes("insight")) {
    return "safe_educational";
  }

  return "unsuitable";
}

export {
  executePromotionMigration as migratePromotionToDraft,
  listPromotionMigrationRecords,
} from "@/lib/promotions/promotionMigrationReviewService";

/** @deprecated Use listPromotionMigrationRecords */
export async function listUnmigratedPromotions() {
  const { listPromotionMigrationRecords } = await import(
    "@/lib/promotions/promotionMigrationReviewService"
  );
  const result = await listPromotionMigrationRecords({
    migrationStatus: "unmigrated",
    pageSize: 500,
  });
  return result.promotions.map((item) => ({
    id: item.id,
    title: item.title,
    summary: "",
    category: "",
    status: item.publicationStatus,
    cta_url: null,
    starts_at: null,
    ends_at: null,
    created_by: item.ownerAdviserUserId,
  }));
}
