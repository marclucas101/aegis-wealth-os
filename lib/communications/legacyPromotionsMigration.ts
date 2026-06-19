import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { dbCreateGovernedContent } from "@/lib/supabase/governedContentPersistence";

import { categoryToContentType } from "./contentValidation";
import type { GovernedContentCategory, PromotionMigrationClassification } from "./types";

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

export async function migratePromotionToDraft(input: {
  promotionId: string;
  reviewerUserId: string;
  classification: PromotionMigrationClassification;
}): Promise<{ contentId: string | null; skipped: boolean }> {
  if (input.classification === "unsuitable" || input.classification === "expired") {
    const admin = createAdminSupabaseClient();
    await admin.from("promotion_migration_reviews").upsert({
      promotion_id: input.promotionId,
      classification: input.classification,
      reviewed_by_user_id: input.reviewerUserId,
      reviewed_at: new Date().toISOString(),
      notes: "Skipped — not suitable for automatic migration",
    } as never);

    return { contentId: null, skipped: true };
  }

  const admin = createAdminSupabaseClient();
  const { data: promo, error } = await admin
    .from("promotions")
    .select("*")
    .eq("id", input.promotionId)
    .maybeSingle();

  if (error || !promo) {
    throw new Error("Promotion not found");
  }

  const row = promo as PromotionRow;
  const category: GovernedContentCategory =
    input.classification === "market_update_review"
      ? "market_update"
      : input.classification === "event"
        ? "event"
        : "financial_education";

  const contentType = categoryToContentType(category);
  const approvalStatus =
    input.classification === "safe_educational" ? "draft" : "submitted_for_review";

  const content = await dbCreateGovernedContent({
    title: row.title,
    summary: row.summary,
    body: "",
    category,
    contentType,
    audienceScope: "all_active_clients",
    externalUrl: row.cta_url,
    authorUserId: input.reviewerUserId,
    adviserUserId: row.created_by,
    approvalStatus,
    expiresAt: row.ends_at,
  });

  await admin.from("promotion_migration_reviews").upsert({
    promotion_id: input.promotionId,
    classification: input.classification,
    migrated_content_id: content.id,
    reviewed_by_user_id: input.reviewerUserId,
    reviewed_at: new Date().toISOString(),
  } as never);

  await writeAuditLog({
    userId: input.reviewerUserId,
    action: "promotion_migration_draft_created",
    entityType: "promotion",
    entityId: input.promotionId,
    metadata: { contentId: content.id, classification: input.classification },
  });

  return { contentId: content.id, skipped: false };
}

export async function listUnmigratedPromotions(): Promise<PromotionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data: reviews } = await admin
    .from("promotion_migration_reviews")
    .select("promotion_id");

  const migratedIds = new Set((reviews ?? []).map((r) => (r as { promotion_id: string }).promotion_id));

  const { data, error } = await admin.from("promotions").select("*").order("created_at");

  if (error) {
    throw new Error(`Failed to list promotions: ${error.message}`);
  }

  return ((data ?? []) as PromotionRow[]).filter((p) => !migratedIds.has(p.id));
}
