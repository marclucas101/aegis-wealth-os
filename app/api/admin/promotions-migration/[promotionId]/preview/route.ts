import { NextResponse } from "next/server";

import { isValidPromotionId, privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { requirePromotionMigrationAdminAccess } from "@/lib/promotions/promotionMigrationAdminAccess";
import {
  parseClassificationBody,
} from "@/lib/promotions/promotionMigrationRouteParams";
import { previewPromotionMigration } from "@/lib/promotions/promotionMigrationReviewService";
import { PROMOTION_MIGRATION_CLASSIFICATIONS } from "@/lib/promotions/promotionMigrationTypes";
import { toPublicErrorMessage, validateEnum } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ promotionId: string }> };

export async function GET(
  request: Request,
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

    const url = new URL(request.url);
    const classificationResult = validateEnum(
      url.searchParams.get("classification") ?? "unsuitable",
      PROMOTION_MIGRATION_CLASSIFICATIONS,
      "classification",
    );
    if (!classificationResult.ok) {
      return privatePromotionJson({ ok: false, error: classificationResult.error }, 400);
    }

    const preview = await previewPromotionMigration({
      promotionId,
      classification: classificationResult.value,
    });

    if (!preview) {
      return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
    }

    return privatePromotionJson({ ok: true, preview });
  } catch (err) {
    console.error("[api/admin/promotions-migration/[promotionId]/preview GET]", err);
    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Failed to generate preview") },
      500,
    );
  }
}

export async function POST(
  request: Request,
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

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const classification = parseClassificationBody(body);
    if (typeof classification === "object" && "error" in classification) {
      return privatePromotionJson({ ok: false, error: classification.error }, 400);
    }

    const preview = await previewPromotionMigration({
      promotionId,
      classification,
    });

    if (!preview) {
      return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
    }

    return privatePromotionJson({ ok: true, preview });
  } catch (err) {
    console.error("[api/admin/promotions-migration/[promotionId]/preview POST]", err);
    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Failed to generate preview") },
      500,
    );
  }
}
