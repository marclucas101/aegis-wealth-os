import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  getCalendarConnectionStatus,
  loadAdviserCalendarSettings,
  listAdviserWritableCalendars,
} from "@/lib/supabase/calendarPersistence";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const [connection, settings] = await Promise.all([
      getCalendarConnectionStatus(access.authUser.id),
      loadAdviserCalendarSettings(access.authUser.id),
    ]);

    let calendars: Array<{ id: string; summary: string; primary: boolean }> = [];
    if (connection.connected) {
      try {
        calendars = await listAdviserWritableCalendars(access.authUser.id);
      } catch {
        calendars = [];
      }
    }

    return NextResponse.json({
      ok: true,
      connection,
      settings,
      calendars,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load calendar status");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
