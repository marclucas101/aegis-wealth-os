import "server-only";

import type { CalendarLocationType } from "@/lib/aegis/calendar";
import {
  CRM_V2_APPOINTMENTS_MAX_EVENTS,
  CRM_V2_APPOINTMENTS_MAX_PARTICIPANTS,
  CRM_V2_APPOINTMENTS_MAX_TITLE_LENGTH,
} from "@/lib/crm-v2/constants";
import { loadProtectionAppointmentPreparation } from "@/lib/crm-v2/protection/protection";
import { resolveEffectiveLifecycleStatus } from "@/lib/crm-v2/appointments/legacyMapping";
import { isValidIanaTimezone } from "@/lib/crm-v2/appointments/timezone";
import {
  deriveAdviserActions,
  isCreationAllowedStatus,
  lifecycleStatusLabel,
  mapLifecycleToLegacyStatus,
  validateAppointmentTransition,
  type CrmAppointmentLifecycleStatus,
  type CrmAppointmentTransitionReasonCode,
  CrmAppointmentTransitionError,
} from "@/lib/crm-v2/appointments/lifecycle";
import { resolveAuthorizedAppointment } from "@/lib/crm-v2/appointments/identity";
import {
  buildAppointmentDetailHref,
  buildMeetingStudioHref,
  buildRelationshipHref,
} from "@/lib/crm-v2/appointments/routes";
import {
  getAppointmentTemplate,
  isValidAppointmentTemplateKey,
  type CrmAppointmentTemplateKey,
} from "@/lib/crm-v2/appointments/templates";
import type {
  CrmAppointmentBinderReadiness,
  CrmAppointmentDetail,
  CrmAppointmentFollowUpState,
  CrmAppointmentMeetingSessionLinkState,
  CrmAppointmentPreparationState,
} from "@/lib/crm-v2/appointments/types";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";

type AppointmentDbRow = {
  id: string;
  adviser_user_id: string;
  client_user_id: string;
  client_id: string;
  appointment_type: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  crm_lifecycle_status: string | null;
  template_key: string | null;
  title: string | null;
  location_type: CalendarLocationType;
  location_text: string | null;
  meeting_url: string | null;
  preparation_state: CrmAppointmentPreparationState;
  follow_up_state: CrmAppointmentFollowUpState;
  version: number;
  cancelled_at: string | null;
  source: string;
};

export type CreateCrmAppointmentInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  templateKey: CrmAppointmentTemplateKey;
  lifecycleStatus: CrmAppointmentLifecycleStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  deliveryMode: CalendarLocationType;
  title?: string | null;
  locationText?: string | null;
  participants?: Array<{ displayName: string; role: "client" | "adviser" | "guest" }>;
  adviserAgenda?: string[];
  requestId?: string;
  now: string;
  idempotencyKey?: string;
};

export type RescheduleCrmAppointmentInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  appointmentId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  version: number;
  requestId?: string;
  now: string;
};

export type TransitionCrmAppointmentInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  appointmentId: string;
  toStatus: CrmAppointmentLifecycleStatus;
  reasonCode: CrmAppointmentTransitionReasonCode;
  version: number;
  requestId?: string;
  now: string;
};

export type CrmAppointmentServiceResult<T> =
  | { ok: false; reason: "not_found" | "forbidden" | "validation" | "conflict"; error?: string }
  | { ok: true; data: T };

const DELIVERY_MODES = new Set<CalendarLocationType>([
  "physical",
  "phone",
  "google_meet",
]);

function isValidTimezone(timezone: string): boolean {
  return isValidIanaTimezone(timezone);
}

