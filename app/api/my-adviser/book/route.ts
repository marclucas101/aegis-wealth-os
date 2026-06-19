import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import {
  bookAppointmentForAssignedAdviser,
  cancelAppointment,
} from "@/lib/supabase/appointmentsPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { safeRecordProspectEvent } from "@/lib/compliance/prospectAnalytics";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

const ALLOWED_BOOK_FIELDS = new Set([
  "appointmentType",
  "startsAt",
  "endsAt",
  "clientNotes",
  "idempotencyKey",
]);

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();
    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: session.authUser.id,
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

    const sensitive = rejectUnexpectedFields(parsed.body);
    if (sensitive.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitive.error },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object" || Array.isArray(parsed.body)) {
      return NextResponse.json(
        { ok: false, error: "Request body is required" },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      if (!ALLOWED_BOOK_FIELDS.has(key)) {
        return NextResponse.json(
          { ok: false, error: `Unexpected field: ${key}` },
          { status: 400 },
        );
      }
    }

    const appointmentType =
      typeof body.appointmentType === "string" ? body.appointmentType : "review";
    const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
    const endsAt = typeof body.endsAt === "string" ? body.endsAt : "";
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim()
        : crypto.randomUUID();

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { ok: false, error: "startsAt and endsAt are required" },
        { status: 400 },
      );
    }

    const result = await bookAppointmentForAssignedAdviser({
      appointmentType,
      startsAt,
      endsAt,
      clientNotes:
        typeof body.clientNotes === "string" ? body.clientNotes : null,
      idempotencyKey,
    });

    if (!result.ok) {
      const status =
        result.reason === "unauthenticated"
          ? 401
          : result.reason === "unassigned"
            ? 404
            : result.reason === "conflict"
              ? 409
              : result.reason === "unavailable"
                ? 503
                : 500;

      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        { status },
      );
    }

    const { ip_address, user_agent } = getRequestMetadata(request);
    await writeAuditLog({
      userId: session.authUser.id,
      clientId: session.client.id,
      action: "client_appointment_booked",
      entityType: "adviser_appointments",
      entityId: result.appointment.id,
      metadata: {
        appointment_type: result.appointment.appointmentType,
        starts_at: result.appointment.startsAt,
      },
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    await safeRecordProspectEvent({
      clientId: session.client.id,
      userId: session.authUser.id,
      event: "prospect_appointment_booked",
      metadata: {
        appointmentId: result.appointment.id,
        appointmentType: result.appointment.appointmentType,
      },
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    return NextResponse.json({ ok: true, appointment: result.appointment });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to book appointment");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();
    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const url = new URL(request.url);
    const appointmentId = url.searchParams.get("appointmentId");
    if (!appointmentId) {
      return NextResponse.json(
        { ok: false, error: "appointmentId is required" },
        { status: 400 },
      );
    }

    const result = await cancelAppointment({
      appointmentId,
      actorUserId: session.authUser.id,
      isAdviser: false,
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
      userId: session.authUser.id,
      clientId: session.client.id,
      action: "client_appointment_cancelled",
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
