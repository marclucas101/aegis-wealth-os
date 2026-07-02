import { NextResponse } from "next/server";

import {
  assertCrmV2ClientProtectionAccess,
  assertCrmV2ClientServiceAccess,
} from "@/lib/crm-v2/access";
import { createClientProtectionReviewRequest } from "@/lib/crm-v2/protection/protection";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const protectionAccess = await assertCrmV2ClientProtectionAccess();
    if (!protectionAccess.allowed) {
      return NextResponse.json(
        { ok: false, reason: protectionAccess.reason },
        {
          status: protectionAccess.reason === "unauthenticated" ? 401 : 403,
          headers: {
            "X-Request-Id": protectionAccess.requestId,
            "Cache-Control": PRIVATE_CACHE,
          },
        },
      );
    }

    const serviceAccess = await assertCrmV2ClientServiceAccess();
    if (!serviceAccess.allowed) {
      return NextResponse.json(
        { ok: false, reason: "feature_disabled" },
        {
          status: 403,
          headers: { "X-Request-Id": serviceAccess.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: protectionAccess.authUserId,
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
    const explanation = String(body.explanation ?? "Client requested protection portfolio review").trim();

    if (!protectionAccess.client.advisor_user_id) {
      return NextResponse.json({ ok: false, error: "Adviser not assigned" }, { status: 400 });
    }

    const idempotencyKey = String(body.idempotencyKey ?? "protection_review_request");
    const result = await createClientProtectionReviewRequest({
      clientId: protectionAccess.client.id,
      authUserId: protectionAccess.authUserId,
      adviserUserId: protectionAccess.client.advisor_user_id,
      explanation,
      idempotencyKey,
      requestTraceId: protectionAccess.requestId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: 400, headers: { "X-Request-Id": protectionAccess.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }

    return NextResponse.json(
      { ok: true, requestId: result.data.requestId },
      {
        status: 201,
        headers: { "X-Request-Id": protectionAccess.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to submit review request") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
