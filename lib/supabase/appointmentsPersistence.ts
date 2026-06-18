import "server-only";

import type {
  AdviserAppointmentRow,
  AppointmentStatus,
  AvailabilitySlot,
  CalendarLocationType,
  PublicAppointment,
} from "@/lib/aegis/calendar";
import {
  createGoogleCalendarEvent,
  cancelGoogleCalendarEvent,
  queryGoogleFreeBusy,
} from "@/lib/google/calendarClient";
import {
  generateAvailabilitySlots,
  isSlotStillAvailable,
  resolveAppointmentType,
} from "@/src/lib/calendar/availability";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getAdviserGoogleAccessToken,
  isAdviserBookingReady,
  loadAdviserCalendarSettings,
} from "@/lib/supabase/calendarPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

type AppointmentRow = {
  id: string;
  adviser_user_id: string;
  client_user_id: string;
  client_id: string;
  appointment_type: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: AppointmentStatus;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_event_url: string | null;
  client_notes: string | null;
  location_type: CalendarLocationType;
  meeting_url: string | null;
  cancelled_at: string | null;
  source?: import("@/lib/aegis/calendar").AppointmentSource;
  created_by_user_id?: string | null;
  external_reference?: string | null;
  external_url?: string | null;
  private_adviser_note?: string | null;
  phone_instructions?: string | null;
  custom_meeting_link?: string | null;
  location_text?: string | null;
  notification_status?: import("@/lib/aegis/calendar").NotificationStatus | null;
  notification_error?: string | null;
  calendar_sync_status?: import("@/lib/aegis/calendar").CalendarSyncStatus | null;
  calendar_sync_error?: string | null;
};

function mapPublicAppointment(
  row: AppointmentRow,
  appointmentLabel: string,
  adviserName?: string | null,
): PublicAppointment {
  const source = row.source ?? "client_booking";
  return {
    id: row.id,
    appointmentType: row.appointment_type,
    appointmentLabel,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    status: row.status,
    locationType: row.location_type,
    meetingUrl: row.meeting_url,
    googleEventUrl: row.google_event_url,
    clientNotes: row.client_notes,
    cancelledAt: row.cancelled_at,
    source,
    scheduledByAdviser:
      source === "adviser_created" || source === "external_import",
    adviserName: adviserName ?? null,
    notificationStatus: row.notification_status ?? null,
    calendarSyncStatus: row.calendar_sync_status ?? null,
  };
}

async function loadBusyIntervals(
  adviserUserId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<Array<{ start: string; end: string }>> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("adviser_appointments")
    .select("starts_at, ends_at")
    .eq("adviser_user_id", adviserUserId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd);

  if (error) {
    throw new Error(`Failed to load existing appointments: ${error.message}`);
  }

  return ((data ?? []) as Array<{ starts_at: string; ends_at: string }>).map(
    (row) => ({ start: row.starts_at, end: row.ends_at }),
  );
}

export async function getClientAssignedAdviserId(): Promise<
  | { ok: false; reason: "unauthenticated" | "unassigned" }
  | { ok: true; adviserUserId: string; clientId: string; clientUserId: string; clientEmail: string }
> {
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const adviserUserId = session.client.advisor_user_id;
  if (!adviserUserId) {
    return { ok: false, reason: "unassigned" };
  }

  return {
    ok: true,
    adviserUserId,
    clientId: session.client.id,
    clientUserId: session.authUser.id,
    clientEmail: session.user.email,
  };
}

export async function listAvailabilityForAssignedAdviser(input: {
  date: string;
  appointmentType: string;
}): Promise<
  | { ok: false; reason: "unauthenticated" | "unassigned" | "unavailable" }
  | { ok: true; slots: AvailabilitySlot[]; timezone: string }
