import { NextResponse } from "next/server";

import type { CalendarLocationType } from "@/lib/aegis/calendar";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { updateAdviserAppointment } from "@/lib/supabase/adviserAppointmentCreation";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appointmentId: string }> };

const LOCATION_TYPES = new Set<CalendarLocationType>([
  "physical",
  "phone",
  "google_meet",
]);

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function PATCH(
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

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    const body =
      parsed.body && typeof parsed.body === "object"
        ? (parsed.body as Record<string, unknown>)
        : {};

    const { appointmentId } = await context.params;

    const result = await updateAdviserAppointment({
      appointmentId,
      adviserUserId: access.authUser.id,
      userRole: role,
      appointmentType:
        typeof body.appointmentType === "string"
          ? body.appointmentType.trim()
          : undefined,
      date: typeof body.date === "string" ? body.date.trim() : undefined,
      startTime:
        typeof body.startTime === "string" ? body.startTime.trim() : undefined,
      endTime:
        typeof body.endTime === "string" ? body.endTime.trim() : undefined,
      timezone:
        typeof body.timezone === "string" ? body.timezone.trim() : undefined,
      locationType:
        typeof body.locationType === "string" &&
        LOCATION_TYPES.has(body.locationType as CalendarLocationType)
          ? (body.locationType as CalendarLocationType)
          : undefined,
      locationText:
        typeof body.locationText === "string" ? body.locationText : undefined,
      phoneInstructions:
        typeof body.phoneInstructions === "string"
          ? body.phoneInstructions
          : undefined,
      customMeetingLink:
        typeof body.customMeetingLink === "string"
          ? body.customMeetingLink
          : undefined,
      clientVisibleDescription:
        typeof body.clientVisibleDescription === "string"
          ? body.clientVisibleDescription
          : undefined,
      privateAdviserNote:
        typeof body.privateAdviserNote === "string"
          ? body.privateAdviserNote
          : undefined,
      externalReference:
        typeof body.externalReference === "string"
          ? body.externalReference
          : undefined,
      externalUrl:
        typeof body.externalUrl === "string" ? body.externalUrl : undefined,
      syncToGoogleCalendar:
        typeof body.syncToGoogleCalendar === "boolean"
          ? body.syncToGoogleCalendar
          : undefined,
      sendClientNotification: body.sendClientNotification === true,
      confirmGoogleConflict: body.confirmGoogleConflict === true,
    });

    if (!result.ok) {
      const status =
        result.reason === "forbidden"
          ? 403
          : result.reason === "not_found"
            ? 404
            : result.reason === "conflict" || result.reason === "google_conflict"
              ? 409
              : 400;

      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error: result.error,
          googleConflicts: result.googleConflicts,
        },
        { status },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: result.appointment.clientId,
      userId: access.authUser.id,
      action: "adviser_appointment_updated",
      entityType: "adviser_appointments",
      entityId: result.appointment.id,
      metadata: {
        starts_at: result.appointment.startsAt,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, appointment: result.appointment });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update appointment");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
