import { NextResponse } from "next/server";

import { validateTargetClientIds } from "@/lib/communications/audienceTargeting";
import { categoryToContentType } from "@/lib/communications/contentValidation";
import {
  canAdviserEdit,
  createContentEditVersion,
  duplicateExpiredAsDraft,
  withdrawContent,
} from "@/lib/communications/contentWorkflow";
import type { AudienceScope, GovernedContentCategory } from "@/lib/communications/types";
import { GOVERNED_CONTENT_CATEGORIES } from "@/lib/communications/types";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { dbLoadGovernedContentById } from "@/lib/supabase/governedContentPersistence";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ contentId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const { contentId } = await context.params;
    const row = await dbLoadGovernedContentById(contentId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }

    const role = access.user.role;
    if (
      role === "advisor" &&
      row.adviser_user_id !== access.user.id &&
      row.author_user_id !== access.user.id
    ) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      content: {
        id: row.id,
        title: row.title,
        summary: row.summary,
        body: row.body,
        category: row.category,
        contentType: row.content_type,
        audienceScope: row.audience_scope,
        targetClientIds: row.target_client_ids,
        externalUrl: row.external_url,
        externalSourceName: row.external_source_name,
        approvalStatus: row.approval_status,
        rejectionReason: row.rejection_reason,
        version: row.version,
      },
    });
  } catch (err) {
    console.error("[api/advisor/insights/[contentId] GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load content") },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const enabled = await isFeatureEnabled("adviser_insight_authoring");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Insight authoring is disabled" }, { status: 403 });
    }

    const { contentId } = await context.params;
    const row = await dbLoadGovernedContentById(contentId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }

    const role = access.user.role;
    if (!canAdviserEdit(row, access.user.id, role)) {
      return NextResponse.json({ ok: false, error: "Content cannot be edited" }, { status: 403 });
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, { rejectClientId: true });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json({ ok: false, error: "Request body is required" }, { status: 400 });
    }

    const body = parsed.body as Record<string, unknown>;

    if (body.action === "duplicate") {
      const duplicated = await duplicateExpiredAsDraft({
        contentId,
        actorUserId: access.user.id,
      });
      return NextResponse.json({ ok: true, content: { id: duplicated.id, approvalStatus: duplicated.approval_status } });
    }

    if (body.action === "withdraw") {
      const withdrawn = await withdrawContent({
        contentId,
        actorUserId: access.user.id,
        reason: typeof body.withdrawalReason === "string" ? body.withdrawalReason : "",
      });
      return NextResponse.json({ ok: true, content: { id: withdrawn.id, approvalStatus: withdrawn.approval_status } });
    }

    const categoryResult = body.category
      ? validateEnum(body.category, GOVERNED_CONTENT_CATEGORIES, "category")
      : { ok: true as const, value: row.category };

    if (!categoryResult.ok) {
      return NextResponse.json({ ok: false, error: categoryResult.error }, { status: 400 });
    }

    const audienceScope = (body.audienceScope as AudienceScope) ?? row.audience_scope;
    const targetClientIds = Array.isArray(body.targetClientIds)
      ? body.targetClientIds.filter((id): id is string => typeof id === "string")
      : row.target_client_ids;

    if (audienceScope === "selected_clients") {
      const userRole = role === "admin" ? "admin" : "advisor";
      const validation = await validateTargetClientIds(access.user.id, userRole, targetClientIds);
      if (!validation.ok) {
        return NextResponse.json({ ok: false, error: validation.error }, { status: 403 });
      }
    }

    const category = categoryResult.value as GovernedContentCategory;

    const updated = await createContentEditVersion({
      contentId,
      actorUserId: access.user.id,
      data: {
        title: typeof body.title === "string" ? body.title : row.title,
        summary: typeof body.summary === "string" ? body.summary : row.summary,
        body: typeof body.body === "string" ? body.body : row.body,
        category,
        contentType: categoryToContentType(category),
        audienceScope,
        targetClientIds,
        externalUrl: typeof body.externalUrl === "string" ? body.externalUrl : row.external_url,
        externalSourceName: typeof body.externalSourceName === "string" ? body.externalSourceName : row.external_source_name,
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : row.expires_at,
      },
    });

    return NextResponse.json({
      ok: true,
      content: { id: updated.id, approvalStatus: updated.approval_status, version: updated.version },
    });
  } catch (err) {
    console.error("[api/advisor/insights/[contentId] PATCH]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update content") },
      { status: 500 },
    );
  }
}