> {
  const assignment = await getClientAssignedAdviserId();
  if (!assignment.ok) {
    return { ok: false, reason: assignment.reason };
  }

  const ready = await isAdviserBookingReady(assignment.adviserUserId);
  if (!ready) {
    return { ok: false, reason: "unavailable" };
  }

  const settings = await loadAdviserCalendarSettings(assignment.adviserUserId);
  const type = resolveAppointmentType(
    settings.appointmentTypes,
    input.appointmentType,
  );
  if (!type) {
    return { ok: true, slots: [], timezone: settings.timezone };
  }

  const dayStart = `${input.date}T00:00:00.000Z`;
  const dayEnd = `${input.date}T23:59:59.999Z`;
  const existingBusy = await loadBusyIntervals(
    assignment.adviserUserId,
    dayStart,
    dayEnd,
  );

  let googleBusy: Array<{ start: string; end: string }> = [];
  try {
    const { accessToken, calendarId } = await getAdviserGoogleAccessToken(
      assignment.adviserUserId,
    );
    googleBusy = await queryGoogleFreeBusy(
      accessToken,
      calendarId,
      dayStart,
      dayEnd,
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const slots = generateAvailabilitySlots({
    date: input.date,
    timezone: settings.timezone,
    workingHours: settings.workingHours,
    blackoutDates: settings.blackoutDates,
    appointmentDurationMinutes: type.durationMinutes,
    bufferBeforeMinutes: settings.bufferBeforeMinutes,
    bufferAfterMinutes: settings.bufferAfterMinutes,
    minimumNoticeHours: settings.minimumNoticeHours,
    bookingHorizonDays: settings.bookingHorizonDays,
    existingBusy,
    googleBusy,
  });

  return { ok: true, slots, timezone: settings.timezone };
}

export type BookAppointmentInput = {
  appointmentType: string;
  startsAt: string;
  endsAt: string;
  clientNotes?: string | null;
  idempotencyKey: string;
};

export async function bookAppointmentForAssignedAdviser(
  input: BookAppointmentInput,
): Promise<
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "unassigned"
        | "unavailable"
        | "conflict"
        | "error";
      error?: string;
    }
  | { ok: true; appointment: PublicAppointment }
> {
  const assignment = await getClientAssignedAdviserId();
  if (!assignment.ok) {
    return { ok: false, reason: assignment.reason };
  }

  const ready = await isAdviserBookingReady(assignment.adviserUserId);
  if (!ready) {
    return { ok: false, reason: "unavailable" };
  }

  const admin = createAdminSupabaseClient();

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("adviser_appointments")
      .select("*")
      .eq("client_user_id", assignment.clientUserId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      const settings = await loadAdviserCalendarSettings(
        assignment.adviserUserId,
      );
      const type = resolveAppointmentType(
        settings.appointmentTypes,
        (existing as AppointmentRow).appointment_type,
      );
      return {
        ok: true,
        appointment: mapPublicAppointment(
          existing as AppointmentRow,
          type?.label ?? (existing as AppointmentRow).appointment_type,
        ),
      };
    }
  }

  const settings = await loadAdviserCalendarSettings(assignment.adviserUserId);
  const type = resolveAppointmentType(
    settings.appointmentTypes,
    input.appointmentType,
  );
  if (!type) {
    return { ok: false, reason: "error", error: "Invalid appointment type" };
  }

  const date = input.startsAt.slice(0, 10);
  const availability = await listAvailabilityForAssignedAdviser({
    date,
    appointmentType: input.appointmentType,
  });

  if (!availability.ok) {
    return { ok: false, reason: availability.reason };
  }

  const slot = availability.slots.find(
    (item) => item.startsAt === input.startsAt && item.endsAt === input.endsAt,
  );
  if (!slot) {
    return { ok: false, reason: "conflict" };
  }

  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const existingBusy = await loadBusyIntervals(
    assignment.adviserUserId,
    dayStart,
    dayEnd,
  );

  let googleBusy: Array<{ start: string; end: string }> = [];
  let accessToken = "";
  let calendarId = "";

  try {
    const token = await getAdviserGoogleAccessToken(assignment.adviserUserId);
    accessToken = token.accessToken;
    calendarId = token.calendarId;
    googleBusy = await queryGoogleFreeBusy(
      accessToken,
      calendarId,
      dayStart,
      dayEnd,
    );
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const allBusy = [...existingBusy, ...googleBusy];
  if (
    !isSlotStillAvailable(
      slot,
      allBusy,
      settings.bufferBeforeMinutes,
      settings.bufferAfterMinutes,
    )
  ) {
    return { ok: false, reason: "conflict" };
  }

  const { data: adviserUser } = await admin
    .from("users")
    .select("full_name")
    .eq("id", assignment.adviserUserId)
    .maybeSingle();

  const adviserName =
    (adviserUser as { full_name?: string | null } | null)?.full_name?.trim() ||
    "Your adviser";

  let googleEventId: string | null = null;
  let googleEventUrl: string | null = null;
  let meetingUrl: string | null = null;

  try {
    const event = await createGoogleCalendarEvent({
      calendarId,
      accessToken,
      summary: `${type.label} with ${adviserName}`,
      description: input.clientNotes?.trim() || undefined,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: settings.timezone,
      attendeeEmail: assignment.clientEmail,
      locationType: settings.locationType,
      meetingLocationText: settings.meetingLocationText,
    });

    googleEventId = event.id;
    googleEventUrl = event.htmlLink ?? null;
    meetingUrl = event.hangoutLink ?? null;
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : "Calendar event failed",
    };
  }

  const { data: inserted, error: insertError } = await admin
    .from("adviser_appointments")
    .insert({
      adviser_user_id: assignment.adviserUserId,
      client_user_id: assignment.clientUserId,
      client_id: assignment.clientId,
      appointment_type: input.appointmentType,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      timezone: settings.timezone,
      status: "confirmed",
      google_event_id: googleEventId,
      google_calendar_id: calendarId,
      google_event_url: googleEventUrl,
      client_notes: input.clientNotes?.trim() || null,
      location_type: settings.locationType,
      meeting_url: meetingUrl,
      idempotency_key: input.idempotencyKey,
      source: "client_booking",
      created_by_user_id: assignment.clientUserId,
      calendar_sync_status: "synced",
    } as never)
    .select("*")
    .single();

  if (insertError) {
    try {
      if (googleEventId) {
        await cancelGoogleCalendarEvent(calendarId, googleEventId, accessToken);
      }
    } catch {
      // Logged server-side; appointment row failed so event cleanup attempted.
    }

    if (insertError.code === "23P01") {
      return { ok: false, reason: "conflict" };
    }

    return {
      ok: false,
      reason: "error",
      error: insertError.message,
    };
  }

  return {
    ok: true,
    appointment: mapPublicAppointment(
      inserted as AppointmentRow,
      type.label,
    ),
  };
}

