import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  createPromotion,
  listAdvisorPromotions,
  PROMOTION_CATEGORIES,
  PROMOTION_STATUSES,
  rejectForbiddenPromotionFields,
  type PromotionCategory,
  type PromotionDetails,
  type PromotionInput,
  type PromotionRecord,
  type PromotionStatus,
} from "@/lib/supabase/promotionsPersistence";

export const dynamic = "force-dynamic";

export type AdvisorPromotionsListResponse =
  | {
      ok: true;
      promotions: PromotionRecord[];
      viewer: { userId: string; role: "advisor" | "admin" };
    }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

export type AdvisorPromotionsCreateResponse =
  | { ok: true; promotion: PromotionRecord }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

function parseDetails(body: Record<string, unknown>): PromotionDetails | null | undefined {
  if (!("details" in body) && !("highlights" in body) && !("eligibility" in body)) {
    return undefined;
  }

  if (body.details === null) {
    return null;
  }

  if (body.details && typeof body.details === "object") {
    const record = body.details as Record<string, unknown>;
    return {
      highlights: Array.isArray(record.highlights)
        ? record.highlights.filter((item): item is string => typeof item === "string")
        : undefined,
      eligibility:
        typeof record.eligibility === "string" ? record.eligibility : undefined,
    };
  }

  return {
    highlights: Array.isArray(body.highlights)
      ? body.highlights.filter((item): item is string => typeof item === "string")
      : undefined,
    eligibility:
      typeof body.eligibility === "string" ? body.eligibility : undefined,
  };
}

function parsePromotionBody(body: Record<string, unknown>): PromotionInput | { error: string } {
  const titleResult = validateRequiredString(body.title, "title");
  if (!titleResult.ok) {
    return { error: titleResult.error };
  }

  const summaryResult = validateRequiredString(body.summary, "summary");
  if (!summaryResult.ok) {
    return { error: summaryResult.error };
  }

  const categoryResult = validateEnum<PromotionCategory>(
    body.category,
    PROMOTION_CATEGORIES,
    "category",
  );
  if (!categoryResult.ok) {
    return { error: categoryResult.error };
  }

  let status: PromotionStatus | undefined;
  if (body.status !== undefined && body.status !== null) {
    const statusResult = validateEnum<PromotionStatus>(
      body.status,
      PROMOTION_STATUSES,
      "status",
    );
    if (!statusResult.ok) {
      return { error: statusResult.error };
    }
    status = statusResult.value;
  }

  let priority = 0;
  if (body.priority !== undefined && body.priority !== null) {
    if (typeof body.priority !== "number" || !Number.isFinite(body.priority)) {
      return { error: "Missing or invalid priority" };
    }
    priority = Math.trunc(body.priority);
  }

  const subtitle =
    body.subtitle === undefined || body.subtitle === null
      ? null
      : typeof body.subtitle === "string"
        ? body.subtitle
        : null;

  if (body.subtitle !== undefined && body.subtitle !== null && subtitle === null) {
    return { error: "Missing or invalid subtitle" };
  }

  const ctaLabel =
    body.cta_label === undefined && body.ctaLabel === undefined
      ? undefined
      : typeof (body.cta_label ?? body.ctaLabel) === "string"
        ? String(body.cta_label ?? body.ctaLabel)
        : null;

  const ctaUrl =
    body.cta_url === undefined && body.ctaUrl === undefined
      ? undefined
      : typeof (body.cta_url ?? body.ctaUrl) === "string"
        ? String(body.cta_url ?? body.ctaUrl)
        : null;

  const startsAt =
    body.starts_at === undefined && body.startsAt === undefined
      ? undefined
      : typeof (body.starts_at ?? body.startsAt) === "string"
        ? String(body.starts_at ?? body.startsAt)
        : null;

  const endsAt =
    body.ends_at === undefined && body.endsAt === undefined
      ? undefined
      : typeof (body.ends_at ?? body.endsAt) === "string"
        ? String(body.ends_at ?? body.endsAt)
        : null;

  const details = parseDetails(body);

  return {
    title: titleResult.value,
    subtitle,
    summary: summaryResult.value,
    details,
    category: categoryResult.value,
    ctaLabel,
    ctaUrl,
    status,
    priority,
    startsAt,
    endsAt,
  };
}

export async function GET(): Promise<NextResponse<AdvisorPromotionsListResponse>> {
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

    const promotions = await listAdvisorPromotions();

    return NextResponse.json({
      ok: true,
      promotions,
      viewer: { userId: access.authUser.id, role },
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load promotions");
    console.error("[api/advisor/promotions GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
): Promise<NextResponse<AdvisorPromotionsCreateResponse>> {
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

    const rateLimit = rateLimitOrThrow<AdvisorPromotionsCreateResponse>(request, {
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
    const input = parsePromotionBody(body);
    if ("error" in input) {
      return NextResponse.json(
        { ok: false, reason: "error", error: input.error },
        { status: 400 },
      );
    }

    const promotion = await createPromotion(access.authUser.id, input);

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "promotion_created",
      entityType: "promotions",
      entityId: promotion.id,
      metadata: {
        promotion_id: promotion.id,
        status: promotion.status,
        category: promotion.category,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, promotion }, { status: 201 });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create promotion");
    console.error("[api/advisor/promotions POST]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
