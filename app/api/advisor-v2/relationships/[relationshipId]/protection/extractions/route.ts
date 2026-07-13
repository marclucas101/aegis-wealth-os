import { NextResponse } from "next/server";

import { assertCrmV2ProtectionPortfolioAccess } from "@/lib/crm-v2/access";
import { createProtectionExtractionsFromReport } from "@/lib/crm-v2/protection/protection";
import type { ProtectionReportInput } from "@/src/features/advisor-console/protection-report/types";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ProtectionPortfolioAccess();
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
      rejectClientId: true,
      extraFields: ["adviserUserId", "adviser_user_id", "clientId", "client_id"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const report = body.report as ProtectionReportInput | undefined;
    if (!report?.policies || !Array.isArray(report.policies)) {
      return NextResponse.json({ ok: false, error: "Invalid report payload" }, { status: 400 });
    }

    const idempotencyKey = String(body.idempotencyKey ?? `report_${Date.now()}`);
    const { relationshipId } = await context.params;

    const result = await createProtectionExtractionsFromReport({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      relationshipId,
      report,
      sourceDocumentId: body.sourceDocumentId ? String(body.sourceDocumentId) : null,
      idempotencyKey,
      requestId: access.requestId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status:
            result.reason === "not_found" ? 404 : result.reason === "conflict" ? 409 : 400,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, ...result.data },
      {
        status: 201,
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to create extractions") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
