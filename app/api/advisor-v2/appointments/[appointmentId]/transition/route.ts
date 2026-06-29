import { NextResponse } from "next/server";

import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";
import type { CrmAppointmentLifecycleStatus } from "@/lib/crm-v2/appointments/lifecycle";
import type { CrmAppointmentTransitionReasonCode } from "@/lib/crm-v2/appointments/lifecycle";
import { transitionCrmAppointment } from "@/lib/crm-v2/appointments/service";
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
    const access = await assertCrmV2AppointmentsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: {
            "X-Request-Id": access.requestId,
            "Cache-Control": PRIVATE_CACHE,
          },
        },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      extraFields: ["adviserUserId", "adviser_user_id", "advisorUserId"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const toStatus = body.toStatus as CrmAppointmentLifecycleStatus;
    const reasonCode = (body.reasonCode ?? "adviser_confirmed") as CrmAppointmentTransitionReasonCode;
    const version = Number(body.version);

    if (!toStatus || !Number.isFinite(version)) {
      return NextResponse.json(
        { ok: false, error: "toStatus and version are required" },
        { status: 400 },
      );
    }

    const { appointmentId } = await context.params;
    const result = await transitionCrmAppointment({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      appointmentId,
      toStatus,
      reasonCode,
      version,
      requestId: access.requestId,
      now: new Date().toISOString(),
    });

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "conflict"
            ? 409
            : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status,
          headers: {
            "X-Request-Id": access.requestId,
            "Cache-Control": PRIVATE_CACHE,
          },
        },
      );
    }

    return NextResponse.json(
      { ok: true, ...result.data },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to transition appointment");
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
