import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  mapLifecycleToLegacyStatus,
  type CrmAppointmentLifecycleStatus,
} from "@/lib/crm-v2/appointments/lifecycle";
import { clientLifecycleDisplayLabel } from "@/lib/crm-v2/client-appointments/labels";
import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";
import type {
  ClientAppointmentAction,
  ClientAppointmentChecklistItemDto,
  ClientAppointmentDetailDto,
  ClientAppointmentListView,
  ClientAppointmentSummaryDto,
} from "@/lib/crm-v2/client-appointments/types";

type OwnedRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  appointment_type: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  location_type: "physical" | "phone" | "google_meet";
  location_text: string | null;
  crm_lifecycle_status: CrmAppointmentLifecycleStatus | null;
  status: string;
  title: string | null;
  version: number;
};

const TOPIC_MAX = 8;
const TOPIC_LEN = 240;

function deriveClientActions(status: CrmAppointmentLifecycleStatus): ClientAppointmentAction[] {
  if (status === "proposed" || status === "awaiting_confirmation" || status === "rescheduled") {
    return ["confirm_proposal", "decline_proposal", "request_another_time", "submit_topics"];
  }
  if (status === "confirmed" || status === "preparing" || status === "ready") {
    return ["request_reschedule", "cancel_appointment", "submit_topics", "complete_checklist"];
  }
  if (status === "requested") {
    return ["cancel_appointment", "submit_topics"];
  }
  return [];
}

function effectiveStatus(row: OwnedRow): CrmAppointmentLifecycleStatus {
  if (row.crm_lifecycle_status) return row.crm_lifecycle_status;
  if (row.status === "confirmed") return "confirmed";
  if (row.status === "cancelled") return "legacy_cancelled";
  if (row.status === "completed") return "closed";
  if (row.status === "failed") return "legacy_failed";
  return "proposed";
}

function safeTopic(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim().slice(0, TOPIC_LEN);
}

async function loadOwnedAppointment(clientId: string, appointmentId: string): Promise<OwnedRow | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("adviser_appointments")
    .select("id, client_id, adviser_user_id, appointment_type, starts_at, ends_at, timezone, location_type, location_text, crm_lifecycle_status, status, title, version")
    .eq("id", appointmentId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as OwnedRow | null) ?? null;
}

async function loadChecklist(appointmentId: string): Promise<ClientAppointmentChecklistItemDto[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("crm_appointment_checklist_items")
    .select("id, label, required, owner, visibility, completed, due_date, sort_order")
    .eq("appointment_id", appointmentId)
    .in("visibility", ["client", "shared"])
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((r) => r.owner === "client" || r.owner === "shared")
    .map((r) => ({
      itemId: String(r.id),
      label: String(r.label),
      required: Boolean(r.required),
      owner: (r.owner === "shared" ? "shared" : "client") as "client" | "shared",
      completed: Boolean(r.completed),
      dueDate: (r.due_date as string | null) ?? null,
      sortOrder: Number(r.sort_order ?? 0),
    }));
}

export async function listClientAppointmentSummaries(
  clientId: string,
  view: ClientAppointmentListView,
): Promise<ClientAppointmentSummaryDto[]> {
  const admin = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();
  let query = admin
    .from("adviser_appointments")
    .select("id, client_id, adviser_user_id, appointment_type, starts_at, ends_at, timezone, location_type, location_text, crm_lifecycle_status, status, title, version")
    .eq("client_id", clientId)
    .order("starts_at", { ascending: view !== "history" });
  if (view === "upcoming") query = query.gte("starts_at", nowIso);
  if (view === "history") query = query.lt("starts_at", nowIso);
  const { data } = await query.limit(50);
  const rows = (data ?? []) as OwnedRow[];
  const filtered = rows.filter((row) => {
    const status = effectiveStatus(row);
    if (view === "awaiting_response") return status === "proposed" || status === "awaiting_confirmation" || status === "rescheduled";
    if (view === "preparation") return status === "preparing" || status === "ready" || status === "confirmed";
    if (view === "follow_up") return status === "follow_up_required";
    return true;
  });

  const checklistByAppointment = new Map<string, ClientAppointmentChecklistItemDto[]>();
  await Promise.all(filtered.map(async (row) => {
    checklistByAppointment.set(row.id, await loadChecklist(row.id));
  }));

  return filtered.map((row) => {
    const status = effectiveStatus(row);
    const checklist = checklistByAppointment.get(row.id) ?? [];
    return {
      appointmentId: row.id,
      lifecycleStatus: status,
      lifecycleLabel: clientLifecycleDisplayLabel(status),
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      deliveryMode: row.location_type,
      title: row.title,
      templateLabel: row.appointment_type,
      allowedActions: deriveClientActions(status),
      preparationCompletedCount: checklist.filter((c) => c.completed).length,
      preparationRequiredCount: checklist.filter((c) => c.required).length,
    };
  });
}

