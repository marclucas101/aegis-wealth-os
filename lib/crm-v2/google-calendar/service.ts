import "server-only";

import { createHash } from "node:crypto";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  disconnectGoogleCalendar,
  getAdviserGoogleAccessToken,
  getCalendarConnectionStatus,
  listAdviserWritableCalendars,
  upsertAdviserCalendarSettings,
} from "@/lib/supabase/calendarPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { providerCancelEvent, providerCreateEvent, providerUpdateEvent } from "@/lib/crm-v2/google-calendar/provider";
import { resolveAuthorizedAppointment } from "@/lib/crm-v2/appointments/identity";

type AppointmentRow = {
  id: string;
  adviser_user_id: string;
  client_id: string;
  client_user_id: string;
  title: string | null;
  appointment_type: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location_type: "physical" | "phone" | "google_meet";
  location_text: string | null;
  crm_lifecycle_status: string | null;
  version: number;
  status: string;
  meeting_url: string | null;
};

type MappingRow = {
  id: string;
  appointment_id: string;
  adviser_user_id: string;
  connection_calendar_id: string;
  google_event_id: string;
  provider_event_etag: string | null;
  sync_status: string;
  last_attempted_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_aegis_version_synced: number | null;
  last_provider_modified_at: string | null;
  retry_count: number;
  safe_error_code: string | null;
  disconnected_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const ELIGIBLE_SYNC_LIFECYCLE = new Set([
  "confirmed",
  "preparing",
  "ready",
  "in_progress",
  "follow_up_required",
  "rescheduled",
]);

const CANCELLATION_SYNC_LIFECYCLE = new Set([
  "cancelled_by_adviser",
  "cancelled_by_client",
  "no_show",
]);

function lifecycleOf(row: AppointmentRow): string {
  return row.crm_lifecycle_status ?? row.status;
}

function safeGoogleSummary(row: AppointmentRow): string {
  return (row.title?.trim() || `AEGIS ${row.appointment_type}`).slice(0, 120);
}

function safeGoogleDescription(): string {
  return "Managed in AEGIS. Open the secure appointment workspace for preparation and details.";
}

function stableConferenceRequestId(appointmentId: string): string {
  const digest = createHash("sha256").update(`aegis-meet-${appointmentId}`).digest("hex");
  return `aegis-${digest.slice(0, 24)}`;
}

function normalizeErrorCode(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (msg.includes("refresh")) return "token_refresh_failed";
  if (msg.includes("authorization") || msg.includes("oauth")) return "oauth_error";
  if (msg.includes("calendar")) return "provider_calendar_error";
  if (msg.includes("timeout")) return "provider_timeout";
  return "provider_unknown";
}

async function loadAppointment(appointmentId: string): Promise<AppointmentRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("id, adviser_user_id, client_id, client_user_id, title, appointment_type, starts_at, ends_at, timezone, location_type, location_text, crm_lifecycle_status, version, status, meeting_url")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw new Error("Failed to load appointment");
  return (data as AppointmentRow | null) ?? null;
}

async function loadClientEmail(clientUserId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin.from("users").select("email").eq("id", clientUserId).maybeSingle();
  return ((data as { email?: string | null } | null)?.email ?? null)?.trim() || null;
}

