import { NextResponse } from "next/server";

import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";
import { rescheduleCrmAppointment } from "@/lib/crm-v2/appointments/service";
import { isValidIanaTimezone } from "@/lib/crm-v2/appointments/timezone";
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
    const startsAt = typeof body.startsAt === "string" ? body.startsAt.trim() : "";
    const endsAt = typeof body.endsAt === "string" ? body.endsAt.trim() : "";
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "Asia/Singapore";
    const version = Number(body.version);

    if (!startsAt || !endsAt || !Number.isFinite(version)) {
      return NextResponse.json(
        { ok: false, error: "startsAt, endsAt and version are required" },
        { status: 400 },
      );
    }

    if (!isValidIanaTimezone(timezone)) {
      return NextResponse.json({ ok: false, error: "Invalid timezone" }, { status: 400 });
    }

    const { appointmentId } = await context.params;
    const result = await rescheduleCrmAppointment({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      appointmentId,
      startsAt,
      endsAt,
      timezone,
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
      { ok: true, appointmentId: result.data.appointmentId },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to reschedule appointment");
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
