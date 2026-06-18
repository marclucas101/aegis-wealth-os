import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  rateLimitOrThrow,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { retryAppointmentNotification } from "@/lib/supabase/adviserAppointmentCreation";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appointmentId: string }> };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

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

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden" },
        { status: 403 },
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

    const result = await retryAppointmentNotification({
      appointmentId,
      adviserUserId: access.authUser.id,
      userRole: role,
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

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_appointment_notification_retried",
      entityType: "adviser_appointments",
      entityId: appointmentId,
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({
      ok: true,
      notificationStatus: result.notificationStatus,
    });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to retry appointment notification",
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
