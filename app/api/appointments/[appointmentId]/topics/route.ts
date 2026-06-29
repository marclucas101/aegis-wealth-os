import { NextResponse } from "next/server";

import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";
import { replaceClientTopics } from "@/lib/crm-v2/client-appointments/service";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

async function handleWrite(request: Request, appointmentId: string): Promise<NextResponse> {
  const access = await assertCrmV2ClientAppointmentsAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { ok: false, reason: access.reason },
      { status: access.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const rate = rateLimitOrThrow(request, {
    userId: access.authUserId,
    bucket: "writeHeavy",
  });
  if (!rate.ok) return rate.response;
  const parsed = await parseJsonBodySafely(request);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const sensitiveReject = rejectUnexpectedFields(parsed.body);
  if (sensitiveReject.rejected) {
    return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
  }
  const body = (parsed.body ?? {}) as Record<string, unknown>;
  const topics = Array.isArray(body.topics)
    ? body.topics.map((t) => String(t ?? "")).filter(Boolean)
    : [];
  const result = await replaceClientTopics({
    clientId: access.client.id,
    clientUserId: access.authUserId,
    appointmentId,
    topics,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 404, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
): Promise<NextResponse> {
  try {
    const { appointmentId } = await context.params;
    return await handleWrite(request, appointmentId);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update topics") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
): Promise<NextResponse> {
  try {
    const { appointmentId } = await context.params;
    return await handleWrite(request, appointmentId);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update topics") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
