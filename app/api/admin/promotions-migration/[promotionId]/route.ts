import { NextResponse } from "next/server";

import { isValidPromotionId, privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { requirePromotionMigrationAdminAccess } from "@/lib/promotions/promotionMigrationAdminAccess";
import { getPromotionMigrationDetail } from "@/lib/promotions/promotionMigrationReviewService";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ promotionId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requirePromotionMigrationAdminAccess();
    if (!access.allowed) {
      return access.response;
    }

    const { promotionId } = await context.params;
    if (!isValidPromotionId(promotionId)) {
      return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
    }

    const detail = await getPromotionMigrationDetail(promotionId);
    if (!detail) {
      return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
    }

    return privatePromotionJson({ ok: true, promotion: detail });
  } catch (err) {
    console.error("[api/admin/promotions-migration/[promotionId] GET]", err);
    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load promotion") },
      500,
    );
  }
}
