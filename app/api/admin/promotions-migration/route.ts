import { NextResponse } from "next/server";

import { classifyPromotion, listUnmigratedPromotions, migratePromotionToDraft } from "@/lib/communications/legacyPromotionsMigration";
import {
  PROMOTION_MIGRATION_CLASSIFICATIONS,
  type PromotionMigrationClassification,
} from "@/lib/communications/types";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { isValidPromotionId, privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdminAccess();
    if (!access.allowed) {
      return privatePromotionJson(
        { ok: false, reason: access.reason },
        access.reason === "unauthenticated" ? 401 : 403,
      );
    }

    const promotions = await listUnmigratedPromotions();

    return privatePromotionJson({
      ok: true,
      promotions: promotions.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        suggestedClassification: classifyPromotion(p),
      })),
    });
  } catch (err) {
    console.error("[api/admin/promotions-migration GET]", err);
    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Failed to list promotions") },
      500,
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const metadata = getRequestMetadata(request);

  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdminAccess();
    if (!access.allowed) {
      return privatePromotionJson(
        { ok: false, reason: access.reason },
        access.reason === "unauthenticated" ? 401 : 403,
      );
    }

    const enabled = await isFeatureEnabled("admin_content_approval");
    if (!enabled) {
      return privatePromotionJson(
        { ok: false, error: "Migration requires content approval" },
        403,
      );
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

    const classificationResult = validateEnum<PromotionMigrationClassification>(
      body.classification ?? "unsuitable",
      PROMOTION_MIGRATION_CLASSIFICATIONS,
      "classification",
    );
    if (!classificationResult.ok) {
      return privatePromotionJson({ ok: false, error: classificationResult.error }, 400);
    }

    await writeAuditLog({
      userId: access.user.id,
      action: "legacy_promotion_migration_started",
      entityType: "promotion",
      entityId: promotionId,
      metadata: {
        promotion_id: promotionId,
        adviser_user_id: access.user.id,
        action_type: "migrate_to_draft",
        result_code: "started",
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    const result = await migratePromotionToDraft({
      promotionId,
      reviewerUserId: access.user.id,
      classification: classificationResult.value,
    });

    return privatePromotionJson({ ok: true, ...result });
  } catch (err) {
    console.error("[api/admin/promotions-migration POST]", err);

    try {
      const access = await requireAdminAccess();
      if (access.allowed) {
        await writeAuditLog({
          userId: access.user.id,
          action: "legacy_promotion_migration_failed",
          entityType: "promotion",
          entityId: null,
          metadata: {
            adviser_user_id: access.user.id,
            action_type: "migrate_to_draft",
            result_code: "error",
          },
          ipAddress: metadata.ip_address,
          userAgent: metadata.user_agent,
        });
      }
    } catch {
      // audit failure must not mask original error
    }

    return privatePromotionJson(
      { ok: false, error: toPublicErrorMessage(err, "Migration failed") },
      500,
    );
  }
}
