import { NextResponse } from "next/server";

import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { getAppointmentGoogleSyncStatus } from "@/lib/crm-v2/google-calendar/service";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

export async function GET(
  _request: Request,
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
    const { appointmentId } = await context.params;
    const status = await getAppointmentGoogleSyncStatus({
      adviserUserId: access.authUser.id,
      appointmentId,
    });
    return NextResponse.json({ ok: true, ...status }, { headers: { "Cache-Control": PRIVATE_CACHE } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load Google Calendar sync status") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
