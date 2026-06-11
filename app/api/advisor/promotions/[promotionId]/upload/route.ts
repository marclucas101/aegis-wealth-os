import { NextResponse } from "next/server";

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
  uploadPromotionAsset,
  type PromotionAssetKind,
  type PromotionRecord,
} from "@/lib/supabase/promotionsPersistence";

export const dynamic = "force-dynamic";

const ASSET_KINDS = ["image", "attachment"] as const;

export type PromotionUploadResponse =
  | { ok: true; promotion: PromotionRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

type RouteContext = {
  params: Promise<{ promotionId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<PromotionUploadResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
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
      return NextResponse.json(
        { ok: false, reason: "error", error: "Invalid form data" },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInFormData(formData);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFormFields(formData);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: sensitiveReject.error },
        { status: 400 },
      );
    }

    const kindResult = validateEnum<PromotionAssetKind>(
      formData.get("kind"),
      ASSET_KINDS,
      "kind",
    );
    if (!kindResult.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: kindResult.error },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, reason: "error", error: "A valid file is required" },
        { status: 400 },
      );
    }

    const { promotionId } = await context.params;
    const promotion = await uploadPromotionAsset(
      access.authUser.id,
      promotionId,
      kindResult.value,
      file,
    );

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "promotion_asset_uploaded",
      entityType: "promotions",
      entityId: promotion.id,
      metadata: {
        promotion_id: promotion.id,
        kind: kindResult.value,
        file_name: file.name,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, promotion });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to upload promotion asset");
    console.error("[api/advisor/promotions/[promotionId]/upload POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
