import { NextResponse } from "next/server";

import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";
import { transitionClientOwnedAppointment } from "@/lib/crm-v2/client-appointments/service";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
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
    const version = Number(body.version);
    if (!Number.isFinite(version)) {
      return NextResponse.json({ ok: false, error: "version is required" }, { status: 400 });
    }
    const { appointmentId } = await context.params;
    const result = await transitionClientOwnedAppointment({
      clientId: access.client.id,
      clientUserId: access.authUserId,
      appointmentId,
      version,
      toStatus: "requested",
      reason: "client_reschedule_requested",
    });
    if (!result.ok) {
      const status =
        result.reason === "not_found" ? 404 : result.reason === "conflict" ? 409 : 400;
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
      { ok: false, error: toPublicErrorMessage(err, "Failed to request reschedule") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
