import "server-only";

import type {
  AdviserCalendarSettings,
  AppointmentTypeOption,
  CalendarConnectionStatus,
  CalendarLocationType,
  WorkingHoursConfig,
} from "@/lib/aegis/calendar";
import {
  DEFAULT_APPOINTMENT_TYPES,
  DEFAULT_WORKING_HOURS,
} from "@/lib/aegis/calendar";
import {
  decryptGoogleToken,
  encryptGoogleToken,
  listWritableCalendars,
  refreshGoogleAccessToken,
  revokeGoogleRefreshToken,
} from "@/lib/google/calendarClient";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ConnectionRow = {
  adviser_user_id: string;
  encrypted_refresh_token: string;
  encrypted_access_token: string | null;
  access_token_expires_at: string | null;
  calendar_id: string | null;
  calendar_email: string | null;
  connected_at: string;
  revoked_at: string | null;
};

type SettingsRow = {
  adviser_user_id: string;
  timezone: string;
  appointment_duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  minimum_notice_hours: number;
  booking_horizon_days: number;
  location_type: CalendarLocationType;
  meeting_location_text: string | null;
  appointment_types: AppointmentTypeOption[];
  working_hours: WorkingHoursConfig;
  blackout_dates: string[];
};

function mapSettingsRow(
  row: SettingsRow | null,
  bookingEnabled: boolean,
): AdviserCalendarSettings {
  return {
    timezone: row?.timezone ?? "Asia/Singapore",
    appointmentDurationMinutes: row?.appointment_duration_minutes ?? 60,
    bufferBeforeMinutes: row?.buffer_before_minutes ?? 15,
    bufferAfterMinutes: row?.buffer_after_minutes ?? 15,
    minimumNoticeHours: row?.minimum_notice_hours ?? 24,
    bookingHorizonDays: row?.booking_horizon_days ?? 60,
    locationType: row?.location_type ?? "google_meet",
    meetingLocationText: row?.meeting_location_text ?? null,
    appointmentTypes: row?.appointment_types ?? DEFAULT_APPOINTMENT_TYPES,
    workingHours: row?.working_hours ?? DEFAULT_WORKING_HOURS,
    blackoutDates: row?.blackout_dates ?? [],
    bookingEnabled,
  };
}

