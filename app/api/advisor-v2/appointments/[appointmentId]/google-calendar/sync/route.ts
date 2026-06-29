import { NextResponse } from "next/server";

import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { syncAppointmentToGoogle } from "@/lib/crm-v2/google-calendar/service";
import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

export async function POST(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2GoogleCalendarAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403, headers: { "Cache-Control": PRIVATE_CACHE } },
      );
    }
    const limited = rateLimitOrThrow(request, { userId: access.authUser.id, bucket: "writeHeavy" });
    if (!limited.ok) return limited.response;
    const { appointmentId } = await context.params;
    const result = await syncAppointmentToGoogle({
      adviserUserId: access.authUser.id,
      appointmentId,
      requestId: access.requestId,
      sendUpdates: "none",
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": PRIVATE_CACHE } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to sync appointment to Google Calendar") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