async function upsertSyncMapping(input: {
  appointmentId: string;
  adviserUserId: string;
  calendarId: string;
  googleEventId: string;
  appointmentVersion: number;
  syncStatus: "synced" | "pending" | "failed" | "action_required" | "cancelled";
  safeErrorCode?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("crm_google_calendar_event_mappings").upsert(
    {
      appointment_id: input.appointmentId,
      adviser_user_id: input.adviserUserId,
      connection_calendar_id: input.calendarId,
      google_event_id: input.googleEventId,
      sync_status: input.syncStatus,
      last_attempted_sync_at: now,
      last_successful_sync_at: input.syncStatus === "synced" || input.syncStatus === "cancelled" ? now : null,
      last_aegis_version_synced: input.appointmentVersion,
      safe_error_code: input.safeErrorCode ?? null,
      retry_count: input.syncStatus === "failed" ? 1 : 0,
      disconnected_at: null,
      deleted_at: input.syncStatus === "cancelled" ? now : null,
    } as never,
    { onConflict: "appointment_id,adviser_user_id,connection_calendar_id" },
  );
  if (error) throw new Error("Failed to persist Google mapping");
}

export async function loadGoogleCalendarIntegrationStatus(adviserUserId: string): Promise<{
  connection: Awaited<ReturnType<typeof getCalendarConnectionStatus>>;
  selectedCalendarId: string | null;
  selectedCalendarEmail: string | null;
  lastSuccessfulSyncAt: string | null;
  pendingSyncCount: number;
  failedSyncCount: number;
  actionRequiredCount: number;
}> {
  const admin = createAdminSupabaseClient();
  const connection = await getCalendarConnectionStatus(adviserUserId);
  const { data: mappingRows } = await admin
    .from("crm_google_calendar_event_mappings")
    .select("sync_status,last_successful_sync_at")
    .eq("adviser_user_id", adviserUserId)
    .is("disconnected_at", null);

  const rows = (mappingRows ?? []) as Array<{ sync_status: string; last_successful_sync_at: string | null }>;
  const lastSuccessfulSyncAt = rows
    .map((row) => row.last_successful_sync_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    connection,
    selectedCalendarId: connection.calendarId,
    selectedCalendarEmail: connection.calendarEmail,
    lastSuccessfulSyncAt,
    pendingSyncCount: rows.filter((r) => r.sync_status === "pending").length,
    failedSyncCount: rows.filter((r) => r.sync_status === "failed").length,
    actionRequiredCount: rows.filter((r) => r.sync_status === "action_required").length,
  };
}

export async function listGoogleCalendarsForAdviser(adviserUserId: string): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  return listAdviserWritableCalendars(adviserUserId);
}

export async function selectGoogleCalendarForAdviser(input: {
  adviserUserId: string;
  calendarId: string;
}): Promise<void> {
  const calendars = await listAdviserWritableCalendars(input.adviserUserId);
  const selected = calendars.find((c) => c.id === input.calendarId);
  if (!selected) {
    throw new Error("Selected calendar is not writable for this connection");
  }
  await upsertAdviserCalendarSettings(input.adviserUserId, {
    calendarId: selected.id,
    calendarEmail: selected.summary,
  });
}

export async function syncAppointmentToGoogle(input: {
  adviserUserId: string;
  appointmentId: string;
  requestId: string;
  sendUpdates?: "none" | "externalOnly" | "all";
}): Promise<{
  status: "synced" | "cancelled";
  googleEventId: string;
}> {
  const auth = await resolveAuthorizedAppointment(input.adviserUserId, "advisor", input.appointmentId);
  if (!auth.ok) throw new Error("Appointment not found");
  const appointment = await loadAppointment(input.appointmentId);
  if (!appointment || appointment.adviser_user_id !== input.adviserUserId) {
    throw new Error("Appointment not found");
  }

  const lifecycle = lifecycleOf(appointment);
  const token = await getAdviserGoogleAccessToken(input.adviserUserId);
  const admin = createAdminSupabaseClient();
  const { data: existingMap } = await admin
    .from("crm_google_calendar_event_mappings")
    .select("*")
    .eq("appointment_id", appointment.id)
    .eq("adviser_user_id", input.adviserUserId)
    .eq("connection_calendar_id", token.calendarId)
    .is("disconnected_at", null)
    .maybeSingle();
  const mapping = existingMap as MappingRow | null;

  if (CANCELLATION_SYNC_LIFECYCLE.has(lifecycle)) {
    if (mapping?.google_event_id) {
      await providerCancelEvent({
        calendarId: token.calendarId,
        eventId: mapping.google_event_id,
        accessToken: token.accessToken,
      });
      await upsertSyncMapping({
        appointmentId: appointment.id,
        adviserUserId: input.adviserUserId,
        calendarId: token.calendarId,
        googleEventId: mapping.google_event_id,
        appointmentVersion: appointment.version,
        syncStatus: "cancelled",
      });
      await admin
        .from("adviser_appointments")
        .update({ calendar_sync_status: "cancelled", calendar_sync_error: null } as never)
        .eq("id", appointment.id);
      return { status: "cancelled", googleEventId: mapping.google_event_id };
    }
    throw new Error("No mapped Google event to cancel");
  }

  if (!ELIGIBLE_SYNC_LIFECYCLE.has(lifecycle)) {
    throw new Error("Appointment lifecycle is not eligible for Google sync");
  }

  const clientEmail = await loadClientEmail(appointment.client_user_id);
  const eventPayload = {
    calendarId: token.calendarId,
    accessToken: token.accessToken,
    summary: safeGoogleSummary(appointment),
    description: safeGoogleDescription(),
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    timezone: appointment.timezone,
    attendeeEmail: clientEmail,
    locationType: appointment.location_type,
    meetingLocationText: appointment.location_text,
    conferenceRequestId:
      appointment.location_type === "google_meet"
        ? stableConferenceRequestId(appointment.id)
        : null,
    sendUpdates: input.sendUpdates ?? "none",
  } as const;

  try {
    let googleEventId = mapping?.google_event_id ?? "";
    if (!mapping?.google_event_id) {
      const created = await providerCreateEvent(eventPayload);
      googleEventId = created.eventId;
    } else {
      await providerUpdateEvent({ ...eventPayload, eventId: mapping.google_event_id });
    }

    await upsertSyncMapping({
      appointmentId: appointment.id,
      adviserUserId: input.adviserUserId,
      calendarId: token.calendarId,
      googleEventId,
      appointmentVersion: appointment.version,
      syncStatus: "synced",
    });

    await admin
      .from("adviser_appointments")
      .update({
        google_event_id: googleEventId,
        google_calendar_id: token.calendarId,
        calendar_sync_status: "synced",
        calendar_sync_error: null,
      } as never)
      .eq("id", appointment.id);

    await writeAuditLog({
      userId: input.adviserUserId,
      clientId: appointment.client_id,
      action: "crm_v2_google_calendar_synced",
      entityType: "adviser_appointments",
      entityId: appointment.id,
      metadata: {
        request_id: input.requestId,
        lifecycle,
        google_calendar_id: token.calendarId,
      },
    });

    return { status: "synced", googleEventId };
  } catch (err) {
    const safeError = normalizeErrorCode(err);
    await admin
      .from("adviser_appointments")
      .update({
        calendar_sync_status: "failed",
        calendar_sync_error: safeError,
      } as never)
      .eq("id", appointment.id);
    if (mapping?.google_event_id) {
      await upsertSyncMapping({
        appointmentId: appointment.id,
        adviserUserId: input.adviserUserId,
        calendarId: token.calendarId,
        googleEventId: mapping.google_event_id,
        appointmentVersion: appointment.version,
        syncStatus: "failed",
        safeErrorCode: safeError,
      });
    }
    throw new Error("Google Calendar synchronization failed");
  }
}