export async function getCalendarConnectionStatus(
  adviserUserId: string,
): Promise<CalendarConnectionStatus> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_calendar_connections")
    .select(
      "calendar_id, calendar_email, connected_at, revoked_at",
    )
    .eq("adviser_user_id", adviserUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calendar connection: ${error.message}`);
  }

  const row = data as Pick<
    ConnectionRow,
    "calendar_id" | "calendar_email" | "connected_at" | "revoked_at"
  > | null;

  return {
    connected: Boolean(row && !row.revoked_at),
    calendarId: row?.calendar_id ?? null,
    calendarEmail: row?.calendar_email ?? null,
    connectedAt: row?.connected_at ?? null,
    revoked: Boolean(row?.revoked_at),
  };
}

export async function loadAdviserCalendarSettings(
  adviserUserId: string,
): Promise<AdviserCalendarSettings> {
  const admin = createAdminSupabaseClient();

  const [settingsResult, profileResult] = await Promise.all([
    admin
      .from("adviser_calendar_settings")
      .select("*")
      .eq("adviser_user_id", adviserUserId)
      .maybeSingle(),
    admin
      .from("adviser_profiles")
      .select("booking_enabled")
      .eq("adviser_user_id", adviserUserId)
      .maybeSingle(),
  ]);

  if (settingsResult.error) {
    throw new Error(
      `Failed to load calendar settings: ${settingsResult.error.message}`,
    );
  }

  const bookingEnabled =
    (profileResult.data as { booking_enabled?: boolean } | null)
      ?.booking_enabled ?? false;

  return mapSettingsRow(
    settingsResult.data as SettingsRow | null,
    bookingEnabled,
  );
}

export async function ensureDefaultCalendarSettings(
  adviserUserId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("adviser_calendar_settings").upsert(
    {
      adviser_user_id: adviserUserId,
    } as never,
    { onConflict: "adviser_user_id", ignoreDuplicates: true },
  );

  if (error) {
    throw new Error(`Failed to ensure calendar settings: ${error.message}`);
  }
}

export type CalendarSettingsUpdate = Partial<{
  timezone: string;
  appointmentDurationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minimumNoticeHours: number;
  bookingHorizonDays: number;
  locationType: CalendarLocationType;
  meetingLocationText: string | null;
  appointmentTypes: AppointmentTypeOption[];
  workingHours: WorkingHoursConfig;
  blackoutDates: string[];
  calendarId: string;
  calendarEmail: string | null;
  bookingEnabled: boolean;
}>;

export async function upsertAdviserCalendarSettings(
  adviserUserId: string,
  input: CalendarSettingsUpdate,
): Promise<AdviserCalendarSettings> {
  const admin = createAdminSupabaseClient();
  await ensureDefaultCalendarSettings(adviserUserId);

  const settingsPayload: Record<string, unknown> = {
    adviser_user_id: adviserUserId,
  };

  if (input.timezone !== undefined) settingsPayload.timezone = input.timezone;
  if (input.appointmentDurationMinutes !== undefined) {
    settingsPayload.appointment_duration_minutes =
      input.appointmentDurationMinutes;
  }
  if (input.bufferBeforeMinutes !== undefined) {
    settingsPayload.buffer_before_minutes = input.bufferBeforeMinutes;
  }
  if (input.bufferAfterMinutes !== undefined) {
    settingsPayload.buffer_after_minutes = input.bufferAfterMinutes;
  }
  if (input.minimumNoticeHours !== undefined) {
    settingsPayload.minimum_notice_hours = input.minimumNoticeHours;
  }
  if (input.bookingHorizonDays !== undefined) {
    settingsPayload.booking_horizon_days = input.bookingHorizonDays;
  }
  if (input.locationType !== undefined) {
    settingsPayload.location_type = input.locationType;
  }
  if (input.meetingLocationText !== undefined) {
    settingsPayload.meeting_location_text = input.meetingLocationText;
  }
  if (input.appointmentTypes !== undefined) {
    settingsPayload.appointment_types = input.appointmentTypes;
  }
  if (input.workingHours !== undefined) {
    settingsPayload.working_hours = input.workingHours;
  }
  if (input.blackoutDates !== undefined) {
    settingsPayload.blackout_dates = input.blackoutDates;
  }

  if (Object.keys(settingsPayload).length > 1) {
    const { error } = await admin
      .from("adviser_calendar_settings")
      .upsert(settingsPayload as never, { onConflict: "adviser_user_id" });

    if (error) {
      throw new Error(`Failed to save calendar settings: ${error.message}`);
    }
  }

  if (input.calendarId !== undefined || input.calendarEmail !== undefined) {
    const connectionUpdate: Record<string, unknown> = {
      adviser_user_id: adviserUserId,
      revoked_at: null,
    };
    if (input.calendarId !== undefined) {
      connectionUpdate.calendar_id = input.calendarId;
    }
    if (input.calendarEmail !== undefined) {
      connectionUpdate.calendar_email = input.calendarEmail;
    }

    const { error } = await admin
      .from("adviser_calendar_connections")
      .update(connectionUpdate as never)
      .eq("adviser_user_id", adviserUserId)
      .is("revoked_at", null);

    if (error) {
      throw new Error(`Failed to update calendar selection: ${error.message}`);
    }
  }

  if (input.bookingEnabled !== undefined) {
    const profilePayload: Record<string, unknown> = {
      adviser_user_id: adviserUserId,
      booking_enabled: input.bookingEnabled,
    };

    if (input.bookingEnabled) {
      const status = await getCalendarConnectionStatus(adviserUserId);
      if (!status.connected) {
        throw new Error(
          "Connect Google Calendar before enabling client booking",
        );
      }
      profilePayload.calendar_connected = true;
    }

    const { error } = await admin
      .from("adviser_profiles")
      .upsert(profilePayload as never, { onConflict: "adviser_user_id" });

    if (error) {
      throw new Error(`Failed to update booking flag: ${error.message}`);
    }
  }

  return loadAdviserCalendarSettings(adviserUserId);
}

export async function saveGoogleCalendarConnection(input: {
  adviserUserId: string;
  refreshToken: string;
  accessToken: string;
  expiresIn: number;
  scopes: string[];
  calendarId?: string | null;
  calendarEmail?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString();

  const { error } = await admin.from("adviser_calendar_connections").upsert(
    {
      adviser_user_id: input.adviserUserId,
      provider: "google",
      encrypted_refresh_token: encryptGoogleToken(input.refreshToken),
      encrypted_access_token: encryptGoogleToken(input.accessToken),
      access_token_expires_at: expiresAt,
      calendar_id: input.calendarId ?? "primary",
      calendar_email: input.calendarEmail ?? null,
      scopes: input.scopes,
      connected_at: new Date().toISOString(),
      revoked_at: null,
    } as never,
    { onConflict: "adviser_user_id" },
  );

  if (error) {
    throw new Error(`Failed to save calendar connection: ${error.message}`);
  }

  await ensureDefaultCalendarSettings(input.adviserUserId);

  await admin
    .from("adviser_profiles")
    .upsert(
      {
        adviser_user_id: input.adviserUserId,
        calendar_connected: true,
      } as never,
      { onConflict: "adviser_user_id" },
    );
}

export async function disconnectGoogleCalendar(
  adviserUserId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_calendar_connections")
    .select("encrypted_refresh_token")
    .eq("adviser_user_id", adviserUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calendar connection: ${error.message}`);
  }

  if (data) {
    try {
      const refreshToken = decryptGoogleToken(
        (data as Pick<ConnectionRow, "encrypted_refresh_token">)
          .encrypted_refresh_token,
      );
      await revokeGoogleRefreshToken(refreshToken);
    } catch {
      // Revocation may fail if already revoked — continue local disconnect.
    }
  }

  const { error: updateError } = await admin
    .from("adviser_calendar_connections")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("adviser_user_id", adviserUserId);

  if (updateError) {
    throw new Error(`Failed to disconnect calendar: ${updateError.message}`);
  }

  await admin
    .from("adviser_profiles")
    .update({
      calendar_connected: false,
      booking_enabled: false,
    } as never)
    .eq("adviser_user_id", adviserUserId);
}

