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
import { createAdviserAppointment } from "@/lib/supabase/adviserAppointmentCreation";
import { listAdviserAppointments } from "@/lib/supabase/appointmentsPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

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

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const appointments = await listAdviserAppointments(access.authUser.id);
    return NextResponse.json({ ok: true, appointments });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load appointments");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      rejectClientId: false,
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const clientId =
      typeof body.clientId === "string" ? body.clientId.trim() : "";

    if (!clientId) {
      return NextResponse.json(
        { ok: false, error: "clientId is required" },
        { status: 400 },
      );
    }

    const appointmentType =
      typeof body.appointmentType === "string"
        ? body.appointmentType.trim()
        : "review";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const startTime =
      typeof body.startTime === "string" ? body.startTime.trim() : "";
    const endTime =
      typeof body.endTime === "string" ? body.endTime.trim() : "";
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "Asia/Singapore";
    const locationType =
      typeof body.locationType === "string" &&
      LOCATION_TYPES.has(body.locationType as CalendarLocationType)
        ? (body.locationType as CalendarLocationType)
        : "google_meet";

    const source =
      body.source === "external_import" ? "external_import" : "adviser_created";

    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : crypto.randomUUID();

    const result = await createAdviserAppointment({
      adviserUserId: access.authUser.id,
      createdByUserId: access.authUser.id,
      userRole: role,
      clientId,
      appointmentType,
      date,
      startTime,
      endTime,
      timezone,
      locationType,
      locationText:
        typeof body.locationText === "string" ? body.locationText : null,
      phoneInstructions:
        typeof body.phoneInstructions === "string"
          ? body.phoneInstructions
          : null,
      customMeetingLink:
        typeof body.customMeetingLink === "string"
          ? body.customMeetingLink
          : null,
      clientVisibleDescription:
        typeof body.clientVisibleDescription === "string"
          ? body.clientVisibleDescription
          : null,
      privateAdviserNote:
        typeof body.privateAdviserNote === "string"
          ? body.privateAdviserNote
          : null,
      externalReference:
        typeof body.externalReference === "string"
          ? body.externalReference
          : null,
      externalUrl:
        typeof body.externalUrl === "string" ? body.externalUrl : null,
      source,
      syncToGoogleCalendar: body.syncToGoogleCalendar === true,
      sendClientNotification: body.sendClientNotification !== false,
      confirmGoogleConflict: body.confirmGoogleConflict === true,
      idempotencyKey,
    });

    if (!result.ok) {
      const status =
        result.reason === "forbidden"
          ? 403
          : result.reason === "not_found" || result.reason === "invalid_client"
            ? 404
            : result.reason === "conflict" || result.reason === "google_conflict"
              ? 409
              : result.reason === "google_unavailable"
                ? 503
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
      action: "adviser_appointment_created",
      entityType: "adviser_appointments",
      entityId: result.appointment.id,
      metadata: {
        appointment_type: result.appointment.appointmentType,
        starts_at: result.appointment.startsAt,
        source,
        sync_to_google: body.syncToGoogleCalendar === true,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json(
      { ok: true, appointment: result.appointment },
      { status: 201 },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create appointment");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