function isValidTimeRange(startsAt: string, endsAt: string): boolean {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

function locationSummary(row: AppointmentDbRow): string {
  switch (row.location_type) {
    case "physical":
      return row.location_text?.trim() || "In person";
    case "phone":
      return "Phone";
    case "google_meet":
      return "Video call";
    default:
      return "Meeting";
  }
}

async function recordStateEvent(input: {
  appointmentId: string;
  clientId: string;
  adviserUserId: string;
  eventType: string;
  fromState?: string | null;
  toState?: string | null;
  actorUserId: string;
  occurredAt: string;
  reasonCode?: string | null;
  requestId?: string | null;
  previousStartsAt?: string | null;
  previousEndsAt?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("crm_appointment_state_events").insert({
    appointment_id: input.appointmentId,
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    event_type: input.eventType,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    actor_user_id: input.actorUserId,
    occurred_at: input.occurredAt,
    reason_code: input.reasonCode ?? null,
    request_id: input.requestId ?? null,
    previous_starts_at: input.previousStartsAt ?? null,
    previous_ends_at: input.previousEndsAt ?? null,
  } as never);

  if (error) {
    throw new Error("Failed to record appointment event");
  }
}

async function seedChecklistFromTemplate(
  appointmentId: string,
  clientId: string,
  templateKey: CrmAppointmentTemplateKey,
): Promise<void> {
  const template = getAppointmentTemplate(templateKey);
  if (!template) return;

  const admin = createAdminSupabaseClient();
  const rows = template.checklistItems.map((item) => ({
    appointment_id: appointmentId,
    client_id: clientId,
    item_key: item.key,
    label: item.label,
    required: item.required,
    owner: item.owner,
    visibility: item.visibility,
    completed: false,
    sort_order: item.sortOrder,
  }));

  if (rows.length === 0) return;

  const { error } = await admin
    .from("crm_appointment_checklist_items")
    .insert(rows as never);

  if (error) {
    throw new Error("Failed to initialize checklist");
  }
}

async function seedAgendaItems(
  appointmentId: string,
  clientId: string,
  adviserUserId: string,
  items: string[],
): Promise<void> {
  if (items.length === 0) return;
  const admin = createAdminSupabaseClient();
  const rows = items.slice(0, 20).map((text, index) => ({
    appointment_id: appointmentId,
    client_id: clientId,
    item_text: text.trim().slice(0, 500),
    sort_order: (index + 1) * 10,
    created_by_user_id: adviserUserId,
  }));

  const { error } = await admin.from("crm_appointment_agenda_items").insert(rows as never);
  if (error) {
    throw new Error("Failed to initialize agenda");
  }
}

async function seedParticipants(
  appointmentId: string,
  clientId: string,
  clientDisplayName: string,
  adviserName: string,
  extras: Array<{ displayName: string; role: "client" | "adviser" | "guest" }>,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const participants = [
    {
      appointment_id: appointmentId,
      client_id: clientId,
      display_name: clientDisplayName,
      role: "client",
      is_primary: true,
      sort_order: 10,
    },
    {
      appointment_id: appointmentId,
      client_id: clientId,
      display_name: adviserName,
      role: "adviser",
      is_primary: false,
      sort_order: 20,
    },
    ...extras.slice(0, CRM_V2_APPOINTMENTS_MAX_PARTICIPANTS - 2).map((p, i) => ({
      appointment_id: appointmentId,
      client_id: clientId,
      display_name: p.displayName.trim().slice(0, 120),
      role: p.role,
      is_primary: false,
      sort_order: 30 + i * 10,
    })),
  ];

  const { error } = await admin
    .from("crm_appointment_participants")
    .insert(participants as never);

  if (error) {
    throw new Error("Failed to initialize participants");
  }
}

async function loadBinderReadiness(
  clientId: string,
): Promise<{ readiness: CrmAppointmentBinderReadiness; href: string | null }> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("id, status, published_to_client")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { readiness: "unknown", href: null };
  }

  if (!data) {
    return { readiness: "not_generated", href: buildRelationshipHref(clientId) };
  }

  const status = String((data as { status?: string }).status ?? "");
  if (status === "failed") {
    return { readiness: "failed", href: buildRelationshipHref(clientId) };
  }
  if (status === "ready" || status === "published") {
    return { readiness: "ready", href: buildRelationshipHref(clientId) };
  }
  return { readiness: "preparing", href: buildRelationshipHref(clientId) };
}

