import "server-only";

import { createAdminSupabaseClient } from "./admin";

import {
  assertSessionPatchAllowed,
  IMMUTABLE_MEETING_STATUSES,
} from "@/lib/compliance/meetingSessionLifecycle";

import type {
  AcknowledgementRecord,
  CloseState,
  FactConfirmationRecord,
  MeetingSessionStatus,
  MeetingSummaryStatus,
  MeetingType,
  PreparationState,
  ScenarioSelection,
} from "@/lib/compliance/meetingStudioTypes";
import type { MeetingSectionType } from "@/lib/compliance/meetingStudioTypes";
import type { RelationshipStage } from "@/lib/compliance/types";

export type MeetingSessionRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  appointment_id: string | null;
  meeting_type: MeetingType;
  status: MeetingSessionStatus;
  scheduled_start: string | null;
  started_at: string | null;
  ended_at: string | null;
  completed_at: string | null;
  title: string | null;
  purpose: string | null;
  selected_sections: MeetingSectionType[];
  section_order: MeetingSectionType[];
  sections_shown: MeetingSectionType[];
  skipped_sections: MeetingSectionType[];
  preparation_state: PreparationState;
  close_state: CloseState;
  fact_confirmations: FactConfirmationRecord[];
  scenario_selections: ScenarioSelection[];
  acknowledgements: AcknowledgementRecord[];
  data_snapshot_version: string | null;
  algorithm_version: string | null;
  relationship_stage_at_start: RelationshipStage | null;
  relationship_stage_at_end: RelationshipStage | null;
  summary_status: MeetingSummaryStatus;
  summary_payload: Record<string, unknown>;
  published_output_id: string | null;
  requires_analysis_refresh: boolean;
  created_at: string;
  updated_at: string;
};

export type MeetingSessionEventRow = {
  id: string;
  session_id: string;
  client_id: string;
  adviser_user_id: string;
  event_type: string;
  section_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return fallback;
}

function parseJsonObject<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T,
): T {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }
  return fallback;
}

export function mapMeetingSessionRow(row: Record<string, unknown>): MeetingSessionRow {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    adviser_user_id: String(row.adviser_user_id),
    appointment_id: row.appointment_id ? String(row.appointment_id) : null,
    meeting_type: row.meeting_type as MeetingType,
    status: row.status as MeetingSessionStatus,
    scheduled_start: row.scheduled_start ? String(row.scheduled_start) : null,
    started_at: row.started_at ? String(row.started_at) : null,
    ended_at: row.ended_at ? String(row.ended_at) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    title: row.title ? String(row.title) : null,
    purpose: row.purpose ? String(row.purpose) : null,
    selected_sections: parseJsonArray(row.selected_sections, []),
    section_order: parseJsonArray(row.section_order, []),
    sections_shown: parseJsonArray(row.sections_shown, []),
    skipped_sections: parseJsonArray(row.skipped_sections, []),
    preparation_state: parseJsonObject(row.preparation_state, {}),
    close_state: parseJsonObject(row.close_state, {}),
    fact_confirmations: parseJsonArray(row.fact_confirmations, []),
    scenario_selections: parseJsonArray(row.scenario_selections, []),
    acknowledgements: parseJsonArray(row.acknowledgements, []),
    data_snapshot_version: row.data_snapshot_version
      ? String(row.data_snapshot_version)
      : null,
    algorithm_version: row.algorithm_version ? String(row.algorithm_version) : null,
    relationship_stage_at_start: (row.relationship_stage_at_start as RelationshipStage) ?? null,
    relationship_stage_at_end: (row.relationship_stage_at_end as RelationshipStage) ?? null,
    summary_status: row.summary_status as MeetingSummaryStatus,
    summary_payload: parseJsonObject(row.summary_payload, {}),
    published_output_id: row.published_output_id
      ? String(row.published_output_id)
      : null,
    requires_analysis_refresh: Boolean(row.requires_analysis_refresh),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function dbInsertMeetingSession(
  row: Record<string, unknown>,
): Promise<MeetingSessionRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("meeting_sessions")
    .insert(row as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create meeting session: ${error.message}`);
  }

  return mapMeetingSessionRow(data as Record<string, unknown>);
}

export async function dbLoadMeetingSessionById(
  sessionId: string,
): Promise<MeetingSessionRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("meeting_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load meeting session: ${error.message}`);
  }

  return data ? mapMeetingSessionRow(data as Record<string, unknown>) : null;
}