export async function loadClientAppointmentDetail(
  clientId: string,
  appointmentId: string,
): Promise<ClientAppointmentDetailDto | null> {
  const row = await loadOwnedAppointment(clientId, appointmentId);
  if (!row) return null;
  const admin = createAdminSupabaseClient();
  const [participantsResult, topicsResult, checklistItems, roadmapResult, summaryResult] =
    await Promise.all([
      admin.from("crm_appointment_participants").select("id, display_name, role, is_primary").eq("appointment_id", appointmentId).order("sort_order", { ascending: true }),
      admin.from("crm_appointment_client_topics").select("id, topic_text, sort_order, created_at").eq("appointment_id", appointmentId).order("sort_order", { ascending: true }),
      loadChecklist(appointmentId),
      admin.from("roadmap_items").select("id, title, status, due_date").eq("client_id", clientId).limit(5),
      admin.from("published_outputs").select("title, summary, published_at, output_type, publication_status").eq("client_id", clientId).eq("output_type", "meeting_summary").eq("publication_status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const status = effectiveStatus(row);
  const locationSummary =
    row.location_type === "physical" ? row.location_text || "In person" : row.location_type === "phone" ? "Phone" : "Video call";
  const preparationProgress = checklistItems.length === 0 ? 0 : Math.round((checklistItems.filter((c) => c.completed).length / checklistItems.length) * 100);
  const requiredDocumentCategories = checklistItems.filter((c) => c.required).map((c) => c.label).slice(0, 5);

  return {
    appointmentId: row.id,
    lifecycleStatus: status,
    lifecycleLabel: clientLifecycleDisplayLabel(status),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    deliveryMode: row.location_type,
    title: row.title,
    templateLabel: row.appointment_type,
    allowedActions: deriveClientActions(status),
    preparationCompletedCount: checklistItems.filter((c) => c.completed).length,
    preparationRequiredCount: checklistItems.filter((c) => c.required).length,
    locationSummary,
    participants: ((participantsResult.data ?? []) as Array<Record<string, unknown>>).map((p) => ({
      participantId: String(p.id),
      displayName: String(p.display_name),
      role: (p.role === "adviser" || p.role === "guest" ? p.role : "client") as "client" | "adviser" | "guest",
      isPrimary: Boolean(p.is_primary),
    })),
    clientTopics: ((topicsResult.data ?? []) as Array<Record<string, unknown>>).map((t) => ({
      topicId: String(t.id),
      topic: String(t.topic_text),
      sortOrder: Number(t.sort_order ?? 0),
      createdAt: String(t.created_at ?? row.starts_at),
    })),
    checklistItems,
    requiredDocumentCategories,
    preparationProgress,
    publishedMeetingSummary: summaryResult.data
      ? {
          title: String((summaryResult.data as Record<string, unknown>).title ?? "Meeting summary"),
          summary: String((summaryResult.data as Record<string, unknown>).summary ?? ""),
          publishedAt: String((summaryResult.data as Record<string, unknown>).published_at ?? row.starts_at),
        }
      : null,
    clientVisibleFollowUp: ((roadmapResult.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      title: String(r.title ?? "Follow-up item"),
      status: String(r.status ?? "in_progress"),
      dueDate: (r.due_date as string | null) ?? null,
    })),
    safeLinks: {
      documentUploadEntry: "/document-vault",
      roadmap: "/roadmap",
    },
    version: row.version,
  };
}

export async function createClientAppointmentRequest(input: {
  clientId: string;
  clientUserId: string;
  adviserUserId: string;
  appointmentType: string;
  title: string | null;
  preferredStartsAt: string;
  preferredEndsAt: string;
  timezone: string;
  deliveryMode: "physical" | "phone" | "google_meet";
  idempotencyKey: string;
  topics: string[];
}): Promise<{ ok: true; appointmentId: string } | { ok: false; reason: "conflict" | "validation" }> {
  const admin = createAdminSupabaseClient();
  const { data: existing } = await admin.from("adviser_appointments").select("id").eq("client_id", input.clientId).eq("created_by_user_id", input.clientUserId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
  if (existing) return { ok: true, appointmentId: String((existing as Record<string, unknown>).id) };
  if (Date.parse(input.preferredStartsAt) <= Date.now()) return { ok: false, reason: "validation" };

  const { data, error } = await admin
    .from("adviser_appointments")
    .insert({
      adviser_user_id: input.adviserUserId,
      client_user_id: input.clientUserId,
      client_id: input.clientId,
      appointment_type: input.appointmentType,
      template_key: input.appointmentType,
      title: input.title,
      starts_at: input.preferredStartsAt,
      ends_at: input.preferredEndsAt,
      timezone: input.timezone,
      status: mapLifecycleToLegacyStatus("requested"),
      crm_lifecycle_status: "requested",
      location_type: input.deliveryMode,
      source: "client_booking",
      created_by_user_id: input.clientUserId,
      updated_by_user_id: input.clientUserId,
      version: 1,
      last_transition_at: new Date().toISOString(),
      last_transition_by_user_id: input.clientUserId,
      idempotency_key: input.idempotencyKey,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { ok: false, reason: error?.code === "23P01" ? "conflict" : "validation" };

  const appointmentId = String((data as Record<string, unknown>).id);
  const topicRows = input.topics.slice(0, TOPIC_MAX).map((topic, index) => ({
    appointment_id: appointmentId,
    client_id: input.clientId,
    topic_text: safeTopic(topic),
    sort_order: (index + 1) * 10,
    created_by_user_id: input.clientUserId,
  }));
  if (topicRows.length > 0) {
    await admin.from("crm_appointment_client_topics").insert(topicRows as never);
  }
  await writeAuditLog({ clientId: input.clientId, userId: input.clientUserId, action: "crm_client_appointment_requested", entityType: "adviser_appointments", entityId: appointmentId, metadata: { appointment_type: input.appointmentType } });
  await dbCreateClientNotification({ clientId: input.clientId, notificationType: "appointment_changed", title: "Appointment request received", summary: "Your appointment request was submitted.", referenceType: "appointment", referenceId: appointmentId }).catch(() => undefined);
  return { ok: true, appointmentId };
}

export async function transitionClientOwnedAppointment(input: {
  clientId: string;
  clientUserId: string;
  appointmentId: string;
  version: number;
  toStatus: CrmAppointmentLifecycleStatus;
  reason: string;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" | "conflict" | "validation" }> {
  const row = await loadOwnedAppointment(input.clientId, input.appointmentId);
  if (!row) return { ok: false, reason: "not_found" };
  const fromStatus = effectiveStatus(row);
  const allowed = deriveClientActions(fromStatus);
  const actionKey =
    input.toStatus === "confirmed"
      ? "confirm_proposal"
      : input.toStatus === "cancelled_by_client"
        ? "cancel_appointment"
        : input.toStatus === "requested"
          ? "request_another_time"
          : "decline_proposal";
  if (!allowed.includes(actionKey as ClientAppointmentAction)) return { ok: false, reason: "validation" };
  if (row.version !== input.version) return { ok: false, reason: "conflict" };
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("adviser_appointments").update({
    crm_lifecycle_status: input.toStatus,
    status: mapLifecycleToLegacyStatus(input.toStatus),
    version: row.version + 1,
    updated_by_user_id: input.clientUserId,
    last_transition_at: new Date().toISOString(),
    last_transition_by_user_id: input.clientUserId,
    cancelled_at: input.toStatus === "cancelled_by_client" ? new Date().toISOString() : null,
    cancellation_reason_code: input.toStatus === "cancelled_by_client" ? input.reason.slice(0, 80) : null,
  } as never).eq("id", row.id).eq("version", input.version);
  if (error) return { ok: false, reason: "conflict" };
  await admin.from("crm_appointment_state_events").insert({
    appointment_id: row.id,
    client_id: row.client_id,
    adviser_user_id: row.adviser_user_id,
    event_type: "transition",
    from_state: fromStatus,
    to_state: input.toStatus,
    actor_user_id: input.clientUserId,
    occurred_at: new Date().toISOString(),
    reason_code: input.reason.slice(0, 80),
  } as never);
  return { ok: true };
}

export async function replaceClientTopics(input: {
  clientId: string;
  clientUserId: string;
  appointmentId: string;
  topics: string[];
}): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const row = await loadOwnedAppointment(input.clientId, input.appointmentId);
  if (!row) return { ok: false, reason: "not_found" };
  const admin = createAdminSupabaseClient();
  await admin.from("crm_appointment_client_topics").delete().eq("appointment_id", input.appointmentId);
  const topics = input.topics.slice(0, TOPIC_MAX).map((topic, index) => ({
    appointment_id: input.appointmentId,
    client_id: input.clientId,
    topic_text: safeTopic(topic),
    sort_order: (index + 1) * 10,
    created_by_user_id: input.clientUserId,
  })).filter((t) => t.topic_text.length > 0);
  if (topics.length) await admin.from("crm_appointment_client_topics").insert(topics as never);
  return { ok: true };
}

export async function completeClientChecklistItem(input: {
  clientId: string;
  appointmentId: string;
  itemId: string;
  completed: boolean;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" | "conflict" }> {
  const row = await loadOwnedAppointment(input.clientId, input.appointmentId);
  if (!row) return { ok: false, reason: "not_found" };
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("crm_appointment_checklist_items")
    .update({ completed: input.completed } as never)
    .eq("id", input.itemId)
    .eq("appointment_id", input.appointmentId)
    .in("visibility", ["client", "shared"])
    .in("owner", ["client", "shared"]);
  if (error) return { ok: false, reason: "conflict" };
  return { ok: true };
}
