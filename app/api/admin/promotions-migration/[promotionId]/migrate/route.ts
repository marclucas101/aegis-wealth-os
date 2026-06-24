import { NextResponse } from "next/server";

import { isValidPromotionId, privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { requirePromotionMigrationAdminAccess } from "@/lib/promotions/promotionMigrationAdminAccess";
import {
  parseClassificationBody,
  parseOperatorNote,
} from "@/lib/promotions/promotionMigrationRouteParams";
import { executePromotionMigration } from "@/lib/promotions/promotionMigrationReviewService";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ promotionId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const metadata = getRequestMetadata(request);

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

    await writeAuditLog({
      userId: access.userId,
      action: "legacy_promotion_migration_started",
      entityType: "promotion",
      entityId: promotionId,
      metadata: {
        promotion_id: promotionId,
        adviser_user_id: access.userId,
        action_type: "migrate_to_draft",
        result_code: "started",
        classification,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    const result = await executePromotionMigration({
      promotionId,
      reviewerUserId: access.userId,
      classification,
      operatorNote,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
      }
      if (result.reason === "asset_blocked") {
        await writeAuditLog({
          userId: access.userId,
          action: "legacy_promotion_migration_failed",
          entityType: "promotion",
          entityId: promotionId,
          metadata: {
            promotion_id: promotionId,
            adviser_user_id: access.userId,
            action_type: "migrate_to_draft",
            result_code: "LEGACY_PROMOTION_ASSET_BLOCKED",
            classification,
          },
          ipAddress: metadata.ip_address,
          userAgent: metadata.user_agent,
        });

        return privatePromotionJson(
          {
            ok: false,
            error: {
              code: "LEGACY_PROMOTION_ASSET_BLOCKED",
              message: result.message ?? "Migration blocked by asset policy",
            },
          },
          409,
        );
      }
      if (result.reason === "conflict") {
        return privatePromotionJson(
          {
            ok: false,
            error: {
              code: "LEGACY_PROMOTION_MIGRATION_CONFLICT",
              message: result.message ?? "Migration linkage conflict",
            },
            outcome: result.outcome,
            contentId: result.contentId ?? null,
          },
          409,
        );
      }
      if (result.reason === "failed") {
        return privatePromotionJson(
          {
            ok: false,
            error: {
              code: "LEGACY_PROMOTION_MIGRATION_FAILED",
              message: result.message ?? "Migration failed",
            },
            outcome: result.outcome,
          },
          500,
        );
      }
      return privatePromotionJson({ ok: false, error: "Migration not allowed" }, 400);
    }

    return privatePromotionJson(result);
  } catch (err) {
    console.error("[api/admin/promotions-migration/[promotionId]/migrate POST]", err);

    try {
      const access = await requirePromotionMigrationAdminAccess();
      if (access.allowed) {
        const { promotionId } = await context.params;
        await writeAuditLog({
          userId: access.userId,
          action: "legacy_promotion_migration_failed",
          entityType: "promotion",
          entityId: isValidPromotionId(promotionId) ? promotionId : null,
          metadata: {
            adviser_user_id: access.userId,
            action_type: "migrate_to_draft",
            result_code: "error",
          },
          ipAddress: metadata.ip_address,
          userAgent: metadata.user_agent,
        });
      }
    } catch {
      // ignore
    }

    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Migration failed") },
      500,
    );
  }
}
