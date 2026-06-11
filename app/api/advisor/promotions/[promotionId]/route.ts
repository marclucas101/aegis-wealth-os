import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  getAdvisorPromotionById,
  PROMOTION_CATEGORIES,
  PROMOTION_STATUSES,
  rejectForbiddenPromotionFields,
  updatePromotion,
  type PromotionCategory,
  type PromotionInput,
  type PromotionRecord,
  type PromotionStatus,
} from "@/lib/supabase/promotionsPersistence";

export const dynamic = "force-dynamic";

export type AdvisorPromotionGetResponse =
  | { ok: true; promotion: PromotionRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

export type AdvisorPromotionUpdateResponse =
  | { ok: true; promotion: PromotionRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" | "error"; error?: string };

type RouteContext = {
  params: Promise<{ promotionId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

function parsePartialPromotionBody(
  body: Record<string, unknown>,
): Partial<PromotionInput> | { error: string } {
  const input: Partial<PromotionInput> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return { error: "Missing or invalid title" };
    }
    input.title = body.title;
  }

  if (body.summary !== undefined) {
    if (typeof body.summary !== "string" || !body.summary.trim()) {
      return { error: "Missing or invalid summary" };
    }
    input.summary = body.summary;
  }

  if (body.subtitle !== undefined) {
    if (body.subtitle !== null && typeof body.subtitle !== "string") {
      return { error: "Missing or invalid subtitle" };
    }
    input.subtitle = body.subtitle as string | null;
  }

  if (body.category !== undefined) {
    const categoryResult = validateEnum<PromotionCategory>(
      body.category,
      PROMOTION_CATEGORIES,
      "category",
    );
    if (!categoryResult.ok) {
      return { error: categoryResult.error };
    }
    input.category = categoryResult.value;
  }

  if (body.status !== undefined) {
    const statusResult = validateEnum<PromotionStatus>(
      body.status,
      PROMOTION_STATUSES,
      "status",
    );
    if (!statusResult.ok) {
      return { error: statusResult.error };
    }
    input.status = statusResult.value;
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority)) {
      return { error: "Missing or invalid priority" };
    }
    input.priority = Math.trunc(body.priority);
  }

  if (body.cta_label !== undefined || body.ctaLabel !== undefined) {
    const value = body.cta_label ?? body.ctaLabel;
    if (value !== null && typeof value !== "string") {
      return { error: "Missing or invalid cta_label" };
    }
    input.ctaLabel = value as string | null;
  }

  if (body.cta_url !== undefined || body.ctaUrl !== undefined) {
    const value = body.cta_url ?? body.ctaUrl;
    if (value !== null && typeof value !== "string") {
      return { error: "Missing or invalid cta_url" };
    }
    input.ctaUrl = value as string | null;
  }

  if (body.starts_at !== undefined || body.startsAt !== undefined) {
    const value = body.starts_at ?? body.startsAt;
    if (value !== null && typeof value !== "string") {
      return { error: "Missing or invalid starts_at" };
    }
    input.startsAt = value as string | null;
  }

  if (body.ends_at !== undefined || body.endsAt !== undefined) {
    const value = body.ends_at ?? body.endsAt;
    if (value !== null && typeof value !== "string") {
      return { error: "Missing or invalid ends_at" };
    }
    input.endsAt = value as string | null;
  }

  if ("details" in body || "highlights" in body || "eligibility" in body) {
    if (body.details === null) {
      input.details = null;
    } else if (body.details && typeof body.details === "object") {
      const record = body.details as Record<string, unknown>;
      input.details = {
        highlights: Array.isArray(record.highlights)
          ? record.highlights.filter((item): item is string => typeof item === "string")
          : undefined,
        eligibility:
          typeof record.eligibility === "string" ? record.eligibility : undefined,
      };
    } else {
      input.details = {
        highlights: Array.isArray(body.highlights)
          ? body.highlights.filter((item): item is string => typeof item === "string")
          : undefined,
        eligibility:
          typeof body.eligibility === "string" ? body.eligibility : undefined,
      };
    }
  }

  return input;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorPromotionGetResponse>> {
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

    const { promotionId } = await context.params;
    const result = await getAdvisorPromotionById(promotionId);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: "not_found", error: "Promotion not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, promotion: result.promotion });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load promotion");
    console.error("[api/advisor/promotions/[promotionId] GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorPromotionUpdateResponse>> {
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

    const rateLimit = rateLimitOrThrow<AdvisorPromotionUpdateResponse>(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "error", error: parsed.error },
        { status: 400 },
      );
    }

    const forbidden = rejectForbiddenPromotionFields(parsed.body);
    if (forbidden.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: forbidden.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: true,
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, reason: "error", error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, reason: "error", error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const input = parsePartialPromotionBody(body);
    if ("error" in input) {
      return NextResponse.json(
        { ok: false, reason: "error", error: input.error },
        { status: 400 },
      );
    }

    const { promotionId } = await context.params;
    const result = await updatePromotion(promotionId, input);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: "not_found", error: "Promotion not found" },
        { status: 404 },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "promotion_updated",
      entityType: "promotions",
      entityId: result.promotion.id,
      metadata: {
        promotion_id: result.promotion.id,
        status: result.promotion.status,
        category: result.promotion.category,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, promotion: result.promotion });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update promotion");
    console.error("[api/advisor/promotions/[promotionId] PATCH]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
