import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  rateLimitOrThrow,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { disconnectGoogleCalendar } from "@/lib/supabase/calendarPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
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

    await disconnectGoogleCalendar(access.authUser.id);

    const { ip_address, user_agent } = getRequestMetadata(request);
    await writeAuditLog({
      userId: access.authUser.id,
      action: "adviser_calendar_disconnected",
      entityType: "adviser_calendar_connections",
      entityId: access.authUser.id,
      ipAddress: ip_address,
      userAgent: user_agent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to disconnect calendar");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
