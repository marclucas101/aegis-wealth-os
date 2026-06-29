import { NextResponse } from "next/server";

import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";
import { completeClientChecklistItem } from "@/lib/crm-v2/client-appointments/service";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appointmentId: string; itemId: string }> },
): Promise<NextResponse> {
  try {
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
    const completed = body.completed !== false;
    const { appointmentId, itemId } = await context.params;
    const result = await completeClientChecklistItem({
      clientId: access.client.id,
      appointmentId,
      itemId,
      completed,
    });
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status, headers: { "Cache-Control": PRIVATE_CACHE } },
      );
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update checklist item") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
