import { NextResponse } from "next/server";

import { assertReadinessResponseSafe } from "@/lib/binder/binderContentPreparation";
import { BINDER_ERROR_CODES, toBinderPublicError } from "@/lib/binder/binderErrors";
import { parseBinderReadinessQuery } from "@/lib/binder/binderReadinessRoute";
import { assessBinderReadiness } from "@/lib/binder/binderReadinessService";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { createRequestId, logError } from "@/lib/ops/logger";
import { privateNoStoreHeaders, rateLimitOrThrow } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

type ReadinessErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

function readinessError(
  code: string,
  message: string,
  status: number,
): NextResponse<ReadinessErrorBody> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status, headers: privateNoStoreHeaders() },
  );
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const requestId = createRequestId();
  let stage = "init";
  let clientId: string | null = null;
  let adviserUserId: string | null = null;

  try {
    stage = "rate_limit";
    const rateLimit = rateLimitOrThrow(request, { bucket: "read" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    stage = "auth";
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      const message =
        access.reason === "unauthenticated"
          ? "Authentication required."
          : "You no longer have access to this client.";
      return readinessError(
        access.reason === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN",
        message,
        access.reason === "unauthenticated" ? 401 : 403,
      );
    }
    adviserUserId = access.user.id;

    stage = "feature_gate";
    const enabled = await isFeatureEnabled("binder_export");
    if (!enabled) {
      return readinessError(
        "BINDER_EXPORT_DISABLED",
        "Meeting-pack generation is currently unavailable.",
        403,
      );
    }

    stage = "params";
    const params = await context.params;
    clientId = params.clientId;
    const role = access.user.role === "admin" ? "admin" : "advisor";

    stage = "client_access";
    const clientAccess = await resolveAccessibleClient(access.user.id, role, clientId);
    if (clientAccess.status !== "ok") {
      const message =
        clientAccess.status === "forbidden"
          ? "You no longer have access to this client."
          : "Client not found.";
      return readinessError(
        clientAccess.status === "forbidden" ? "FORBIDDEN" : "NOT_FOUND",
        message,
        clientAccess.status === "forbidden" ? 403 : 404,
      );
    }

    stage = "query_parse";
    const url = new URL(request.url);
    const parsedQuery = parseBinderReadinessQuery(url.searchParams);
    if (!parsedQuery.ok) {
      return readinessError(
        BINDER_ERROR_CODES.READINESS_INVALID_INPUT,
        parsedQuery.message,
        400,
      );
    }

    stage = "assess";
    const assessment = await assessBinderReadiness({
      clientId,
      adviserUserId: access.user.id,
      userRole: role,
      meetingDate: parsedQuery.query.meetingDate,
      purpose: parsedQuery.query.purpose,
      selectedSectionIds: parsedQuery.query.selectedSectionIds,
    });

    stage = "response_safety";
    const responseBody = {
      ok: true as const,
      readiness: assessment.readiness,
      message: assessment.readiness.summaryMessage,
    };

    assertReadinessResponseSafe(responseBody.readiness);

    return NextResponse.json(responseBody, { headers: privateNoStoreHeaders() });
  } catch (err) {
    const pub = toBinderPublicError(err, "Failed to assess binder readiness");
    const status = pub.code === BINDER_ERROR_CODES.ACCESS_DENIED ? 403 : 500;

    logError("binder readiness failed", {
      requestId,
      route: "binder-export/readiness",
      stage,
      clientId,
      adviserUserId,
      code: pub.code ?? BINDER_ERROR_CODES.READINESS_FAILED,
      unavailableSectionIds:
        err instanceof Error && err.message.includes("Readiness response")
          ? ["response_safety"]
          : undefined,
    });

    return readinessError(
      pub.code === BINDER_ERROR_CODES.ACCESS_DENIED
        ? BINDER_ERROR_CODES.ACCESS_DENIED
        : BINDER_ERROR_CODES.READINESS_FAILED,
      status === 403
        ? "You no longer have access to this client."
        : "Unable to check meeting pack readiness. Please try again.",
      status,
    );
  }
}
