import "server-only";

import type { AdvisorTaskRecord } from "@/lib/supabase/advisorTasks";
import {
  buildAdvisorReviewPipelineFromContexts,
  loadAdvisorClientReviewContexts,
} from "@/lib/supabase/advisorReviewPipeline";
import {
  buildClientFileQualityFromContext,
  loadAdvisorAccessibleClients,
  loadAdvisorClientQualityContexts,
} from "@/lib/supabase/clientFileQuality";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import type {
  WorkQueueAppointmentRow,
  WorkQueueBatchData,
  WorkQueueBinderExportRow,
  WorkQueueMeetingSessionRow,
  WorkQueuePlanningOutputRow,
  WorkQueueRoadmapRow,
} from "./batchData";
import { DEFAULT_ADVISER_TIMEZONE, WORK_QUEUE_LIMITS } from "./constants";

function mapRoadmapRow(row: Record<string, unknown>): WorkQueueRoadmapRow {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    itemKey: String(row.item_key),
    title: String(row.title ?? "Roadmap action"),
    status: row.status as WorkQueueRoadmapRow["status"],
    taskOwner: (row.task_owner as "client" | "adviser") ?? "adviser",
    clientVisible: Boolean(row.client_visible),
    priority: String(row.priority ?? "medium"),
    updatedAt: String(row.updated_at),
  };
}

async function loadTasksForClients(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientIds: string[],
): Promise<AdvisorTaskRecord[]> {
  if (clientIds.length === 0) return [];

  const admin = createAdminSupabaseClient();
  let query = admin
    .from("advisor_tasks")
    .select("*, clients(display_name)")
    .in("client_id", clientIds)
    .in("status", ["open", "in_progress"])
    .order("due_date", { ascending: true });

  if (userRole === "advisor") {
    query = query.or(
      `assigned_to_user_id.eq.${authUserId},created_by_user_id.eq.${authUserId}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load advisor tasks for work queue: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : null,
    clientDisplayName: null,
    assignedToUserId: String(row.assigned_to_user_id),
    createdByUserId: String(row.created_by_user_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    taskType: row.task_type as AdvisorTaskRecord["taskType"],
    priority: row.priority as AdvisorTaskRecord["priority"],
    status: row.status as AdvisorTaskRecord["status"],
    dueDate: row.due_date ? String(row.due_date) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    relatedEntityType: row.related_entity_type
      ? String(row.related_entity_type)
      : null,
    relatedEntityId: row.related_entity_id ? String(row.related_entity_id) : null,
    sourceKey: row.source_key ? String(row.source_key) : null,
    dismissedAt: row.dismissed_at ? String(row.dismissed_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

async function loadRoadmapItems(clientIds: string[]): Promise<WorkQueueRoadmapRow[]> {
  if (clientIds.length === 0) return [];
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("roadmap_items")
    .select(
      "id, client_id, item_key, title, status, task_owner, client_visible, priority, updated_at",
    )
    .in("client_id", clientIds)
    .eq("is_active", true)
    .neq("status", "completed");

  if (error) {
    throw new Error(`Failed to load roadmap items for work queue: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(mapRoadmapRow);
}

async function loadAppointments(
  adviserUserId: string,
  clientIds: string[],
  nowIso: string,
): Promise<WorkQueueAppointmentRow[]> {
  if (clientIds.length === 0) return [];

  const now = new Date(nowIso);
  const rangeStart = new Date(now);
  rangeStart.setDate(rangeStart.getDate() - WORK_QUEUE_LIMITS.appointmentLookbackDays);
  const rangeEnd = new Date(now);
  rangeEnd.setDate(rangeEnd.getDate() + WORK_QUEUE_LIMITS.appointmentWindowDays);

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("adviser_appointments")
    .select("id, client_id, starts_at, ends_at, timezone, status, appointment_type")
    .eq("adviser_user_id", adviserUserId)
    .in("client_id", clientIds)
    .gte("starts_at", rangeStart.toISOString())
    .lte("starts_at", rangeEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load appointments for work queue: ${error.message}`);
  }

  const clientNames = new Map<string, string>();
  const { data: clients } = await admin
    .from("clients")
    .select("id, display_name")
    .in("id", clientIds);
  for (const row of (clients ?? []) as { id: string; display_name: string }[]) {
    clientNames.set(row.id, row.display_name);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clientId: String(row.client_id),
    clientDisplayName: clientNames.get(String(row.client_id)) ?? "Client",
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    timezone: String(row.timezone ?? DEFAULT_ADVISER_TIMEZONE),
    status: row.status as WorkQueueAppointmentRow["status"],
    appointmentType: String(row.appointment_type),
  }));
}

async function loadMeetingSessions(
  clientIds: string[],
): Promise<WorkQueueMeetingSessionRow[]> {
  if (clientIds.length === 0) return [];
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("meeting_sessions")
    .select(
      "id, client_id, appointment_id, status, summary_status, scheduled_start, completed_at, updated_at",
    )
    .in("client_id", clientIds)
    .in("status", ["prepared", "in_progress", "completed"]);

  if (error) {
    throw new Error(`Failed to load meeting sessions for work queue: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clientId: String(row.client_id),
    appointmentId: row.appointment_id ? String(row.appointment_id) : null,
    status: String(row.status),
    summaryStatus: row.summary_status ? String(row.summary_status) : null,
    scheduledStart: row.scheduled_start ? String(row.scheduled_start) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    updatedAt: String(row.updated_at),
  }));
}

