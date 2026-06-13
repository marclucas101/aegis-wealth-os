import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  rateLimitOrThrow,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { cancelAppointment } from "@/lib/supabase/appointmentsPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appointmentId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: access.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const { appointmentId } = await context.params;
    const result = await cancelAppointment({
      appointmentId,
      actorUserId: access.authUser.id,
      isAdviser: true,
    });

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "forbidden"
            ? 403
            : 500;
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        { status },
      );
    }

    const { ip_address, user_agent } = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_appointment_cancelled",
      entityType: "adviser_appointments",
      entityId: appointmentId,
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to cancel appointment");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
