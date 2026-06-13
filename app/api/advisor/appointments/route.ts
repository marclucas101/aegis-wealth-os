import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { listAdviserAppointments } from "@/lib/supabase/appointmentsPersistence";

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

    const appointments = await listAdviserAppointments(access.authUser.id);
    return NextResponse.json({ ok: true, appointments });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load appointments");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
