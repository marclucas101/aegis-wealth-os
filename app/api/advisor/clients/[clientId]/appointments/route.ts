import { NextResponse } from "next/server";

import type { AdviserAppointmentRow } from "@/lib/aegis/calendar";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadAdviserCalendarSettings } from "@/lib/supabase/calendarPersistence";
import { resolveAppointmentType } from "@/src/lib/calendar/availability";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const { clientId } = await context.params;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      clientId,
    );

    if (resolved.status === "not_found") {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    if (resolved.status === "forbidden") {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const admin = createAdminSupabaseClient();
    const now = new Date().toISOString();

    const { data, error } = await admin
      .from("adviser_appointments")
      .select("*")
      .eq("client_id", clientId)
      .gte("starts_at", now)
      .in("status", ["pending", "confirmed"])
      .order("starts_at", { ascending: true })
      .limit(20);

    if (error) {
      throw new Error(`Failed to load client appointments: ${error.message}`);
    }

    const adviserUserId = resolved.client.advisor_user_id;
    let settings = null;
    if (adviserUserId) {
      settings = await loadAdviserCalendarSettings(adviserUserId);
    }

    const appointments = ((data ?? []) as Array<{
      id: string;
      appointment_type: string;
      starts_at: string;
      ends_at: string;
      timezone: string;
      status: AdviserAppointmentRow["status"];
      location_type: AdviserAppointmentRow["locationType"];
      meeting_url: string | null;
      google_event_url: string | null;
      client_notes: string | null;
      cancelled_at: string | null;
    }>).map((row) => {
      const type = settings
        ? resolveAppointmentType(settings.appointmentTypes, row.appointment_type)
        : null;
      return {
        id: row.id,
        appointmentType: row.appointment_type,
        appointmentLabel: type?.label ?? row.appointment_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        timezone: row.timezone,
        status: row.status,
        locationType: row.location_type,
        meetingUrl: row.meeting_url,
        googleEventUrl: row.google_event_url,
        clientNotes: row.client_notes,
        cancelledAt: row.cancelled_at,
      };
    });

    return NextResponse.json({ ok: true, appointments });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load appointments");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
