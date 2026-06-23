import { NextResponse } from "next/server";

import {
  isValidPromotionId,
  privatePromotionJson,
  requireAdviserPromotionOwnership,
  requireLegacyPromotionsWriteAccess,
  resolveLegacyPromotionViewerRole,
} from "@/lib/promotions/legacyPromotionsAuthorization";
import {
  getRequestMetadata,
  rateLimitOrThrow,
  rejectClientIdInFormData,
  rejectUnexpectedFormFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  getAdvisorPromotionById,
  uploadPromotionAsset,
  type PromotionAssetKind,
  type PromotionRecord,
} from "@/lib/supabase/promotionsPersistence";

export const dynamic = "force-dynamic";

const ASSET_KINDS = ["image", "attachment"] as const;

export type PromotionUploadResponse =
  | { ok: true; promotion: PromotionRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

type RouteContext = {
  params: Promise<{ promotionId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<PromotionUploadResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return privatePromotionJson(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        access.reason === "unauthenticated" ? 401 : 403,
      );
    }

    const role = resolveLegacyPromotionViewerRole(access.user.role);
    if (!role) {
      return privatePromotionJson(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        403,
      );
    }

    const { promotionId } = await context.params;
    if (!isValidPromotionId(promotionId)) {
      return privatePromotionJson(
        { ok: false, reason: "not_found", error: "Promotion not found" },
        404,
      );
    }

    const metadata = getRequestMetadata(request);
    const writeGuard = await requireLegacyPromotionsWriteAccess({
      userId: access.authUser.id,
      promotionId,
      actionType: "upload",
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });
    if (!writeGuard.allowed) {
      return writeGuard.response as NextResponse<PromotionUploadResponse>;
    }

    const existing = await getAdvisorPromotionById(promotionId);
    if (!existing.ok) {
      return privatePromotionJson(
        { ok: false, reason: "not_found", error: "Promotion not found" },
        404,
      );
    }

    const ownership = requireAdviserPromotionOwnership({
      access,
      promotion: existing.promotion,
    });
    if (!ownership.allowed) {
      return ownership.response as NextResponse<PromotionUploadResponse>;
    }

    const rateLimit = rateLimitOrThrow<PromotionUploadResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return privatePromotionJson(
        { ok: false, reason: "error", error: "Invalid form data" },
        400,
      );
    }

    const clientIdReject = rejectClientIdInFormData(formData);
    if (clientIdReject.rejected) {
      return privatePromotionJson(
        { ok: false, reason: "error", error: clientIdReject.error },
        400,
      );
    }

    const sensitiveReject = rejectUnexpectedFormFields(formData);
    if (sensitiveReject.rejected) {
      return privatePromotionJson(
        { ok: false, reason: "error", error: sensitiveReject.error },
        400,
      );
    }

    const kindResult = validateEnum<PromotionAssetKind>(
      formData.get("kind"),
      ASSET_KINDS,
      "kind",
    );
    if (!kindResult.ok) {
      return privatePromotionJson(
        { ok: false, reason: "error", error: kindResult.error },
        400,
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return privatePromotionJson(
        { ok: false, reason: "error", error: "A valid file is required" },
        400,
      );
    }

    const promotion = await uploadPromotionAsset(
      access.authUser.id,
      promotionId,
      kindResult.value,
      file,
    );

    await writeAuditLog({
      userId: access.authUser.id,
      action: "promotion_asset_uploaded",
      entityType: "promotions",
      entityId: promotion.id,
      metadata: {
        promotion_id: promotion.id,
        kind: kindResult.value,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return privatePromotionJson({ ok: true, promotion });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to upload promotion asset");
    console.error("[api/advisor/promotions/[promotionId]/upload POST]", err);

    return privatePromotionJson(
      { ok: false, reason: "error", error: message },
      500,
    );
  }
}