export async function getAdviserGoogleAccessToken(
  adviserUserId: string,
): Promise<{ accessToken: string; calendarId: string }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_calendar_connections")
    .select("*")
    .eq("adviser_user_id", adviserUserId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load calendar tokens: ${error.message}`);
  }

  const row = data as ConnectionRow | null;
  if (!row?.encrypted_refresh_token || !row.calendar_id) {
    throw new Error("Google Calendar is not connected");
  }

  const refreshToken = decryptGoogleToken(row.encrypted_refresh_token);
  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at).getTime()
    : 0;

  if (
    row.encrypted_access_token &&
    expiresAt > Date.now() + 60_000
  ) {
    return {
      accessToken: decryptGoogleToken(row.encrypted_access_token),
      calendarId: row.calendar_id,
    };
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken);
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000,
  ).toISOString();

  const { error: updateError } = await admin
    .from("adviser_calendar_connections")
    .update({
      encrypted_access_token: encryptGoogleToken(refreshed.access_token),
      access_token_expires_at: newExpiresAt,
    } as never)
    .eq("adviser_user_id", adviserUserId);

  if (updateError) {
    throw new Error(`Failed to refresh calendar token: ${updateError.message}`);
  }

  return {
    accessToken: refreshed.access_token,
    calendarId: row.calendar_id,
  };
}

export async function listAdviserWritableCalendars(
  adviserUserId: string,
): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const { accessToken } = await getAdviserGoogleAccessToken(adviserUserId);
  const calendars = await listWritableCalendars(accessToken);

  return calendars.map((item) => ({
    id: item.id,
    summary: item.summary,
    primary: Boolean(item.primary),
  }));
}

export async function isAdviserBookingReady(
  adviserUserId: string,
): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_profiles")
    .select("booking_enabled, calendar_connected")
    .eq("adviser_user_id", adviserUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check booking readiness: ${error.message}`);
  }

  const profile = data as {
    booking_enabled?: boolean;
    calendar_connected?: boolean;
  } | null;

  if (!profile?.booking_enabled || !profile.calendar_connected) {
    return false;
  }

  const status = await getCalendarConnectionStatus(adviserUserId);
  return status.connected && Boolean(status.calendarId);
}