async function loadMeetingSessionState(
  appointmentId: string,
  clientId: string,
): Promise<{
  linkState: CrmAppointmentMeetingSessionLinkState;
  sessionId: string | null;
  href: string | null;
}> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("meeting_sessions")
    .select("id, status")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { linkState: "none", sessionId: null, href: buildMeetingStudioHref(clientId) };
  }

  const status = String((data as { status: string }).status);
  return {
    linkState: status === "in_progress" ? "in_progress" : "linked",
    sessionId: String((data as { id: string }).id),
    href: buildMeetingStudioHref(clientId),
  };
}

export async function createCrmAppointment(
  input: CreateCrmAppointmentInput,
): Promise<CrmAppointmentServiceResult<{ appointmentId: string }>> {
  if (!isValidAppointmentTemplateKey(input.templateKey)) {
    return { ok: false, reason: "validation", error: "Invalid appointment template" };
  }

  if (!isCreationAllowedStatus(input.lifecycleStatus)) {
    return {
      ok: false,
      reason: "validation",
      error: "Cannot create appointment in terminal lifecycle state",
    };
  }

  if (!isValidTimezone(input.timezone)) {
    return { ok: false, reason: "validation", error: "Invalid timezone" };
  }

  if (!isValidTimeRange(input.startsAt, input.endsAt)) {
    return { ok: false, reason: "validation", error: "Invalid time range" };
  }

  if (!DELIVERY_MODES.has(input.deliveryMode)) {
    return { ok: false, reason: "validation", error: "Unsupported delivery mode" };
  }

  const template = getAppointmentTemplate(input.templateKey)!;
  if (!template.deliveryModes.includes(input.deliveryMode)) {
    return { ok: false, reason: "validation", error: "Delivery mode not supported for template" };
  }

  const title = input.title?.trim().slice(0, CRM_V2_APPOINTMENTS_MAX_TITLE_LENGTH) ?? null;
  const participants = input.participants ?? [];
  const uniqueNames = new Set(participants.map((p) => p.displayName.trim().toLowerCase()));
  if (uniqueNames.size !== participants.length) {
    return { ok: false, reason: "validation", error: "Duplicate participants" };
  }

  const clientAccess = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (clientAccess.status !== "ok") {
    return { ok: false, reason: "not_found" };
  }

  const client = clientAccess.client;
  if (!client.user_id) {
    return {
      ok: false,
      reason: "validation",
      error: "Client must complete registration before appointments can be scheduled",
    };
  }

  const adviserUserId =
    input.userRole === "admin" ? client.advisor_user_id : input.authUserId;
  if (!adviserUserId) {
    return { ok: false, reason: "validation", error: "Client has no assigned adviser" };
  }

  const admin = createAdminSupabaseClient();

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("adviser_appointments")
      .select("id")
      .eq("created_by_user_id", input.authUserId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return { ok: true, data: { appointmentId: String((existing as { id: string }).id) } };
    }
  }

  const legacyStatus = mapLifecycleToLegacyStatus(input.lifecycleStatus);

  const { data: inserted, error: insertError } = await admin
    .from("adviser_appointments")
    .insert({
      adviser_user_id: adviserUserId,
      client_user_id: client.user_id,
      client_id: client.id,
      appointment_type: input.templateKey,
      template_key: input.templateKey,
      title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      timezone: input.timezone,
      status: legacyStatus,
      crm_lifecycle_status: input.lifecycleStatus,
      location_type: input.deliveryMode,
      location_text: input.locationText?.trim() || null,
      source: "adviser_created",
      created_by_user_id: input.authUserId,
      updated_by_user_id: input.authUserId,
      preparation_state: "not_started",
      follow_up_state: "none",
      version: 1,
      last_transition_at: input.now,
      last_transition_by_user_id: input.authUserId,
      idempotency_key: input.idempotencyKey ?? null,
    } as never)
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23P01") {
      return { ok: false, reason: "conflict", error: "Time slot conflicts with existing appointment" };
    }
    return { ok: false, reason: "validation", error: "Failed to create appointment" };
  }

  const appointmentId = String((inserted as { id: string }).id);

  const { data: adviserUser } = await admin
    .from("users")
    .select("full_name")
    .eq("id", adviserUserId)
    .maybeSingle();
  const adviserName =
    (adviserUser as { full_name?: string | null } | null)?.full_name?.trim() || "Adviser";

  await seedChecklistFromTemplate(appointmentId, client.id, input.templateKey);
  await seedAgendaItems(
    appointmentId,
    client.id,
    input.authUserId,
    input.adviserAgenda ?? template.defaultAgendaPrompts,
  );
  await seedParticipants(
    appointmentId,
    client.id,
    client.display_name,
    adviserName,
    participants,
  );

  await recordStateEvent({
    appointmentId,
    clientId: client.id,
    adviserUserId,
    eventType: "created",
    fromState: null,
    toState: input.lifecycleStatus,
    actorUserId: input.authUserId,
    occurredAt: input.now,
    reasonCode: "adviser_created",
    requestId: input.requestId,
  });

  await writeAuditLog({
    clientId: client.id,
    userId: input.authUserId,
    action: "crm_appointment_created",
    entityType: "adviser_appointments",
    entityId: appointmentId,
    metadata: {
      template_key: input.templateKey,
      lifecycle_status: input.lifecycleStatus,
      starts_at: input.startsAt,
    },
  });

  return { ok: true, data: { appointmentId } };
}