export async function listClientUpcomingAppointments(): Promise<
  | { ok: false; reason: "unauthenticated" }
  | { ok: true; appointments: PublicAppointment[] }
> {
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { ok: false, reason: "unauthenticated" };
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("client_user_id", session.authUser.id)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to load appointments: ${error.message}`);
  }

  const adviserUserId = session.client.advisor_user_id;
  let settings = null;
  let adviserName: string | null = null;

  if (adviserUserId) {
    settings = await loadAdviserCalendarSettings(adviserUserId);
    const admin = createAdminSupabaseClient();
    const { data: adviserUser } = await admin
      .from("users")
      .select("full_name")
      .eq("id", adviserUserId)
      .maybeSingle();
    adviserName =
      (adviserUser as { full_name?: string | null } | null)?.full_name?.trim() ??
      null;
  }

  const appointments = ((data ?? []) as AppointmentRow[]).map((row) => {
    const type = settings
      ? resolveAppointmentType(settings.appointmentTypes, row.appointment_type)
      : null;
    return mapPublicAppointment(
      row,
      type?.label ?? row.appointment_type,
      adviserName,
    );
  });

  return { ok: true, appointments };
}

export async function listAdviserAppointments(
  adviserUserId: string,
): Promise<AdviserAppointmentRow[]> {
  const admin = createAdminSupabaseClient();
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - 7);

  const { data, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("adviser_user_id", adviserUserId)
    .gte("starts_at", rangeStart.toISOString())
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load adviser appointments: ${error.message}`);
  }

  const rows = (data ?? []) as AppointmentRow[];
  const clientIds = [...new Set(rows.map((row) => row.client_id))];
  const clientsById = new Map<string, { display_name: string; email: string | null }>();

  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await admin
      .from("clients")
      .select("id, display_name, email")
      .in("id", clientIds);

    if (clientsError) {
      throw new Error(`Failed to load appointment clients: ${clientsError.message}`);
    }

    for (const client of (clients ?? []) as Array<{
      id: string;
      display_name: string;
      email: string | null;
    }>) {
      clientsById.set(client.id, {
        display_name: client.display_name,
        email: client.email,
      });
    }
  }

  const settings = await loadAdviserCalendarSettings(adviserUserId);

  return rows.map((row) => {
    const type = resolveAppointmentType(
      settings.appointmentTypes,
      row.appointment_type,
    );
    const client = clientsById.get(row.client_id);
    return {
      ...mapPublicAppointment(row, type?.label ?? row.appointment_type),
      clientId: row.client_id,
      clientUserId: row.client_user_id,
      clientName: client?.display_name ?? null,
      clientEmail: client?.email ?? null,
      privateAdviserNote: row.private_adviser_note ?? null,
      externalReference: row.external_reference ?? null,
      externalUrl: row.external_url ?? null,
      phoneInstructions: row.phone_instructions ?? null,
      locationText: row.location_text ?? null,
      notificationError: row.notification_error ?? null,
      calendarSyncError: row.calendar_sync_error ?? null,
    };
  });
}

export async function cancelAppointment(input: {
  appointmentId: string;
  actorUserId: string;
  isAdviser: boolean;
}): Promise<
  | { ok: false; reason: "not_found" | "forbidden" | "error"; error?: string }
  | { ok: true }
> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load appointment: ${error.message}`);
  }

  const row = data as AppointmentRow | null;
  if (!row) {
    return { ok: false, reason: "not_found" };
  }

  const allowed =
    row.client_user_id === input.actorUserId ||
    (input.isAdviser && row.adviser_user_id === input.actorUserId);

  if (!allowed) {
    return { ok: false, reason: "forbidden" };
  }

  if (row.status === "cancelled") {
    return { ok: true };
  }

  if (row.google_event_id && row.google_calendar_id) {
    try {
      const { accessToken } = await getAdviserGoogleAccessToken(
        row.adviser_user_id,
      );
      await cancelGoogleCalendarEvent(
        row.google_calendar_id,
        row.google_event_id,
        accessToken,
      );
    } catch {
      // Continue marking cancelled in AEGIS even if Google delete fails.
    }
  }

  const { error: updateError } = await admin
    .from("adviser_appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    } as never)
    .eq("id", input.appointmentId);

  if (updateError) {
    return { ok: false, reason: "error", error: updateError.message };
  }

  return { ok: true };
}
