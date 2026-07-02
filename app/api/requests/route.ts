import { NextResponse } from "next/server";

import { assertCrmV2ClientServiceAccess } from "@/lib/crm-v2/access";
import {
  createClientServiceRequest,
  listClientServiceRequests,
} from "@/lib/crm-v2/service/service";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientServiceAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const requests = await listClientServiceRequests(access.client.id);
    return NextResponse.json(
      { ok: true, requests },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load requests") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientServiceAccess();
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
      userId: access.authUserId,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) return rateLimit.response;

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: true,
      extraFields: ["adviserUserId", "adviser_user_id"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    if (!access.client.advisor_user_id) {
      return NextResponse.json(
        { ok: false, error: "No assigned adviser" },
        { status: 400, headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }

    const result = await createClientServiceRequest({
      clientId: access.client.id,
      authUserId: access.authUserId,
      adviserUserId: access.client.advisor_user_id,
      category: String(body.category),
      summary: String(body.summary),
      details: body.details ? String(body.details) : null,
      urgency: body.urgency ? String(body.urgency) : "normal",
      idempotencyKey: body.idempotencyKey ? String(body.idempotencyKey) : undefined,
      requestTraceId: access.requestId,
      now: new Date().toISOString(),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        { status: 400, headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }

    return NextResponse.json(
      { ok: true, request: result.data },
      {
        status: 201,
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to submit request") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
