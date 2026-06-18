import "server-only";

import type {
  AdviserAppointmentRow,
  AppointmentSource,
  CalendarLocationType,
  CalendarSyncStatus,
  NotificationStatus,
  PublicAppointment,
} from "@/lib/aegis/calendar";
import {
  buildAdviserScheduledAppointmentEmail,
  resolveAppointmentViewUrl,
} from "@/lib/email/appointmentNotificationEmail";
import { sendTransactionalEmail } from "@/lib/email/emailProvider";
import {
  cancelGoogleCalendarEvent,
  createGoogleCalendarEvent,
  queryGoogleFreeBusy,
  updateGoogleCalendarEvent,
} from "@/lib/google/calendarClient";
import { buildAppointmentRange } from "@/src/lib/calendar/appointmentTimes";
import {
  isSlotStillAvailable,
  resolveAppointmentType,
} from "@/src/lib/calendar/availability";

import { resolveAccessibleClient } from "./advisorClientAccess";
import { createAdminSupabaseClient } from "./admin";
import {
  getAdviserGoogleAccessToken,
  loadAdviserCalendarSettings,
} from "./calendarPersistence";
import type { AppClientRow } from "./userProfile";

type AppointmentRow = {
  id: string;
  adviser_user_id: string;
  client_user_id: string;
  client_id: string;
  appointment_type: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: PublicAppointment["status"];
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_event_url: string | null;
  client_notes: string | null;
  location_type: CalendarLocationType;
  meeting_url: string | null;
  cancelled_at: string | null;
  source: AppointmentSource;
  created_by_user_id: string | null;
  external_reference: string | null;
  external_url: string | null;
  private_adviser_note: string | null;
  phone_instructions: string | null;
  custom_meeting_link: string | null;
  location_text: string | null;
  notification_status: NotificationStatus | null;
  notification_error: string | null;
  calendar_sync_status: CalendarSyncStatus | null;
  calendar_sync_error: string | null;
  idempotency_key: string | null;
};

export type CreateAdviserAppointmentInput = {
  adviserUserId: string;
  createdByUserId: string;
  userRole: "advisor" | "admin";
  clientId: string;
  appointmentType: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  locationType: CalendarLocationType;
  locationText?: string | null;
  phoneInstructions?: string | null;
  customMeetingLink?: string | null;
  clientVisibleDescription?: string | null;
  privateAdviserNote?: string | null;
  externalReference?: string | null;
  externalUrl?: string | null;
  source: "adviser_created" | "external_import";
  syncToGoogleCalendar: boolean;
  sendClientNotification: boolean;
  confirmGoogleConflict?: boolean;
  idempotencyKey: string;
};

export type UpdateAdviserAppointmentInput = {
  appointmentId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  appointmentType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  locationType?: CalendarLocationType;
  locationText?: string | null;
  phoneInstructions?: string | null;
  customMeetingLink?: string | null;
  clientVisibleDescription?: string | null;
  privateAdviserNote?: string | null;
  externalReference?: string | null;
  externalUrl?: string | null;
  syncToGoogleCalendar?: boolean;
  sendClientNotification?: boolean;
  confirmGoogleConflict?: boolean;
};

