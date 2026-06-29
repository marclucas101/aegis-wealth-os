import { NextResponse } from "next/server";

import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";
import {
  loadCrmAppointmentListPage,
  parseAppointmentListFilters,
} from "@/lib/crm-v2/appointments/listQueries";
import { createCrmAppointment } from "@/lib/crm-v2/appointments/service";
import type { CrmAppointmentListPage } from "@/lib/crm-v2/appointments/types";
import { isValidAppointmentTemplateKey } from "@/lib/crm-v2/appointments/templates";
import type { CrmAppointmentLifecycleStatus } from "@/lib/crm-v2/appointments/lifecycle";
import type { CalendarLocationType } from "@/lib/aegis/calendar";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

export type AdvisorV2AppointmentsListResponse =
  | ({ ok: true } & CrmAppointmentListPage)
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "feature_disabled"
        | "pilot_mode_disabled"
        | "pilot_not_eligible"
        | "error";
      error?: string;
    };

const PRIVATE_CACHE = "private, no-store";
const LOCATION_TYPES = new Set<CalendarLocationType>(["physical", "phone", "google_meet"]);
const CREATION_STATUSES = new Set<CrmAppointmentLifecycleStatus>([
  "requested",
  "proposed",
  "awaiting_confirmation",
  "confirmed",
]);

export async function GET(
  request: Request,
): Promise<NextResponse<AdvisorV2AppointmentsListResponse>> {
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

    const filters = parseAppointmentListFilters(
      new URL(request.url).searchParams,
      new Date().toISOString(),
    );
    const result = await loadCrmAppointmentListPage(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      filters,
    );

    return NextResponse.json(
      { ok: true, ...result },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load appointments");
    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
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
      rejectClientId: false,
      extraFields: ["adviserUserId", "adviser_user_id", "advisorUserId"],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json({ ok: false, error: sensitiveReject.error }, { status: 400 });
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const relationshipId =
      typeof body.relationshipId === "string" ? body.relationshipId.trim() : "";
    const templateKey =
      typeof body.templateKey === "string" ? body.templateKey.trim() : "";
    const lifecycleStatus =
      typeof body.lifecycleStatus === "string"
        ? (body.lifecycleStatus as CrmAppointmentLifecycleStatus)
        : "proposed";
    const startsAt = typeof body.startsAt === "string" ? body.startsAt.trim() : "";
    const endsAt = typeof body.endsAt === "string" ? body.endsAt.trim() : "";
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "Asia/Singapore";
    const deliveryMode =
      typeof body.deliveryMode === "string" &&
      LOCATION_TYPES.has(body.deliveryMode as CalendarLocationType)
        ? (body.deliveryMode as CalendarLocationType)
        : "google_meet";

    if (!relationshipId || !templateKey || !startsAt || !endsAt) {
      return NextResponse.json(
        { ok: false, error: "relationshipId, templateKey, startsAt and endsAt are required" },
        { status: 400 },
      );
    }

    if (!isValidAppointmentTemplateKey(templateKey)) {
      return NextResponse.json({ ok: false, error: "Invalid template" }, { status: 400 });
    }

    if (!CREATION_STATUSES.has(lifecycleStatus)) {
      return NextResponse.json(
        { ok: false, error: "Invalid lifecycle status for creation" },
        { status: 400 },
      );
    }

    const participants = Array.isArray(body.participants)
      ? body.participants
          .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
          .map((p) => ({
            displayName: String(p.displayName ?? "").trim(),
            role: (p.role === "adviser" || p.role === "guest" ? p.role : "guest") as
              | "client"
              | "adviser"
              | "guest",
          }))
          .filter((p) => p.displayName)
      : [];

    const adviserAgenda = Array.isArray(body.adviserAgenda)
      ? body.adviserAgenda.map((item) => String(item).trim()).filter(Boolean)
      : undefined;

    const result = await createCrmAppointment({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      relationshipId,
      templateKey,
      lifecycleStatus,
      startsAt,
      endsAt,
      timezone,
      deliveryMode,
      title: typeof body.title === "string" ? body.title : null,
      locationText: typeof body.locationText === "string" ? body.locationText : null,
      participants,
      adviserAgenda,
      requestId: access.requestId,
      now: new Date().toISOString(),
      idempotencyKey:
        typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined,
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
        status: 201,
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to create appointment");
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