async function loadPlanningOutputs(
  clientIds: string[],
): Promise<WorkQueuePlanningOutputRow[]> {
  if (clientIds.length === 0) return [];
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("published_outputs")
    .select("id, client_id, output_type, publication_status, updated_at, created_at")
    .in("client_id", clientIds)
    .in("publication_status", ["draft", "adviser_reviewed"]);

  if (error) {
    throw new Error(`Failed to load planning outputs for work queue: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clientId: String(row.client_id),
    outputType: String(row.output_type),
    publicationStatus: String(row.publication_status),
    updatedAt: String(row.updated_at),
    createdAt: String(row.created_at),
  }));
}

async function loadBinderExports(
  clientIds: string[],
): Promise<WorkQueueBinderExportRow[]> {
  if (clientIds.length === 0) return [];
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("id, client_id, generation_status, status, generation_error_code, updated_at")
    .in("client_id", clientIds)
    .eq("generation_status", "failed");

  if (error) {
    throw new Error(`Failed to load binder exports for work queue: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    clientId: String(row.client_id),
    generationStatus: String(row.generation_status),
    status: String(row.status),
    generationErrorCode: row.generation_error_code
      ? String(row.generation_error_code)
      : null,
    updatedAt: String(row.updated_at),
  }));
}

export async function loadWorkQueueBatchData(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  clients: AppClientRow[];
  nowIso: string;
}): Promise<WorkQueueBatchData> {
  const clientIds = input.clients.map((c) => c.id).slice(0, WORK_QUEUE_LIMITS.maxClients);

  const [
    tasks,
    roadmapItems,
    reviewContexts,
    appointments,
    meetingSessions,
    planningOutputs,
    binderExports,
    qualityContexts,
  ] = await Promise.all([
    loadTasksForClients(input.authUserId, input.userRole, clientIds),
    loadRoadmapItems(clientIds),
    loadAdvisorClientReviewContexts(
      input.clients.filter((c) => clientIds.includes(c.id)),
    ),
    input.userRole === "advisor"
      ? loadAppointments(input.authUserId, clientIds, input.nowIso)
      : Promise.resolve([]),
    loadMeetingSessions(clientIds),
    loadPlanningOutputs(clientIds),
    loadBinderExports(clientIds),
    loadAdvisorClientQualityContexts(
      input.clients.filter((c) => clientIds.includes(c.id)),
    ),
  ]);

  const reviewPipeline = buildAdvisorReviewPipelineFromContexts(reviewContexts);
  const reviewClients = [
    ...reviewPipeline.overdue,
    ...reviewPipeline.dueThisMonth,
    ...reviewPipeline.highPriority,
  ];

  const fileQualityByClientId: WorkQueueBatchData["fileQualityByClientId"] = {};
  for (const context of qualityContexts) {
    const quality = buildClientFileQualityFromContext(context);
    fileQualityByClientId[context.client.id] = quality;
  }

  return {
    tasks,
    roadmapItems,
    reviewClients,
    appointments,
    meetingSessions,
    planningOutputs,
    binderExports,
    fileQualityByClientId,
  };
}

export async function loadWorkQueueClients(
  authUserId: string,
  userRole: "advisor" | "admin",
): Promise<AppClientRow[]> {
  const clients = await loadAdvisorAccessibleClients(authUserId, userRole);
  return clients.slice(0, WORK_QUEUE_LIMITS.maxClients);
}
