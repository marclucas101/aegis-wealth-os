import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { listClientUpcomingAppointments } from "@/lib/supabase/appointmentsPersistence";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const result = await listClientUpcomingAppointments();
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        { status: 401 },
      );
    }

    return NextResponse.json({
      ok: true,
      appointments: result.appointments,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load appointments");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
