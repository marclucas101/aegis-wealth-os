import { NextResponse } from "next/server";

import { assertCrmV2ServiceAccess } from "@/lib/crm-v2/access";
import type { CrmServiceRequestLifecycleStatus } from "@/lib/crm-v2/service/requestLifecycle";
import { CRM_SERVICE_REQUEST_LIFECYCLE_STATUSES } from "@/lib/crm-v2/service/requestLifecycle";
import type { CrmServiceRequestTransitionReasonCode } from "@/lib/crm-v2/service/requestLifecycle";
import { transitionAdviserServiceRequest } from "@/lib/crm-v2/service/service";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";
const ALLOWED = new Set<string>(CRM_SERVICE_REQUEST_LIFECYCLE_STATUSES);

export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ServiceAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) return rateLimit.response;

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: false,
      extraFields: ["adviserUserId", "clientId"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const toStatus = String(body.toStatus);
    if (!ALLOWED.has(toStatus)) {
      return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
    }

    const { requestId } = await context.params;
    const result = await transitionAdviserServiceRequest({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      requestId,
      toStatus: toStatus as CrmServiceRequestLifecycleStatus,
      reasonCode: String(body.reasonCode ?? "adviser_progressed") as CrmServiceRequestTransitionReasonCode,
      version: Number(body.version),
      resolutionSummary: body.resolutionSummary ? String(body.resolutionSummary) : null,
      requestTraceId: access.requestId,
      now: new Date().toISOString(),
    });

    if (!result.ok) {
      const status =
        result.reason === "not_found" ? 404 : result.reason === "conflict" ? 409 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        { status, headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }

    return NextResponse.json(
      { ok: true, request: result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to transition request") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