export async function dbListMeetingSessionsForClient(
  clientId: string,
): Promise<MeetingSessionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("meeting_sessions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list meeting sessions: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapMeetingSessionRow(row as Record<string, unknown>),
  );
}

export async function dbUpdateMeetingSession(
  sessionId: string,
  clientId: string,
  patch: Record<string, unknown>,
  options?: { expectedStatus?: MeetingSessionStatus },
): Promise<MeetingSessionRow> {
  const admin = createAdminSupabaseClient();

  const { data: existing, error: loadError } = await admin
    .from("meeting_sessions")
    .select("status")
    .eq("id", sessionId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load meeting session: ${loadError.message}`);
  }
  if (!existing) {
    throw new Error("Meeting session not found");
  }

  const currentStatus = (existing as { status: MeetingSessionStatus }).status;
  assertSessionPatchAllowed(currentStatus, patch);

  if (IMMUTABLE_MEETING_STATUSES.includes(currentStatus)) {
    throw new Error("Completed sessions cannot be modified");
  }

  let query = admin
    .from("meeting_sessions")
    .update(patch as never)
    .eq("id", sessionId)
    .eq("client_id", clientId);

  if (options?.expectedStatus) {
    query = query.eq("status", options.expectedStatus);
  }

  const { data, error } = await query.select("*").maybeSingle();

  if (error) {
    throw new Error(`Failed to update meeting session: ${error.message}`);
  }

  if (!data) {
    throw new Error("Session state changed concurrently — retry the request");
  }

  return mapMeetingSessionRow(data as Record<string, unknown>);
}

export async function dbInsertMeetingSessionEvent(
  row: Record<string, unknown>,
): Promise<MeetingSessionEventRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("meeting_session_events")
    .insert(row as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert meeting session event: ${error.message}`);
  }

  return data as MeetingSessionEventRow;
}

export type AppointmentValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export async function dbValidateAppointmentForClient(input: {
  appointmentId: string;
  clientId: string;
  adviserUserId: string;
}): Promise<AppointmentValidationResult> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("id, client_id, adviser_user_id, status")
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate appointment: ${error.message}`);
  }

  if (!data) {
    return { valid: false, reason: "Appointment not found" };
  }

  const row = data as {
    client_id: string;
    adviser_user_id: string;
    status: string;
  };

  if (row.client_id !== input.clientId) {
    return { valid: false, reason: "Appointment does not belong to this client" };
  }

  if (row.adviser_user_id !== input.adviserUserId) {
    return {
      valid: false,
      reason: "Appointment does not belong to the assigned adviser",
    };
  }

  if (row.status === "cancelled") {
    return { valid: false, reason: "Appointment has been cancelled" };
  }

  return { valid: true };
}

export async function dbLoadAdviserDisplayName(
  adviserUserId: string,
): Promise<string> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("users")
    .select("display_name, email")
    .eq("id", adviserUserId)
    .maybeSingle();

  if (error || !data) {
    return "Adviser";
  }

  const row = data as { display_name: string | null; email: string | null };
  return row.display_name ?? row.email ?? "Adviser";
}

export async function dbLoadClientDisplayName(clientId: string): Promise<string> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("display_name")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    return "Client";
  }

  const row = data as { display_name: string | null };
  return row.display_name ?? "Client";
}
