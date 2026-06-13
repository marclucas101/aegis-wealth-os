import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { listAvailabilityForAssignedAdviser } from "@/lib/supabase/appointmentsPersistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const appointmentType = url.searchParams.get("appointmentType") ?? "review";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false, error: "Valid date query parameter is required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const result = await listAvailabilityForAssignedAdviser({
      date,
      appointmentType,
    });

    if (!result.ok) {
      const status =
        result.reason === "unauthenticated"
          ? 401
          : result.reason === "unassigned"
            ? 404
            : 503;
      return NextResponse.json({ ok: false, reason: result.reason }, { status });
    }

    return NextResponse.json({
      ok: true,
      slots: result.slots,
      timezone: result.timezone,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load availability");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
