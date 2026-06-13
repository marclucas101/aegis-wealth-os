import { NextResponse } from "next/server";

import { buildGoogleAuthorizeUrl } from "@/lib/google/calendarClient";
import { isGoogleCalendarConfigured } from "@/lib/google/env";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    if (!isGoogleCalendarConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Google Calendar integration is not configured on this environment",
        },
        { status: 503 },
      );
    }

    const origin = new URL(request.url).origin;
    const authorizeUrl = buildGoogleAuthorizeUrl(access.authUser.id, origin);
    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to start Google OAuth");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
