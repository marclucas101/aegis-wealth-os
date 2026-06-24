import { NextResponse } from "next/server";

import { isValidPromotionId, privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { requirePromotionMigrationAdminAccess } from "@/lib/promotions/promotionMigrationAdminAccess";
import { buildPromotionMigrationAdminRetirementContext } from "@/lib/promotions/promotionMigrationAdminContext";
import {
  isPhase9f4MigrationExecutionRestricted,
  PHASE9F4_MIGRATION_RUNTIME_GATE_CODE,
  PHASE9F4_MIGRATION_RUNTIME_GATE_MESSAGE,
} from "@/lib/promotions/promotionMigrationRuntimeGate";
import { parsePromotionMigrationListParams } from "@/lib/promotions/promotionMigrationRouteParams";
import {
  executePromotionMigration,
  getPromotionMigrationQueueOverview,
  listPromotionMigrationRecords,
} from "@/lib/promotions/promotionMigrationReviewService";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  PROMOTION_MIGRATION_CLASSIFICATIONS,
  type PromotionMigrationClassification,
} from "@/lib/promotions/promotionMigrationTypes";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const access = await requirePromotionMigrationAdminAccess();
    if (!access.allowed) {
      return access.response;
    }

    const url = new URL(request.url);
    const filter = parsePromotionMigrationListParams(url.searchParams);
    const [result, overview] = await Promise.all([
      listPromotionMigrationRecords(filter),
      getPromotionMigrationQueueOverview(),
    ]);

    return privatePromotionJson({
      ok: true,
      ...result,
      retirement: buildPromotionMigrationAdminRetirementContext(overview),
    });
  } catch (err) {
    console.error("[api/admin/promotions-migration GET]", err);
    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Failed to list promotions") },
      500,
    );
  }
}

/** Backward-compatible migrate endpoint — prefer POST /[promotionId]/migrate */
export async function POST(request: Request): Promise<NextResponse> {
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
    const promotionId = typeof body.promotionId === "string" ? body.promotionId.trim() : "";

    if (!isValidPromotionId(promotionId)) {
      return privatePromotionJson({ ok: false, error: "Invalid promotionId" }, 400);
    }

    if (isPhase9f4MigrationExecutionRestricted()) {
      return privatePromotionJson(
        {
          ok: false,
          error: {
            code: PHASE9F4_MIGRATION_RUNTIME_GATE_CODE,
            message: PHASE9F4_MIGRATION_RUNTIME_GATE_MESSAGE,
          },
        },
        403,
      );
    }

    const classificationResult = validateEnum<PromotionMigrationClassification>(
      body.classification ?? "unsuitable",
      PROMOTION_MIGRATION_CLASSIFICATIONS,
      "classification",
    );
    if (!classificationResult.ok) {
      return privatePromotionJson({ ok: false, error: classificationResult.error }, 400);
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
        classification: classificationResult.value,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    const result = await executePromotionMigration({
      promotionId,
      reviewerUserId: access.userId,
      classification: classificationResult.value,
    });

    if (!result.ok) {
      if (result.reason === "not_found") {
        return privatePromotionJson({ ok: false, error: "Promotion not found" }, 404);
      }
      if (result.reason === "asset_blocked") {
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
    console.error("[api/admin/promotions-migration POST]", err);

    try {
      const access = await requirePromotionMigrationAdminAccess();
      if (access.allowed) {
        await writeAuditLog({
          userId: access.userId,
          action: "legacy_promotion_migration_failed",
          entityType: "promotion",
          entityId: null,
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
      // ignore audit failure
    }

    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Migration failed") },
      500,
    );
  }
}
