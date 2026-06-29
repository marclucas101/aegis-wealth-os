import { NextResponse } from "next/server";

import { assertCrmV2ClientAppointmentsAccess } from "@/lib/crm-v2/access";
import {
  createClientAppointmentRequest,
  listClientAppointmentSummaries,
} from "@/lib/crm-v2/client-appointments/service";
import type { ClientAppointmentListView } from "@/lib/crm-v2/client-appointments/types";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";
const VIEWS: ClientAppointmentListView[] = [
  "upcoming",
  "awaiting_response",
  "preparation",
  "follow_up",
  "history",
];

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientAppointmentsAccess();
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

    const viewRaw = new URL(request.url).searchParams.get("view") ?? "upcoming";
    const view = VIEWS.includes(viewRaw as ClientAppointmentListView)
      ? (viewRaw as ClientAppointmentListView)
      : "upcoming";
    const appointments = await listClientAppointmentSummaries(access.client.id, view);
    return NextResponse.json(
      { ok: true, view, appointments },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load appointments") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ClientAppointmentsAccess();
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

    const rate = rateLimitOrThrow(request, {
      userId: access.authUserId,
      bucket: "writeHeavy",
    });
    if (!rate.ok) return rate.response;

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body, {
      extraFields: [
        "clientId",
        "client_id",
        "advisorId",
        "advisor_id",
        "adviserId",
        "adviser_user_id",
        "adviserUserId",
      ],
    });
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const appointmentType = String(body.appointmentType ?? "").trim();
    const startsAt = String(body.preferredStartsAt ?? "").trim();
    const endsAt = String(body.preferredEndsAt ?? "").trim();
    const timezone = String(body.timezone ?? "Asia/Singapore").trim();
    const deliveryMode = String(body.deliveryMode ?? "google_meet").trim();
    const idempotencyKey = String(body.idempotencyKey ?? "").trim();
    const topics = Array.isArray(body.topics)
      ? body.topics.map((t) => String(t ?? "")).filter(Boolean)
      : [];

    if (!appointmentType || !startsAt || !endsAt || !idempotencyKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "appointmentType, preferredStartsAt, preferredEndsAt and idempotencyKey are required",
        },
        { status: 400 },
      );
    }

    if (!access.client.advisor_user_id) {
      return NextResponse.json(
        { ok: false, error: "Assigned adviser required" },
        { status: 400 },
      );
    }

    const result = await createClientAppointmentRequest({
      clientId: access.client.id,
      clientUserId: access.authUserId,
      adviserUserId: access.client.advisor_user_id,
      appointmentType,
      title: typeof body.title === "string" ? body.title.trim().slice(0, 160) : null,
      preferredStartsAt: startsAt,
      preferredEndsAt: endsAt,
      timezone,
      deliveryMode:
        deliveryMode === "phone" || deliveryMode === "physical" ? deliveryMode : "google_meet",
      idempotencyKey,
      topics,
    });

    if (!result.ok) {
      const status = result.reason === "conflict" ? 409 : 400;
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status, headers: { "Cache-Control": PRIVATE_CACHE } },
      );
    }

    return NextResponse.json(
      { ok: true, appointmentId: result.appointmentId },
      {
        status: 201,
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to request appointment") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
