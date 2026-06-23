import { NextResponse } from "next/server";

import { isValidPromotionId, privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { requirePromotionMigrationAdminAccess } from "@/lib/promotions/promotionMigrationAdminAccess";
import {
  parseClassificationBody,
  parseOperatorNote,
} from "@/lib/promotions/promotionMigrationRouteParams";
import { updatePromotionMigrationReview } from "@/lib/promotions/promotionMigrationReviewService";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ promotionId: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requirePromotionMigrationAdminAccess();
    if (!access.allowed) {
      return access.response;
    }

    const { promotionId } = await context.params;
    if (!isValidPromotionId(promotionId)) {
      return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return privatePromotionJson({ ok: false, error: parsed.error }, 400);
    }

    const unexpected = rejectUnexpectedFields(parsed.body, { rejectClientId: true });
    if (unexpected.rejected) {
      return privatePromotionJson({ ok: false, error: unexpected.error }, 400);
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return privatePromotionJson({ ok: false, error: "Request body is required" }, 400);
    }

    const body = parsed.body as Record<string, unknown>;
    const classification = parseClassificationBody(body);
    if (typeof classification === "object" && "error" in classification) {
      return privatePromotionJson({ ok: false, error: classification.error }, 400);
    }

    const operatorNote = parseOperatorNote(body);
    if (operatorNote === undefined && ("operatorNote" in body || "note" in body)) {
      return privatePromotionJson({ ok: false, error: "Invalid operator note" }, 400);
    }

    getRequestMetadata(request);

    const result = await updatePromotionMigrationReview({
      promotionId,
      reviewerUserId: access.userId,
      classification,
      operatorNote,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
      }
      return privatePromotionJson(
        { ok: false, error: "Promotion already migrated" },
        409,
      );
    }

    return privatePromotionJson({ ok: true });
  } catch (err) {
    console.error("[api/admin/promotions-migration/[promotionId]/review PATCH]", err);
    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Failed to save review") },
      500,
    );
  }
}