export async function transitionCrmAppointment(
  input: TransitionCrmAppointmentInput,
): Promise<CrmAppointmentServiceResult<{ appointmentId: string; lifecycleStatus: CrmAppointmentLifecycleStatus }>> {
  const auth = await resolveAuthorizedAppointment(
    input.authUserId,
    input.userRole,
    input.appointmentId,
  );
  if (!auth.ok) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }

  const row = data as AppointmentDbRow;
  const currentStatus = resolveEffectiveLifecycleStatus({
    crmLifecycleStatus: row.crm_lifecycle_status,
    legacyStatus: row.status,
  });

  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Appointment was updated elsewhere" };
  }

  try {
    validateAppointmentTransition({
      from: currentStatus,
      to: input.toStatus,
      actorRole: "adviser",
      reasonCode: input.reasonCode,
      occurredAt: input.now,
    });
  } catch (err) {
    if (err instanceof CrmAppointmentTransitionError) {
      return { ok: false, reason: "validation", error: err.message };
    }
    throw err;
  }

  const nextVersion = row.version + 1;
  let preparationState = row.preparation_state;
  let followUpState = row.follow_up_state;

  if (input.toStatus === "preparing") preparationState = "in_progress";
  if (input.toStatus === "ready") preparationState = "complete";
  if (input.toStatus === "follow_up_required") followUpState = "required";
  if (input.toStatus === "closed") followUpState = "complete";

  const patch: Record<string, unknown> = {
    crm_lifecycle_status: input.toStatus,
    status: mapLifecycleToLegacyStatus(input.toStatus),
    version: nextVersion,
    last_transition_at: input.now,
    last_transition_by_user_id: input.authUserId,
    updated_by_user_id: input.authUserId,
    preparation_state: preparationState,
    follow_up_state: followUpState,
  };

  if (
    input.toStatus === "cancelled_by_adviser" ||
    input.toStatus === "cancelled_by_client"
  ) {
    patch.cancelled_at = input.now;
  }

  const { error: updateError } = await admin
    .from("adviser_appointments")
    .update(patch as never)
    .eq("id", input.appointmentId)
    .eq("version", input.version);

  if (updateError) {
    return { ok: false, reason: "conflict", error: "Concurrent update detected" };
  }

  if (input.toStatus === "in_progress") {
    await linkMeetingSessionForAppointment({
      appointmentId: input.appointmentId,
      clientId: row.client_id,
      adviserUserId: row.adviser_user_id,
      authUserId: input.authUserId,
      now: input.now,
    });
  }

  await recordStateEvent({
    appointmentId: input.appointmentId,
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    eventType: "transition",
    fromState: currentStatus,
    toState: input.toStatus,
    actorUserId: input.authUserId,
    occurredAt: input.now,
    reasonCode: input.reasonCode,
    requestId: input.requestId,
  });

  await writeAuditLog({
    clientId: row.client_id,
    userId: input.authUserId,
    action: "crm_appointment_transition",
    entityType: "adviser_appointments",
    entityId: input.appointmentId,
    metadata: {
      from: currentStatus,
      to: input.toStatus,
      reason_code: input.reasonCode,
    },
  });

  return {
    ok: true,
    data: { appointmentId: input.appointmentId, lifecycleStatus: input.toStatus },
  };
}

