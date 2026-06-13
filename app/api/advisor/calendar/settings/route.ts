import { NextResponse } from "next/server";

import type {
  AppointmentTypeOption,
  CalendarLocationType,
  WorkingHoursConfig,
} from "@/lib/aegis/calendar";
import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { validateWorkingHoursConfig } from "@/src/lib/calendar/availability";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdviserCalendarSettings,
  upsertAdviserCalendarSettings,
} from "@/lib/supabase/calendarPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = new Set([
  "timezone",
  "appointmentDurationMinutes",
  "bufferBeforeMinutes",
  "bufferAfterMinutes",
  "minimumNoticeHours",
  "bookingHorizonDays",
  "locationType",
  "meetingLocationText",
  "appointmentTypes",
  "workingHours",
  "blackoutDates",
  "calendarId",
  "calendarEmail",
  "bookingEnabled",
]);

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const settings = await loadAdviserCalendarSettings(access.authUser.id);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load calendar settings");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
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
      if (!ALLOWED_FIELDS.has(key)) {
        return NextResponse.json(
          { ok: false, error: `Unexpected field: ${key}` },
          { status: 400 },
        );
      }
    }

    if (
      body.workingHours !== undefined &&
      (typeof body.workingHours !== "object" ||
        !validateWorkingHoursConfig(body.workingHours as WorkingHoursConfig))
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid workingHours configuration" },
        { status: 400 },
      );
    }

    const settings = await upsertAdviserCalendarSettings(access.authUser.id, {
      timezone:
        typeof body.timezone === "string" ? body.timezone : undefined,
      appointmentDurationMinutes:
        typeof body.appointmentDurationMinutes === "number"
          ? body.appointmentDurationMinutes
          : undefined,
      bufferBeforeMinutes:
        typeof body.bufferBeforeMinutes === "number"
          ? body.bufferBeforeMinutes
          : undefined,
      bufferAfterMinutes:
        typeof body.bufferAfterMinutes === "number"
          ? body.bufferAfterMinutes
          : undefined,
      minimumNoticeHours:
        typeof body.minimumNoticeHours === "number"
          ? body.minimumNoticeHours
          : undefined,
      bookingHorizonDays:
        typeof body.bookingHorizonDays === "number"
          ? body.bookingHorizonDays
          : undefined,
      locationType:
        typeof body.locationType === "string"
          ? (body.locationType as CalendarLocationType)
          : undefined,
      meetingLocationText:
        typeof body.meetingLocationText === "string"
          ? body.meetingLocationText
          : body.meetingLocationText === null
            ? null
            : undefined,
      appointmentTypes: Array.isArray(body.appointmentTypes)
        ? (body.appointmentTypes as AppointmentTypeOption[])
        : undefined,
      workingHours:
        typeof body.workingHours === "object" && body.workingHours
          ? (body.workingHours as WorkingHoursConfig)
          : undefined,
      blackoutDates: Array.isArray(body.blackoutDates)
        ? (body.blackoutDates as string[])
        : undefined,
      calendarId:
        typeof body.calendarId === "string" ? body.calendarId : undefined,
      calendarEmail:
        typeof body.calendarEmail === "string"
          ? body.calendarEmail
          : body.calendarEmail === null
            ? null
            : undefined,
      bookingEnabled:
        typeof body.bookingEnabled === "boolean"
          ? body.bookingEnabled
          : undefined,
    });

    const { ip_address, user_agent } = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_calendar_settings_updated",
      entityType: "adviser_calendar_settings",
      entityId: access.authUser.id,
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to update calendar settings");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
