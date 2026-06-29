import { NextResponse } from "next/server";

import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { listGoogleCalendarsForAdviser } from "@/lib/crm-v2/google-calendar/service";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await assertCrmV2GoogleCalendarAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403, headers: { "Cache-Control": PRIVATE_CACHE } },
      );
    }

    const calendars = await listGoogleCalendarsForAdviser(access.authUser.id);
    return NextResponse.json({ ok: true, calendars }, { headers: { "Cache-Control": PRIVATE_CACHE } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load writable calendars") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