type CreateResult =
  | {
      ok: false;
      reason:
        | "forbidden"
        | "not_found"
        | "invalid_client"
        | "conflict"
        | "google_conflict"
        | "google_unavailable"
        | "error";
      error?: string;
      googleConflicts?: Array<{ start: string; end: string }>;
    }
  | { ok: true; appointment: AdviserAppointmentRow };

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function loadBusyIntervals(
  adviserUserId: string,
  rangeStart: string,
  rangeEnd: string,
  excludeAppointmentId?: string,
): Promise<Array<{ start: string; end: string }>> {
  const admin = createAdminSupabaseClient();

  let query = admin
    .from("adviser_appointments")
    .select("id, starts_at, ends_at")
    .eq("adviser_user_id", adviserUserId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd);

  if (excludeAppointmentId) {
    query = query.neq("id", excludeAppointmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load existing appointments: ${error.message}`);
  }

  return ((data ?? []) as Array<{ starts_at: string; ends_at: string }>).map(
    (row) => ({ start: row.starts_at, end: row.ends_at }),
  );
}

function mapRowToPublic(
  row: AppointmentRow,
  appointmentLabel: string,
  adviserName?: string | null,
): PublicAppointment {
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
    source: row.source ?? "client_booking",
    scheduledByAdviser:
      row.source === "adviser_created" || row.source === "external_import",
    adviserName: adviserName ?? null,
    notificationStatus: row.notification_status,
    calendarSyncStatus: row.calendar_sync_status,
  };
}

function mapRowToAdviser(
  row: AppointmentRow,
  appointmentLabel: string,
  client: { display_name: string; email: string | null },
): AdviserAppointmentRow {
  return {
    ...mapRowToPublic(row, appointmentLabel),
    clientId: row.client_id,
    clientUserId: row.client_user_id,
    clientName: client.display_name,
    clientEmail: client.email,
    privateAdviserNote: row.private_adviser_note,
    externalReference: row.external_reference,
    externalUrl: row.external_url,
    phoneInstructions: row.phone_instructions,
    locationText: row.location_text,
    notificationError: row.notification_error,
    calendarSyncError: row.calendar_sync_error,
  };
}

async function loadClientForAppointment(
  adviserUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { ok: false; reason: "forbidden" | "not_found" }
  | { ok: true; client: AppClientRow }
> {
  const access = await resolveAccessibleClient(
    adviserUserId,
    userRole,
    clientId,
  );

  if (access.status !== "ok") {
    return { ok: false, reason: access.status };
  }

  return { ok: true, client: access.client };
}

async function resolveClientEmail(client: AppClientRow): Promise<string | null> {
  if (client.email?.trim()) {
    return client.email.trim();
  }

  if (!client.user_id) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("users")
    .select("email")
    .eq("id", client.user_id)
    .maybeSingle();

  return (data as { email?: string } | null)?.email?.trim() ?? null;
}

function resolveMeetingUrl(input: {
  locationType: CalendarLocationType;
  customMeetingLink?: string | null;
  googleHangoutLink?: string | null;
}): string | null {
  if (input.locationType === "google_meet") {
    return input.googleHangoutLink ?? null;
  }

  if (input.customMeetingLink?.trim()) {
    return input.customMeetingLink.trim();
  }

  return null;
}

async function sendAppointmentNotification(input: {
  appointmentId: string;
  clientEmail: string;
  clientName: string;
  adviserName: string;
  appointmentLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationType: CalendarLocationType;
  locationText?: string | null;
  phoneInstructions?: string | null;
  meetingUrl?: string | null;
  clientVisibleNote?: string | null;
}): Promise<{ status: NotificationStatus; error: string | null }> {
  const email = buildAdviserScheduledAppointmentEmail({
    clientName: input.clientName,
    adviserName: input.adviserName,
    appointmentLabel: input.appointmentLabel,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    timezone: input.timezone,
    locationType: input.locationType,
    locationText: input.locationText,
    phoneInstructions: input.phoneInstructions,
    meetingUrl: input.meetingUrl,
    clientVisibleNote: input.clientVisibleNote,
    viewUrl: resolveAppointmentViewUrl(),
  });

  const result = await sendTransactionalEmail({
    to: input.clientEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (!result.ok) {
    return { status: "failed", error: result.error };
  }

  return { status: "sent", error: null };
}

async function checkAegisConflict(input: {
  adviserUserId: string;
  startsAt: string;
  endsAt: string;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const settings = await loadAdviserCalendarSettings(input.adviserUserId);
  const date = input.startsAt.slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;
  const existingBusy = await loadBusyIntervals(
    input.adviserUserId,
    dayStart,
    dayEnd,
    input.excludeAppointmentId,
  );

  return !isSlotStillAvailable(
    {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: settings.timezone,
    },
    existingBusy,
    settings.bufferBeforeMinutes,
    settings.bufferAfterMinutes,
  );
}

async function checkGoogleConflict(input: {
  adviserUserId: string;
  startsAt: string;
  endsAt: string;
}): Promise<
  | { ok: false; reason: "unavailable" }
  | { ok: true; conflicts: Array<{ start: string; end: string }> }
> {
  const date = input.startsAt.slice(0, 10);
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  try {
    const { accessToken, calendarId } = await getAdviserGoogleAccessToken(
      input.adviserUserId,
    );
    const busy = await queryGoogleFreeBusy(
      accessToken,
      calendarId,
      dayStart,
      dayEnd,
    );

    const settings = await loadAdviserCalendarSettings(input.adviserUserId);
    const slotStart = new Date(input.startsAt).getTime();
    const slotEnd = new Date(input.endsAt).getTime();

    const conflicts = busy.filter((interval) => {
      const busyStart = new Date(interval.start).getTime();
      const busyEnd = new Date(interval.end).getTime();
      return isSlotStillAvailable(
        {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: settings.timezone,
        },
        [{ start: interval.start, end: interval.end }],
        settings.bufferBeforeMinutes,
        settings.bufferAfterMinutes,
      ) === false && busyStart < slotEnd && busyEnd > slotStart;
    });

    return { ok: true, conflicts };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function createAdviserAppointment(
  input: CreateAdviserAppointmentInput,
): Promise<CreateResult> {
  const clientResult = await loadClientForAppointment(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );

  if (!clientResult.ok) {
    return { ok: false, reason: clientResult.reason };
  }

  const client = clientResult.client;

  if (!client.user_id) {
    return {
      ok: false,
      reason: "invalid_client",
      error:
        "This client must complete registration before appointments can be scheduled",
    };
  }

  const range = buildAppointmentRange({
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    timezone: input.timezone,
  });

  if (!range.ok) {
    return { ok: false, reason: "error", error: range.error };
  }

  const admin = createAdminSupabaseClient();

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("adviser_appointments")
      .select("*")
      .eq("created_by_user_id", input.createdByUserId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      const settings = await loadAdviserCalendarSettings(input.adviserUserId);
      const type = resolveAppointmentType(
        settings.appointmentTypes,
        (existing as AppointmentRow).appointment_type,
      );
      return {
        ok: true,
        appointment: mapRowToAdviser(
          existing as AppointmentRow,
          type?.label ?? (existing as AppointmentRow).appointment_type,
          { display_name: client.display_name, email: client.email },
        ),
      };
    }
  }

  const settings = await loadAdviserCalendarSettings(input.adviserUserId);
  const type = resolveAppointmentType(
    settings.appointmentTypes,
    input.appointmentType,
  );

  if (!type) {
    return { ok: false, reason: "error", error: "Invalid appointment type" };
  }

  if (
    await checkAegisConflict({
      adviserUserId: input.adviserUserId,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
    })
  ) {
    return { ok: false, reason: "conflict", error: "Time slot conflicts with an existing AEGIS appointment" };
  }

  let googleConflicts: Array<{ start: string; end: string }> = [];
  if (input.syncToGoogleCalendar) {
    const googleCheck = await checkGoogleConflict({
      adviserUserId: input.adviserUserId,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
    });

    if (!googleCheck.ok) {
      return {
        ok: false,
        reason: "google_unavailable",
        error: "Google Calendar is not connected or unavailable",
      };
    }

    googleConflicts = googleCheck.conflicts;
    if (googleConflicts.length > 0 && !input.confirmGoogleConflict) {
      return {
        ok: false,
        reason: "google_conflict",
        error: "Google Calendar reports a conflict for this time",
        googleConflicts,
      };
    }
  }

  const { data: adviserUser } = await admin
    .from("users")
    .select("full_name")
    .eq("id", input.adviserUserId)
    .maybeSingle();

  const adviserName =
    (adviserUser as { full_name?: string | null } | null)?.full_name?.trim() ||
    "Your adviser";

  const clientEmail = await resolveClientEmail(client);
  const meetingLocationText =
    input.locationType === "physical"
      ? trimOrNull(input.locationText)
      : null;

  let googleEventId: string | null = null;
  let googleEventUrl: string | null = null;
  let googleCalendarId: string | null = null;
  let meetingUrl: string | null = resolveMeetingUrl({
    locationType: input.locationType,
    customMeetingLink: input.customMeetingLink,
  });
  let calendarSyncStatus: CalendarSyncStatus = input.syncToGoogleCalendar
    ? "failed"
    : "skipped";
  let calendarSyncError: string | null = null;

  if (input.syncToGoogleCalendar && clientEmail) {
    try {
      const { accessToken, calendarId } = await getAdviserGoogleAccessToken(
        input.adviserUserId,
      );
      const event = await createGoogleCalendarEvent({
        calendarId,
        accessToken,
        summary: `${type.label} with ${client.display_name}`,
        description: trimOrNull(input.clientVisibleDescription) ?? undefined,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        timezone: input.timezone,
        attendeeEmail: clientEmail,
        locationType: input.locationType,
        meetingLocationText,
      });

      googleEventId = event.id;
      googleEventUrl = event.htmlLink ?? null;
      googleCalendarId = calendarId;
      if (input.locationType === "google_meet") {
        meetingUrl = event.hangoutLink ?? meetingUrl;
      }
      calendarSyncStatus = "synced";
    } catch (err) {
      calendarSyncStatus = "failed";
      calendarSyncError =
        err instanceof Error ? err.message : "Google Calendar sync failed";

      if (!input.confirmGoogleConflict && googleConflicts.length === 0) {
        return {
          ok: false,
          reason: "google_unavailable",
          error: calendarSyncError,
        };
      }
    }
  } else if (!input.syncToGoogleCalendar) {
    calendarSyncStatus = "not_synced";
  }

  const notificationStatus: NotificationStatus | null =
    input.sendClientNotification ? "pending" : null;

  const { data: inserted, error: insertError } = await admin
    .from("adviser_appointments")
    .insert({
      adviser_user_id: input.adviserUserId,
      client_user_id: client.user_id,
      client_id: client.id,
      appointment_type: input.appointmentType,
      starts_at: range.startsAt,
      ends_at: range.endsAt,
      timezone: input.timezone,
      status: "confirmed",
      google_event_id: googleEventId,
      google_calendar_id: googleCalendarId,
      google_event_url: googleEventUrl,
      client_notes: trimOrNull(input.clientVisibleDescription),
      location_type: input.locationType,
      meeting_url: meetingUrl,
      phone_instructions: trimOrNull(input.phoneInstructions),
      custom_meeting_link: trimOrNull(input.customMeetingLink),
      location_text: meetingLocationText,
      source: input.source,
      created_by_user_id: input.createdByUserId,
      external_reference: trimOrNull(input.externalReference),
      external_url: trimOrNull(input.externalUrl),
      private_adviser_note: trimOrNull(input.privateAdviserNote),
      notification_status: notificationStatus,
      calendar_sync_status: calendarSyncStatus,
      calendar_sync_error: calendarSyncError,
      idempotency_key: input.idempotencyKey,
    } as never)
    .select("*")
    .single();

  if (insertError || !inserted) {
    if (googleEventId && googleCalendarId) {
      try {
        const { accessToken } = await getAdviserGoogleAccessToken(
          input.adviserUserId,
        );
        await cancelGoogleCalendarEvent(
          googleCalendarId,
          googleEventId,
          accessToken,
        );
      } catch {
        // compensating cleanup attempted
      }
    }

    if (insertError?.code === "23P01") {
      return { ok: false, reason: "conflict" };
    }

    return {
      ok: false,
      reason: "error",
      error: insertError?.message ?? "Failed to save appointment",
    };
  }

  const row = inserted as AppointmentRow;
  let finalNotificationStatus = row.notification_status;
  let finalNotificationError = row.notification_error;

  if (input.sendClientNotification) {
    if (!clientEmail) {
      finalNotificationStatus = "failed";
      finalNotificationError = "Client email is not on file";
    } else {
      const notification = await sendAppointmentNotification({
        appointmentId: row.id,
        clientEmail,
        clientName: client.display_name,
        adviserName,
        appointmentLabel: type.label,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        timezone: input.timezone,
        locationType: input.locationType,
        locationText: meetingLocationText,
        phoneInstructions: input.phoneInstructions,
        meetingUrl,
        clientVisibleNote: input.clientVisibleDescription,
      });

      finalNotificationStatus = notification.status;
      finalNotificationError = notification.error;

      await admin
        .from("adviser_appointments")
        .update({
          notification_status: finalNotificationStatus,
          notification_error: finalNotificationError,
        } as never)
        .eq("id", row.id);
    }
  }

  return {
    ok: true,
    appointment: mapRowToAdviser(
      {
        ...row,
        notification_status: finalNotificationStatus,
        notification_error: finalNotificationError,
      },
      type.label,
      { display_name: client.display_name, email: client.email },
    ),
  };
}

export async function updateAdviserAppointment(
  input: UpdateAdviserAppointmentInput,
): Promise<CreateResult> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load appointment: ${error.message}`);
  }

  const existing = data as AppointmentRow | null;
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  if (
    input.userRole === "advisor" &&
    existing.adviser_user_id !== input.adviserUserId
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (existing.status === "cancelled") {
    return { ok: false, reason: "error", error: "Cancelled appointments cannot be edited" };
  }

  const clientResult = await loadClientForAppointment(
    input.adviserUserId,
    input.userRole,
    existing.client_id,
  );

  if (!clientResult.ok) {
    return { ok: false, reason: clientResult.reason };
  }

  const client = clientResult.client;
  const settings = await loadAdviserCalendarSettings(existing.adviser_user_id);
  const appointmentType = input.appointmentType ?? existing.appointment_type;
  const type = resolveAppointmentType(settings.appointmentTypes, appointmentType);

  if (!type) {
    return { ok: false, reason: "error", error: "Invalid appointment type" };
  }

  const timezone = input.timezone ?? existing.timezone;
  const locationType = input.locationType ?? existing.location_type;

  let startsAt = existing.starts_at;
  let endsAt = existing.ends_at;

  if (input.date && input.startTime && input.endTime) {
    const range = buildAppointmentRange({
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone,
    });

    if (!range.ok) {
      return { ok: false, reason: "error", error: range.error };
    }

    startsAt = range.startsAt;
    endsAt = range.endsAt;
  }

  if (
    await checkAegisConflict({
      adviserUserId: existing.adviser_user_id,
      startsAt,
      endsAt,
      excludeAppointmentId: existing.id,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }

  const syncToGoogle =
    input.syncToGoogleCalendar ??
    existing.calendar_sync_status === "synced";

  if (syncToGoogle && !input.confirmGoogleConflict) {
    const googleCheck = await checkGoogleConflict({
      adviserUserId: existing.adviser_user_id,
      startsAt,
      endsAt,
    });

    if (googleCheck.ok && googleCheck.conflicts.length > 0) {
      return {
        ok: false,
        reason: "google_conflict",
        googleConflicts: googleCheck.conflicts,
      };
    }
  }

  const clientEmail = await resolveClientEmail(client);
  const meetingLocationText =
    locationType === "physical"
      ? trimOrNull(input.locationText ?? existing.location_text)
      : null;

  let googleEventId = existing.google_event_id;
  let googleEventUrl = existing.google_event_url;
  let googleCalendarId = existing.google_calendar_id;
  let meetingUrl = resolveMeetingUrl({
    locationType,
    customMeetingLink: input.customMeetingLink ?? existing.custom_meeting_link,
    googleHangoutLink: existing.meeting_url,
  });
  let calendarSyncStatus = existing.calendar_sync_status;
  let calendarSyncError = existing.calendar_sync_error;

  if (syncToGoogle && clientEmail) {
    try {
      const { accessToken, calendarId } = await getAdviserGoogleAccessToken(
        existing.adviser_user_id,
      );

      if (googleEventId && googleCalendarId) {
        const event = await updateGoogleCalendarEvent({
          eventId: googleEventId,
          calendarId: googleCalendarId,
          accessToken,
          summary: `${type.label} with ${client.display_name}`,
          description:
            trimOrNull(input.clientVisibleDescription ?? existing.client_notes) ??
            undefined,
          startsAt,
          endsAt,
          timezone,
          attendeeEmail: clientEmail,
          locationType,
          meetingLocationText,
        });
        googleEventUrl = event.htmlLink ?? googleEventUrl;
        if (locationType === "google_meet") {
          meetingUrl = event.hangoutLink ?? meetingUrl;
        }
      } else {
        const event = await createGoogleCalendarEvent({
          calendarId,
          accessToken,
          summary: `${type.label} with ${client.display_name}`,
          description:
            trimOrNull(input.clientVisibleDescription ?? existing.client_notes) ??
            undefined,
          startsAt,
          endsAt,
          timezone,
          attendeeEmail: clientEmail,
          locationType,
          meetingLocationText,
        });
        googleEventId = event.id;
        googleEventUrl = event.htmlLink ?? null;
        googleCalendarId = calendarId;
        if (locationType === "google_meet") {
          meetingUrl = event.hangoutLink ?? meetingUrl;
        }
      }

      calendarSyncStatus = "synced";
      calendarSyncError = null;
    } catch (err) {
      calendarSyncStatus = "failed";
      calendarSyncError =
        err instanceof Error ? err.message : "Google Calendar sync failed";
    }
  }

  const patch = {
    appointment_type: appointmentType,
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    location_type: locationType,
    client_notes: trimOrNull(
      input.clientVisibleDescription ?? existing.client_notes,
    ),
    private_adviser_note: trimOrNull(
      input.privateAdviserNote ?? existing.private_adviser_note,
    ),
    phone_instructions: trimOrNull(
      input.phoneInstructions ?? existing.phone_instructions,
    ),
    custom_meeting_link: trimOrNull(
      input.customMeetingLink ?? existing.custom_meeting_link,
    ),
    location_text: meetingLocationText,
    external_reference: trimOrNull(
      input.externalReference ?? existing.external_reference,
    ),
    external_url: trimOrNull(input.externalUrl ?? existing.external_url),
    google_event_id: googleEventId,
    google_calendar_id: googleCalendarId,
    google_event_url: googleEventUrl,
    meeting_url: meetingUrl,
    calendar_sync_status: calendarSyncStatus,
    calendar_sync_error: calendarSyncError,
  };

  const { data: updated, error: updateError } = await admin
    .from("adviser_appointments")
    .update(patch as never)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return {
      ok: false,
      reason: "error",
      error: updateError?.message ?? "Failed to update appointment",
    };
  }

  if (input.sendClientNotification && clientEmail) {
    const { data: adviserUser } = await admin
      .from("users")
      .select("full_name")
      .eq("id", existing.adviser_user_id)
      .maybeSingle();

    const adviserName =
      (adviserUser as { full_name?: string | null } | null)?.full_name?.trim() ||
      "Your adviser";

    const notification = await sendAppointmentNotification({
      appointmentId: existing.id,
      clientEmail,
      clientName: client.display_name,
      adviserName,
      appointmentLabel: type.label,
      startsAt,
      endsAt,
      timezone,
      locationType,
      locationText: meetingLocationText,
      phoneInstructions: patch.phone_instructions,
      meetingUrl,
      clientVisibleNote: patch.client_notes,
    });

    await admin
      .from("adviser_appointments")
      .update({
        notification_status: notification.status,
        notification_error: notification.error,
      } as never)
      .eq("id", existing.id);
  }

  return {
    ok: true,
    appointment: mapRowToAdviser(
      updated as AppointmentRow,
      type.label,
      { display_name: client.display_name, email: client.email },
    ),
  };
}

export async function retryAppointmentNotification(input: {
  appointmentId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
}): Promise<
  | { ok: false; reason: "not_found" | "forbidden" | "error"; error?: string }
  | { ok: true; notificationStatus: NotificationStatus }
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

  if (
    input.userRole === "advisor" &&
    row.adviser_user_id !== input.adviserUserId
  ) {
    return { ok: false, reason: "forbidden" };
  }

  if (row.notification_status === "sent") {
    return { ok: true, notificationStatus: "sent" };
  }

  const clientResult = await loadClientForAppointment(
    input.adviserUserId,
    input.userRole,
    row.client_id,
  );

  if (!clientResult.ok) {
    return { ok: false, reason: clientResult.reason };
  }

  const client = clientResult.client;
  const clientEmail = await resolveClientEmail(client);

  if (!clientEmail) {
    await admin
      .from("adviser_appointments")
      .update({
        notification_status: "failed",
        notification_error: "Client email is not on file",
      } as never)
      .eq("id", row.id);

    return {
      ok: false,
      reason: "error",
      error: "Client email is not on file",
    };
  }

  await admin
    .from("adviser_appointments")
    .update({
      notification_status: "retrying",
      notification_error: null,
    } as never)
    .eq("id", row.id);

  const settings = await loadAdviserCalendarSettings(row.adviser_user_id);
  const type = resolveAppointmentType(settings.appointmentTypes, row.appointment_type);
  const appointmentLabel = type?.label ?? row.appointment_type;

  const { data: adviserUser } = await admin
    .from("users")
    .select("full_name")
    .eq("id", row.adviser_user_id)
    .maybeSingle();

  const adviserName =
    (adviserUser as { full_name?: string | null } | null)?.full_name?.trim() ||
    "Your adviser";

  const notification = await sendAppointmentNotification({
    appointmentId: row.id,
    clientEmail,
    clientName: client.display_name,
    adviserName,
    appointmentLabel,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    locationType: row.location_type,
    locationText: row.location_text,
    phoneInstructions: row.phone_instructions,
    meetingUrl: row.meeting_url,
    clientVisibleNote: row.client_notes,
  });

  await admin
    .from("adviser_appointments")
    .update({
      notification_status: notification.status,
      notification_error: notification.error,
    } as never)
    .eq("id", row.id);

  if (notification.status === "failed") {
    return {
      ok: false,
      reason: "error",
      error: notification.error ?? "Notification failed",
    };
  }

  return { ok: true, notificationStatus: notification.status };
}
