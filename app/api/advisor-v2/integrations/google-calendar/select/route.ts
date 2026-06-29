import { NextResponse } from "next/server";

import { assertCrmV2GoogleCalendarAccess } from "@/lib/crm-v2/access";
import { selectGoogleCalendarForAdviser } from "@/lib/crm-v2/google-calendar/service";
import { parseJsonBodySafely, rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";

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

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const calendarId = typeof body.calendarId === "string" ? body.calendarId.trim() : "";
    if (!calendarId) {
      return NextResponse.json({ ok: false, error: "calendarId is required" }, { status: 400 });
    }

    await selectGoogleCalendarForAdviser({ adviserUserId: access.authUser.id, calendarId });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": PRIVATE_CACHE } });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to select calendar") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
