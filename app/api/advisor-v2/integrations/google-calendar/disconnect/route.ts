import { NextResponse } from "next/server";

import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { disconnectAdviserGoogleCalendar } from "@/lib/crm-v2/google-calendar/service";
import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
const PRIVATE_CACHE = "private, no-store";

export async function POST(request: Request): Promise<NextResponse> {
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

    await disconnectAdviserGoogleCalendar({
      adviserUserId: access.authUser.id,
      requestId: access.requestId,
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": PRIVATE_CACHE } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to disconnect calendar") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