export async function getAppointmentGoogleSyncStatus(input: {
  adviserUserId: string;
  appointmentId: string;
}): Promise<{
  status:
    | "not_connected"
    | "not_synced"
    | "sync_pending"
    | "synced"
    | "update_required"
    | "sync_failed"
    | "reauthorization_required";
  mapping: MappingRow | null;
}> {
  const connection = await getCalendarConnectionStatus(input.adviserUserId);
  if (!connection.connected) return { status: "not_connected", mapping: null };

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("crm_google_calendar_event_mappings")
    .select("*")
    .eq("appointment_id", input.appointmentId)
    .eq("adviser_user_id", input.adviserUserId)
    .is("disconnected_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const mapping = (data as MappingRow | null) ?? null;
  if (!mapping) return { status: "not_synced", mapping: null };
  if (mapping.sync_status === "pending") return { status: "sync_pending", mapping };
  if (mapping.sync_status === "failed") return { status: "sync_failed", mapping };
  if (mapping.sync_status === "action_required") return { status: "reauthorization_required", mapping };
  if (mapping.sync_status === "synced") return { status: "synced", mapping };
  return { status: "update_required", mapping };
}

export async function retryAppointmentGoogleSync(input: {
  adviserUserId: string;
  appointmentId: string;
  requestId: string;
}): Promise<{ status: "synced" | "cancelled"; googleEventId: string }> {
  return syncAppointmentToGoogle({
    adviserUserId: input.adviserUserId,
    appointmentId: input.appointmentId,
    requestId: input.requestId,
    sendUpdates: "none",
  });
}

export async function disconnectAdviserGoogleCalendar(input: {
  adviserUserId: string;
  requestId: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  await disconnectGoogleCalendar(input.adviserUserId);
  await admin
    .from("crm_google_calendar_event_mappings")
    .update({
      disconnected_at: new Date().toISOString(),
      sync_status: "action_required",
      safe_error_code: "connection_disconnected",
    } as never)
    .eq("adviser_user_id", input.adviserUserId)
    .is("disconnected_at", null);
}