export async function rescheduleCrmAppointment(
  input: RescheduleCrmAppointmentInput,
): Promise<CrmAppointmentServiceResult<{ appointmentId: string }>> {
  const auth = await resolveAuthorizedAppointment(
    input.authUserId,
    input.userRole,
    input.appointmentId,
  );
  if (!auth.ok) {
    return { ok: false, reason: "not_found" };
  }

  if (!isValidTimezone(input.timezone)) {
    return { ok: false, reason: "validation", error: "Invalid timezone" };
  }

  if (!isValidTimeRange(input.startsAt, input.endsAt)) {
    return { ok: false, reason: "validation", error: "Invalid time range" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("id", input.appointmentId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }

  const row = data as AppointmentDbRow;
  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Appointment was updated elsewhere" };
  }

  const currentStatus = resolveEffectiveLifecycleStatus({
    crmLifecycleStatus: row.crm_lifecycle_status,
    legacyStatus: row.status,
  });

  const previousStartsAt = row.starts_at;
  const previousEndsAt = row.ends_at;

  let nextStatus: CrmAppointmentLifecycleStatus = currentStatus;
  if (currentStatus === "confirmed" || currentStatus === "ready") {
    nextStatus = "rescheduled";
  }

  const nextVersion = row.version + 1;

  const { error: updateError } = await admin
    .from("adviser_appointments")
    .update({
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      timezone: input.timezone,
      crm_lifecycle_status: nextStatus,
      status: mapLifecycleToLegacyStatus(nextStatus),
      version: nextVersion,
      last_transition_at: input.now,
      last_transition_by_user_id: input.authUserId,
      updated_by_user_id: input.authUserId,
    } as never)
    .eq("id", input.appointmentId)
    .eq("version", input.version);

  if (updateError) {
    if (updateError.code === "23P01") {
      return { ok: false, reason: "conflict", error: "Time slot conflicts with existing appointment" };
    }
    return { ok: false, reason: "conflict", error: "Concurrent update detected" };
  }

  await recordStateEvent({
    appointmentId: input.appointmentId,
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    eventType: "rescheduled",
    fromState: currentStatus,
    toState: nextStatus,
    actorUserId: input.authUserId,
    occurredAt: input.now,
    reasonCode: "rescheduled",
    requestId: input.requestId,
    previousStartsAt,
    previousEndsAt,
  });

  await writeAuditLog({
    clientId: row.client_id,
    userId: input.authUserId,
    action: "crm_appointment_rescheduled",
    entityType: "adviser_appointments",
    entityId: input.appointmentId,
    metadata: {
      previous_starts_at: previousStartsAt,
      previous_ends_at: previousEndsAt,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
    },
  });

  return { ok: true, data: { appointmentId: input.appointmentId } };
}

async function linkMeetingSessionForAppointment(input: {
  appointmentId: string;
  clientId: string;
  adviserUserId: string;
  authUserId: string;
  now: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();

  const { data: existing } = await admin
    .from("meeting_sessions")
    .select("id, client_id, adviser_user_id, status")
    .eq("appointment_id", input.appointmentId)
    .maybeSingle();

  if (existing) {
    const session = existing as { client_id: string; adviser_user_id: string };
    if (
      session.client_id !== input.clientId ||
      session.adviser_user_id !== input.adviserUserId
    ) {
      throw new Error("Meeting session assignment mismatch");
    }
    return;
  }

  const { data: unlinked } = await admin
    .from("meeting_sessions")
    .select("id, client_id, adviser_user_id, status")
    .eq("client_id", input.clientId)
    .eq("adviser_user_id", input.adviserUserId)
    .is("appointment_id", null)
    .in("status", ["draft", "prepared"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (unlinked) {
    const { error } = await admin
      .from("meeting_sessions")
      .update({ appointment_id: input.appointmentId, status: "in_progress", started_at: input.now } as never)
      .eq("id", (unlinked as { id: string }).id)
      .is("appointment_id", null);

    if (error) {
      throw new Error("Failed to link meeting session");
    }
    return;
  }

  const { error: createError } = await admin.from("meeting_sessions").insert({
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    appointment_id: input.appointmentId,
    meeting_type: "review",
    status: "in_progress",
    started_at: input.now,
    scheduled_start: input.now,
  } as never);

  if (createError) {
    throw new Error("Failed to create meeting session link");
  }
}

export async function loadCrmAppointmentDetail(
  authUserId: string,
  userRole: "advisor" | "admin",
  appointmentId: string,
): Promise<CrmAppointmentDetail | null> {
  const auth = await resolveAuthorizedAppointment(authUserId, userRole, appointmentId);
  if (!auth.ok) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const sourceWarnings: string[] = [];

  const { data: row, error } = await admin
    .from("adviser_appointments")
    .select("*")
    .eq("id", appointmentId)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  const appointment = row as AppointmentDbRow;
  const lifecycleStatus = resolveEffectiveLifecycleStatus({
    crmLifecycleStatus: appointment.crm_lifecycle_status,
    legacyStatus: appointment.status,
  });

  const template = appointment.template_key
    ? getAppointmentTemplate(appointment.template_key)
    : null;

  const [
    participantsResult,
    clientTopicsResult,
    agendaResult,
    checklistResult,
    eventsResult,
    binder,
    meetingSession,
  ] = await Promise.all([
    admin
      .from("crm_appointment_participants")
      .select("id, display_name, role, is_primary, sort_order")
      .eq("appointment_id", appointmentId)
      .order("sort_order", { ascending: true }),
    admin
      .from("crm_appointment_client_topics")
      .select("id, topic_text, sort_order")
      .eq("appointment_id", appointmentId)
      .order("sort_order", { ascending: true }),
    admin
      .from("crm_appointment_agenda_items")
      .select("id, item_text, sort_order")
      .eq("appointment_id", appointmentId)
      .order("sort_order", { ascending: true }),
    admin
      .from("crm_appointment_checklist_items")
      .select("id, label, required, owner, visibility, completed, due_date, sort_order")
      .eq("appointment_id", appointmentId)
      .order("sort_order", { ascending: true }),
    admin
      .from("crm_appointment_state_events")
      .select("id, event_type, from_state, to_state, occurred_at, reason_code")
      .eq("appointment_id", appointmentId)
      .order("occurred_at", { ascending: false })
      .limit(CRM_V2_APPOINTMENTS_MAX_EVENTS),
    loadBinderReadiness(appointment.client_id),
    loadMeetingSessionState(appointmentId, appointment.client_id),
  ]);

  if (participantsResult.error) sourceWarnings.push("participants_unavailable");
  if (checklistResult.error) sourceWarnings.push("checklist_unavailable");

  const checklistItems = (checklistResult.data ?? []) as Array<{
    id: string;
    label: string;
    required: boolean;
    owner: "adviser" | "client" | "shared";
    visibility: "adviser" | "client" | "shared";
    completed: boolean;
    due_date: string | null;
    sort_order: number;
  }>;

  const protectionPreparation = await loadProtectionAppointmentPreparation(
    appointment.client_id,
  ).catch(() => null);

  return {
    appointmentId,
    relationshipId: appointment.client_id,
    clientDisplayName: auth.client.display_name,
    templateKey: isValidAppointmentTemplateKey(appointment.template_key ?? "")
      ? (appointment.template_key as CrmAppointmentTemplateKey)
      : null,
    templateLabel: template?.displayName ?? appointment.appointment_type,
    title: appointment.title,
    lifecycleStatus,
    lifecycleLabel: lifecycleStatusLabel(lifecycleStatus),
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    timezone: appointment.timezone,
    deliveryMode: appointment.location_type,
    locationSummary: locationSummary(appointment),
    participants: ((participantsResult.data ?? []) as Array<{
      id: string;
      display_name: string;
      role: "client" | "adviser" | "guest";
      is_primary: boolean;
    }>).map((p) => ({
      participantId: p.id,
      displayName: p.display_name,
      role: p.role,
      isPrimary: p.is_primary,
    })),
    clientTopics: ((clientTopicsResult.data ?? []) as Array<{
      id: string;
      topic_text: string;
      sort_order: number;
    }>).map((t) => ({
      topicId: t.id,
      source: "client" as const,
      label: t.topic_text,
      sortOrder: t.sort_order,
    })),
    adviserAgenda: ((agendaResult.data ?? []) as Array<{
      id: string;
      item_text: string;
      sort_order: number;
    }>).map((t) => ({
      topicId: t.id,
      source: "adviser_agenda" as const,
      label: t.item_text,
      sortOrder: t.sort_order,
    })),
    checklistItems: checklistItems.map((item) => ({
      itemId: item.id,
      label: item.label,
      required: item.required,
      owner: item.owner,
      visibility: item.visibility,
      completed: item.completed,
      dueDate: item.due_date,
      sortOrder: item.sort_order,
    })),
    checklistCompletedCount: checklistItems.filter((i) => i.completed).length,
    checklistRequiredCount: checklistItems.filter((i) => i.required).length,
    preparationState: appointment.preparation_state,
    followUpState: appointment.follow_up_state,
    meetingSessionLinkState: meetingSession.linkState,
    meetingSessionHref: meetingSession.href,
    meetingSessionId: meetingSession.sessionId,
    binderReadiness: binder.readiness,
    binderHref: binder.href,
    allowedActions: deriveAdviserActions(lifecycleStatus),
    version: appointment.version,
    detailHref: buildAppointmentDetailHref(appointmentId),
    relationshipHref: buildRelationshipHref(appointment.client_id),
    recentEvents: ((eventsResult.data ?? []) as Array<{
      id: string;
      event_type: string;
      from_state: string | null;
      to_state: string | null;
      occurred_at: string;
      reason_code: string | null;
    }>).map((e) => ({
      eventId: e.id,
      eventType: e.event_type,
      fromState: e.from_state as CrmAppointmentLifecycleStatus | null,
      toState: e.to_state as CrmAppointmentLifecycleStatus | null,
      occurredAt: e.occurred_at,
      reasonCode: e.reason_code,
    })),
    protectionPreparation,
    sourceWarnings,
  };
}

export async function loadAssignedRelationshipsForAppointments(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<Array<{ relationshipId: string; displayName: string }>> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("clients")
    .select("id, display_name")
    .order("display_name", { ascending: true })
    .limit(200);

  if (userRole === "advisor") {
    query = query.eq("advisor_user_id", authUserId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Failed to load relationships");
  }

  return ((data ?? []) as Array<{ id: string; display_name: string }>).map((row) => ({
    relationshipId: row.id,
    displayName: row.display_name,
  }));
}
