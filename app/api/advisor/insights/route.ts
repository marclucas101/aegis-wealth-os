import { NextResponse } from "next/server";

import { adviserPermittedAudienceScopes, validateTargetClientIds } from "@/lib/communications/audienceTargeting";
import { categoryToContentType } from "@/lib/communications/contentValidation";
import { createContentDraft } from "@/lib/communications/contentWorkflow";
import type {
  AudienceScope,
  GovernedContentCategory,
  GovernedContentRow,
} from "@/lib/communications/types";
import { GOVERNED_CONTENT_CATEGORIES } from "@/lib/communications/types";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  dbListGovernedContentForAdviser,
  dbListGovernedContentForAuthor,
} from "@/lib/supabase/governedContentPersistence";

export const dynamic = "force-dynamic";

function toAdviserDto(row: GovernedContentRow) {
  return {
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
    sourcePublicationDate: row.source_publication_date,
    expiresAt: row.expires_at,
    approvalStatus: row.approval_status,
    rejectionReason: row.rejection_reason,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    withdrawnAt: row.withdrawn_at,
    version: row.version,
    supersedesContentId: row.supersedes_content_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(): Promise<NextResponse> {
  try {
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

    const role = access.user.role === "admin" ? "admin" : "advisor";
    const rows =
      role === "admin"
        ? await dbListGovernedContentForAuthor(access.user.id)
        : await dbListGovernedContentForAdviser(access.user.id);

    return NextResponse.json({
      ok: true,
      content: rows.map(toAdviserDto),
      permittedAudienceScopes: adviserPermittedAudienceScopes(role),
    });
  } catch (err) {
    console.error("[api/advisor/insights GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load insights") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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

    const titleResult = validateRequiredString(body.title, "title");
    if (!titleResult.ok) {
      return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
    }

    const summaryResult = validateRequiredString(body.summary, "summary");
    if (!summaryResult.ok) {
      return NextResponse.json({ ok: false, error: summaryResult.error }, { status: 400 });
    }

    const categoryResult = validateEnum(body.category, GOVERNED_CONTENT_CATEGORIES, "category");
    if (!categoryResult.ok) {
      return NextResponse.json({ ok: false, error: categoryResult.error }, { status: 400 });
    }

    const role = access.user.role === "admin" ? "admin" : "advisor";
    const permitted = adviserPermittedAudienceScopes(role);
    const audienceScope = (body.audienceScope as AudienceScope) ?? "assigned_active_clients";

    if (!permitted.includes(audienceScope)) {
      return NextResponse.json({ ok: false, error: "Audience scope not permitted" }, { status: 403 });
    }

    const targetClientIds = Array.isArray(body.targetClientIds)
      ? body.targetClientIds.filter((id): id is string => typeof id === "string")
      : [];

    if (audienceScope === "selected_clients") {
      const validation = await validateTargetClientIds(access.user.id, role, targetClientIds);
      if (!validation.ok) {
        return NextResponse.json({ ok: false, error: validation.error }, { status: 403 });
      }
    }

    const category = categoryResult.value as GovernedContentCategory;
    const contentType = categoryToContentType(category);

    const row = await createContentDraft({
      data: {
        title: titleResult.value,
        summary: summaryResult.value,
        body: typeof body.body === "string" ? body.body : "",
        category,
        contentType,
        audienceScope,
        targetClientIds,
        externalUrl: typeof body.externalUrl === "string" ? body.externalUrl : null,
        externalSourceName: typeof body.externalSourceName === "string" ? body.externalSourceName : null,
        sourcePublicationDate: typeof body.sourcePublicationDate === "string" ? body.sourcePublicationDate : null,
        expiresAt: typeof body.expiresAt === "string" ? body.expiresAt : null,
      },
      authorUserId: access.user.id,
      adviserUserId: role === "advisor" ? access.user.id : null,
    });

    return NextResponse.json({ ok: true, content: toAdviserDto(row) });
  } catch (err) {
    console.error("[api/advisor/insights POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to create draft") },
      { status: 500 },
    );
  }
}
