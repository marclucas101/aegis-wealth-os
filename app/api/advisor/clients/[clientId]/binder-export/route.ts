import { NextResponse } from "next/server";

import {
  BINDER_SECTIONS,
  generateBinderExport,
  type BinderSection,
} from "@/lib/communications/binderExport";
import { BINDER_DEFAULT_GENERATION_SECTIONS } from "@/lib/binder/binderSectionPolicy";
import { assessBinderReadiness } from "@/lib/binder/binderReadinessService";
import { logBinderGenerationSourceUnavailable } from "@/lib/binder/binderGenerationLogging";
import { BINDER_READINESS_USER_MESSAGE } from "@/lib/binder/binderSectionPolicy";
import { BINDER_MAX_SECTION_COUNT } from "@/lib/binder/binderPdfTypes";
import { BINDER_ERROR_CODES, toBinderPublicError } from "@/lib/binder/binderErrors";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { createRequestId } from "@/lib/ops/logger";
import {
  parseJsonBodySafely,
  privateNoStoreHeaders,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

function parseSections(body: Record<string, unknown>): BinderSection[] | null {
  if (!("sections" in body)) {
    return [...BINDER_DEFAULT_GENERATION_SECTIONS];
  }
  if (!Array.isArray(body.sections)) {
    return null;
  }
  const sections = body.sections.filter((s): s is string => typeof s === "string");
  const valid = sections.filter((s): s is BinderSection =>
    (BINDER_SECTIONS as readonly string[]).includes(s),
  );
  if (valid.length !== sections.length) {
    return null;
  }
  if (valid.length === 0 || valid.length > BINDER_MAX_SECTION_COUNT) {
    return null;
  }
  return valid;
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = createRequestId();
  let logContext:
    | {
        clientId: string;
        adviserUserId: string;
        userRole: "advisor" | "admin";
        sections: BinderSection[];
        meetingDate: string | null;
      }
    | null = null;

  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403, headers: privateNoStoreHeaders() },
      );
    }

    const enabled = await isFeatureEnabled("binder_export");
    if (!enabled) {
      return NextResponse.json(
        { ok: false, error: "Binder export is disabled" },
        { status: 403, headers: privateNoStoreHeaders() },
      );
    }

    const { clientId } = await context.params;
    const role = access.user.role === "admin" ? "admin" : "advisor";

    const clientAccess = await resolveAccessibleClient(access.user.id, role, clientId);
    if (clientAccess.status !== "ok") {
      return NextResponse.json(
        {
          ok: false,
          error:
            clientAccess.status === "forbidden"
              ? "Client not assigned"
              : "Client not found",
        },
        { status: clientAccess.status === "forbidden" ? 403 : 404, headers: privateNoStoreHeaders() },
      );
    }

    const parsed = await parseJsonBodySafely(request, { allowEmpty: true });
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const body =
      parsed.body && typeof parsed.body === "object"
        ? (parsed.body as Record<string, unknown>)
        : {};

    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const unexpected = rejectUnexpectedFields(body, {
      rejectClientId: true,
      extraFields: ["storagePath", "storage_path", "filename", "adviserUserId", "adviser_user_id"],
      allowFields: ["sections", "meetingDate"],
    });
    if (unexpected.rejected) {
      return NextResponse.json(
        { ok: false, error: unexpected.error },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const sections = parseSections(body);
    if (!sections) {
      return NextResponse.json(
        { ok: false, error: "Invalid sections selection" },
        { status: 400, headers: privateNoStoreHeaders() },
      );
    }

    const meetingDate =
      typeof body.meetingDate === "string" ? body.meetingDate : null;

    logContext = {
      clientId,
      adviserUserId: access.user.id,
      userRole: role,
      sections,
      meetingDate,
    };

    const binder = await generateBinderExport({
      clientId,
      adviserUserId: access.user.id,
      userRole: role,
      meetingDate,
      sections,
    });

    return NextResponse.json(
      {
        ok: true,
        binder: {
          id: binder.id,
          binderLineageId: binder.binderLineageId,
          version: binder.version,
          generationStatus: binder.generationStatus,
          sectionsIncluded: binder.sectionsIncluded,
          meetingDate: binder.meetingDate,
          createdAt: binder.createdAt,
          generationCompletedAt: binder.generationCompletedAt,
          reused: binder.reused,
        },
      },
      { headers: privateNoStoreHeaders() },
    );
  } catch (err) {
    const pub = toBinderPublicError(err, "Failed to generate binder");

    if (pub.code === BINDER_ERROR_CODES.SOURCE_UNAVAILABLE && logContext) {
      try {
        const assessment = await assessBinderReadiness({
          clientId: logContext.clientId,
          adviserUserId: logContext.adviserUserId,
          userRole: logContext.userRole,
          meetingDate: logContext.meetingDate,
          sections: logContext.sections,
        });
        logBinderGenerationSourceUnavailable({
          clientId: logContext.clientId,
          adviserUserId: logContext.adviserUserId,
          requestedSectionIds: logContext.sections,
          unavailableSections: assessment.readiness.unavailableSections,
          requestId,
        });
      } catch {
        // Best-effort structured logging only.
      }

      return NextResponse.json(
        {
          ok: false,
          error: BINDER_READINESS_USER_MESSAGE,
          code: pub.code,
        },
        { status: 422, headers: privateNoStoreHeaders() },
      );
    }

    console.error("[api/advisor/clients/[clientId]/binder-export POST]", err);
    const status = pub.code === "BINDER_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: pub.error, code: pub.code },
      { status, headers: privateNoStoreHeaders() },
    );
  }
}
