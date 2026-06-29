import { NextResponse } from "next/server";

import { assertCrmV2AppointmentsAccess } from "@/lib/crm-v2/access";
import { loadCrmAppointmentDetail } from "@/lib/crm-v2/appointments/service";
import type { CrmAppointmentDetail } from "@/lib/crm-v2/appointments/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

export type AdvisorV2AppointmentDetailResponse =
  | ({ ok: true; appointment: CrmAppointmentDetail })
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "feature_disabled"
        | "pilot_mode_disabled"
        | "pilot_not_eligible"
        | "not_found"
        | "error";
      error?: string;
    };

const PRIVATE_CACHE = "private, no-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ appointmentId: string }> },
): Promise<NextResponse<AdvisorV2AppointmentDetailResponse>> {
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

    const { appointmentId } = await context.params;
    const appointment = await loadCrmAppointmentDetail(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      appointmentId,
    );

    if (!appointment) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        {
          status: 404,
          headers: {
            "X-Request-Id": access.requestId,
            "Cache-Control": PRIVATE_CACHE,
          },
        },
      );
    }

    return NextResponse.json(
      { ok: true, appointment },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load appointment");
    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
