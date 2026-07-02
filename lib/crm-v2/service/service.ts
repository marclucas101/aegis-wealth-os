import "server-only";

import {
  CRM_V2_SERVICE_MAX_COMMITMENTS,
  CRM_V2_SERVICE_MAX_EVENTS,
  CRM_V2_SERVICE_MAX_TITLE_LENGTH,
} from "@/lib/crm-v2/constants";
import {
  commitmentStatusLabel,
  getAllowedAdviserCommitmentTransitions,
  getAllowedClientCommitmentTransitions,
  validateCommitmentTransition,
  canClientCompleteCommitment,
  CrmCommitmentTransitionError,
  type CrmCommitmentLifecycleStatus,
  type CrmCommitmentOwner,
  type CrmCommitmentTransitionReasonCode,
  type CrmCommitmentActorRole,
} from "@/lib/crm-v2/service/commitmentLifecycle";
import {
  clientVisibleServiceRequestStatus,
  isValidServiceRequestCategory,
  isValidServiceRequestUrgency,
  serviceRequestCategoryLabel,
  validateServiceRequestTransition,
  canClientCancelServiceRequest,
  CrmServiceRequestTransitionError,
  type CrmServiceRequestLifecycleStatus,
  type CrmServiceRequestTransitionReasonCode,
} from "@/lib/crm-v2/service/requestLifecycle";
import type {
  AdviserCommitmentDto,
  AdviserServiceRequestDto,
  ClientCommitmentActionDto,
  ClientServiceRequestDto,
  CrmCommitmentEventDto,
  CrmCommitmentType,
  CrmCommitmentVisibility,
  CrmServiceRequestEventDto,
} from "@/lib/crm-v2/service/types";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  notifyClientCommitmentAssigned,
  notifyClientRequestAcknowledged,
  notifyClientRequestInformationRequested,
  notifyClientRequestResolved,
  notifyClientRequestSubmitted,
  notifyCommitmentDueSoon,
} from "@/lib/crm-v2/service/notifications";

export type CrmServiceResult<T> =
  | { ok: false; reason: "not_found" | "forbidden" | "validation" | "conflict"; error?: string }
  | { ok: true; data: T };

type CommitmentRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  commitment_type: CrmCommitmentType;
  owner: CrmCommitmentOwner;
  visibility: CrmCommitmentVisibility;
  title: string;
  description: string | null;
  lifecycle_status: CrmCommitmentLifecycleStatus;
  due_at: string | null;
  completed_at: string | null;
  completion_note: string | null;
  completion_evidence: string | null;
  source_type: string | null;
  source_id: string | null;
  appointment_id: string | null;
  client_visible: boolean;
  internal_note: string | null;
  created_by_user_id: string;
  completed_by_user_id: string | null;
  version: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

type RequestRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  request_category: string;
  summary: string;
  details: string | null;
  lifecycle_status: CrmServiceRequestLifecycleStatus;
  urgency: string;
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
  resolution_summary: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  client_visible_status: string;
  version: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};

function sanitizeText(value: string, max: number): string {
  return value.replace(/<[^>]*>/g, "").trim().slice(0, max);
}

function mapOwnerToType(owner: CrmCommitmentOwner): CrmCommitmentType {
  if (owner === "adviser") return "adviser_commitment";
  if (owner === "client") return "client_commitment";
  return "shared_commitment";
}

function deriveVisibility(
  owner: CrmCommitmentOwner,
  clientVisible: boolean,
): CrmCommitmentVisibility {
  if (!clientVisible) return "adviser_only";
  if (owner === "shared") return "shared";
  return "client_visible";
}

async function loadCommitmentRow(commitmentId: string): Promise<CommitmentRow | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("service_commitments")
    .select("*")
    .eq("id", commitmentId)
    .maybeSingle();
  return (data as CommitmentRow | null) ?? null;
}

async function loadRequestRow(requestId: string): Promise<RequestRow | null> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("client_service_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  return (data as RequestRow | null) ?? null;
}

async function recordCommitmentEvent(input: {
  commitmentId: string;
  clientId: string;
  adviserUserId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId: string;
  actorRole: CrmCommitmentActorRole;
  occurredAt: string;
  reasonCode?: string | null;
  requestId?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("service_commitment_events").insert({
    commitment_id: input.commitmentId,
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    occurred_at: input.occurredAt,
    reason_code: input.reasonCode ?? null,
    request_id: input.requestId ?? null,
  } as never);
  if (error) throw new Error("Failed to record commitment event");
}

async function recordRequestEvent(input: {
  requestId: string;
  clientId: string;
  adviserUserId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId: string;
  actorRole: "adviser" | "client" | "system";
  occurredAt: string;
  reasonCode?: string | null;
  requestTraceId?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("client_service_request_events").insert({
    request_id: input.requestId,
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    occurred_at: input.occurredAt,
    reason_code: input.reasonCode ?? null,
    request_trace_id: input.requestTraceId ?? null,
  } as never);
  if (error) throw new Error("Failed to record service request event");
}

function toAdviserCommitmentDto(
  row: CommitmentRow,
  relationshipDisplayName: string | null,
): AdviserCommitmentDto {
  return {
    commitmentId: row.id,
    relationshipId: row.client_id,
    relationshipDisplayName,
    commitmentType: row.commitment_type,
    owner: row.owner,
    visibility: row.visibility,
    title: row.title,
    description: row.description,
    lifecycleStatus: row.lifecycle_status,
    lifecycleLabel: commitmentStatusLabel(row.lifecycle_status),
    dueAt: row.due_at,
    completedAt: row.completed_at,
    completionNote: row.completion_note,
    sourceType: row.source_type,
    sourceId: row.source_id,
    appointmentId: row.appointment_id,
    clientVisible: row.client_visible,
    internalNote: row.internal_note,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    allowedTransitions: getAllowedAdviserCommitmentTransitions(row.lifecycle_status),
  };
}

function toClientCommitmentDto(row: CommitmentRow): ClientCommitmentActionDto {
  return {
    commitmentId: row.id,
    commitmentType: row.commitment_type,
    owner: row.owner,
    title: row.title,
    description: row.description,
    lifecycleStatus: row.lifecycle_status,
    lifecycleLabel: commitmentStatusLabel(row.lifecycle_status),
    dueAt: row.due_at,
    completedAt: row.completed_at,
    version: row.version,
    updatedAt: row.updated_at,
    allowedTransitions: getAllowedClientCommitmentTransitions(row.lifecycle_status, row.owner),
    canComplete: canClientCompleteCommitment(row.owner),
  };
}

function nextExpectedAction(status: CrmServiceRequestLifecycleStatus): string {
  switch (status) {
    case "submitted":
      return "Acknowledge request";
    case "acknowledged":
    case "in_progress":
      return "Progress or resolve";
    case "waiting_on_client":
      return "Await client response";
    case "resolved":
      return "Close request";
    default:
      return "No action required";
  }
}

function toAdviserRequestDto(
  row: RequestRow,
  relationshipDisplayName: string | null,
): AdviserServiceRequestDto {
  const status = row.lifecycle_status;
  return {
    requestId: row.id,
    relationshipId: row.client_id,
    relationshipDisplayName,
    requestCategory: row.request_category as AdviserServiceRequestDto["requestCategory"],
    categoryLabel: serviceRequestCategoryLabel(
      row.request_category as AdviserServiceRequestDto["requestCategory"],
    ),
    summary: row.summary,
    details: row.details,
    lifecycleStatus: status,
    urgency: row.urgency as AdviserServiceRequestDto["urgency"],
    clientVisibleStatus: row.client_visible_status,
    acknowledgedAt: row.acknowledged_at,
    resolutionSummary: row.resolution_summary,
    resolvedAt: row.resolved_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextExpectedAction: nextExpectedAction(status),
    allowedTransitions: getAdviserRequestTransitions(status),
  };
}

function getAdviserRequestTransitions(
  from: CrmServiceRequestLifecycleStatus,
): CrmServiceRequestLifecycleStatus[] {
  const map: Record<CrmServiceRequestLifecycleStatus, CrmServiceRequestLifecycleStatus[]> = {
    submitted: ["acknowledged", "in_progress", "cancelled"],
    acknowledged: ["in_progress", "waiting_on_client", "resolved", "cancelled"],
    in_progress: ["waiting_on_client", "resolved", "closed", "cancelled"],
    waiting_on_client: ["in_progress", "resolved", "closed"],
    resolved: ["closed"],
    closed: [],
    cancelled: [],
  };
  return map[from] ?? [];
}

export async function createAdviserCommitment(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  owner: CrmCommitmentOwner;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  clientVisible: boolean;
  internalNote?: string | null;
  appointmentId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  commitmentType?: CrmCommitmentType;
  idempotencyKey?: string;
  requestId?: string;
  now: string;
}): Promise<CrmServiceResult<AdviserCommitmentDto>> {
  const access = await resolveAccessibleClient(input.authUserId, input.userRole, input.relationshipId);
  if (access.status !== "ok") {
    return { ok: false, reason: access.status === "not_found" ? "not_found" : "forbidden" };
  }
  const client = access.client;

  const title = sanitizeText(input.title, CRM_V2_SERVICE_MAX_TITLE_LENGTH);
  if (!title) return { ok: false, reason: "validation", error: "Title is required" };

  const admin = createAdminSupabaseClient();

  if (input.idempotencyKey && client.advisor_user_id) {
    const { data: existing } = await admin
      .from("service_commitments")
      .select("*")
      .eq("adviser_user_id", client.advisor_user_id)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        data: toAdviserCommitmentDto(existing as CommitmentRow, client.display_name),
      };
    }
  }

  if (input.sourceType && input.sourceId) {
    const { data: dup } = await admin
      .from("service_commitments")
      .select("*")
      .eq("source_type", input.sourceType)
      .eq("source_id", input.sourceId)
      .eq("commitment_type", input.commitmentType ?? mapOwnerToType(input.owner))
      .maybeSingle();
    if (dup) {
      return {
        ok: true,
        data: toAdviserCommitmentDto(dup as CommitmentRow, client.display_name),
      };
    }
  }

  const commitmentType = input.commitmentType ?? mapOwnerToType(input.owner);
  const visibility = deriveVisibility(input.owner, input.clientVisible);

  const { data, error } = await admin
    .from("service_commitments")
    .insert({
      client_id: input.relationshipId,
      adviser_user_id: client.advisor_user_id,
      commitment_type: commitmentType,
      owner: input.owner,
      visibility,
      title,
      description: input.description
        ? sanitizeText(input.description, 2000)
        : null,
      lifecycle_status: "open",
      due_at: input.dueAt ?? null,
      appointment_id: input.appointmentId ?? null,
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      client_visible: input.clientVisible,
      internal_note: input.internalNote
        ? sanitizeText(input.internalNote, 2000)
        : null,
      created_by_user_id: input.authUserId,
      idempotency_key: input.idempotencyKey ?? null,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, reason: "validation", error: "Failed to create commitment" };
  }

  const row = data as CommitmentRow;
  await recordCommitmentEvent({
    commitmentId: row.id,
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    eventType: "created",
    toStatus: "open",
    actorUserId: input.authUserId,
    actorRole: "adviser",
    occurredAt: input.now,
    reasonCode: "adviser_created",
    requestId: input.requestId ?? null,
  });

  await writeAuditLog({
    userId: input.authUserId,
    action: "crm_v2_commitment_created",
    entityType: "service_commitment",
    entityId: row.id,
    clientId: row.client_id,
    metadata: { commitmentType, owner: input.owner, clientVisible: input.clientVisible },
  });

  if (input.clientVisible && input.owner !== "adviser") {
    await notifyClientCommitmentAssigned({
      clientId: row.client_id,
      commitmentId: row.id,
      title: row.title,
    });
  }

  return { ok: true, data: toAdviserCommitmentDto(row, client.display_name) };
}

export async function transitionAdviserCommitment(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  commitmentId: string;
  toStatus: CrmCommitmentLifecycleStatus;
  reasonCode: CrmCommitmentTransitionReasonCode;
  version: number;
  completionNote?: string | null;
  completionEvidence?: string | null;
  cancelReason?: string | null;
  requestId?: string;
  now: string;
}): Promise<CrmServiceResult<AdviserCommitmentDto>> {
  const row = await loadCommitmentRow(input.commitmentId);
  if (!row) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(input.authUserId, input.userRole, row.client_id);
  if (access.status !== "ok") return { ok: false, reason: "forbidden" };
  const client = access.client;

  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  if (row.lifecycle_status === input.toStatus && input.toStatus === "completed") {
    return {
      ok: true,
      data: toAdviserCommitmentDto(row, client.display_name),
    };
  }

  try {
    validateCommitmentTransition({
      from: row.lifecycle_status,
      to: input.toStatus,
      actorRole: "adviser",
      owner: row.owner,
    });
  } catch (err) {
    if (err instanceof CrmCommitmentTransitionError) {
      return { ok: false, reason: "validation", error: err.message };
    }
    throw err;
  }

  const admin = createAdminSupabaseClient();
  const updatePayload: Record<string, unknown> = {
    lifecycle_status: input.toStatus,
    version: row.version + 1,
  };
  if (input.toStatus === "completed") {
    updatePayload.completed_at = input.now;
    updatePayload.completed_by_user_id = input.authUserId;
    updatePayload.completion_note = input.completionNote
      ? sanitizeText(input.completionNote, 1000)
      : null;
    updatePayload.completion_evidence = input.completionEvidence
      ? sanitizeText(input.completionEvidence, 1000)
      : null;
  }

  const { data, error } = await admin
    .from("service_commitments")
    .update(updatePayload as never)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Update conflict" };
  }

  const updated = data as CommitmentRow;
  await recordCommitmentEvent({
    commitmentId: updated.id,
    clientId: updated.client_id,
    adviserUserId: updated.adviser_user_id,
    eventType: input.toStatus === "completed" ? "completed" : input.toStatus === "cancelled" ? "cancelled" : "status_changed",
    fromStatus: row.lifecycle_status,
    toStatus: input.toStatus,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    occurredAt: input.now,
    reasonCode: input.reasonCode,
    requestId: input.requestId ?? null,
  });

  return { ok: true, data: toAdviserCommitmentDto(updated, client.display_name) };
}

export async function listAdviserCommitments(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId?: string;
  openOnly?: boolean;
}): Promise<AdviserCommitmentDto[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("service_commitments")
    .select("*, clients(display_name)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(CRM_V2_SERVICE_MAX_COMMITMENTS + 1);

  if (input.userRole === "advisor") {
    query = query.eq("adviser_user_id", input.authUserId);
  }
  if (input.relationshipId) {
    query = query.eq("client_id", input.relationshipId);
  }
  if (input.openOnly) {
    query = query.not("lifecycle_status", "in", "(completed,cancelled)");
  }

  const { data } = await query;
  return ((data ?? []) as Array<CommitmentRow & { clients: { display_name: string } | null }>)
    .slice(0, CRM_V2_SERVICE_MAX_COMMITMENTS)
    .map((row) =>
      toAdviserCommitmentDto(row, row.clients?.display_name ?? null),
    );
}

export async function getAdviserCommitmentDetail(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  commitmentId: string;
}): Promise<CrmServiceResult<{ commitment: AdviserCommitmentDto; events: CrmCommitmentEventDto[] }>> {
  const row = await loadCommitmentRow(input.commitmentId);
  if (!row) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(input.authUserId, input.userRole, row.client_id);
  if (access.status !== "ok") return { ok: false, reason: "forbidden" };
  const client = access.client;

  const admin = createAdminSupabaseClient();
  const { data: events } = await admin
    .from("service_commitment_events")
    .select("id, event_type, from_status, to_status, actor_role, occurred_at, reason_code")
    .eq("commitment_id", row.id)
    .order("occurred_at", { ascending: false })
    .limit(CRM_V2_SERVICE_MAX_EVENTS);

  return {
    ok: true,
    data: {
      commitment: toAdviserCommitmentDto(row, client.display_name),
      events: ((events ?? []) as Array<Record<string, unknown>>).map((e) => ({
        eventId: String(e.id),
        eventType: e.event_type as CrmCommitmentEventDto["eventType"],
        fromStatus: (e.from_status as string | null) ?? null,
        toStatus: (e.to_status as string | null) ?? null,
        actorRole: String(e.actor_role),
        occurredAt: String(e.occurred_at),
        reasonCode: (e.reason_code as string | null) ?? null,
      })),
    },
  };
}

export async function createClientServiceRequest(input: {
  clientId: string;
  authUserId: string;
  adviserUserId: string;
  category: string;
  summary: string;
  details?: string | null;
  urgency?: string;
  idempotencyKey?: string;
  requestTraceId?: string;
  now: string;
}): Promise<CrmServiceResult<ClientServiceRequestDto>> {
  if (!isValidServiceRequestCategory(input.category)) {
    return { ok: false, reason: "validation", error: "Invalid category" };
  }
  const urgency = input.urgency ?? "normal";
  if (!isValidServiceRequestUrgency(urgency)) {
    return { ok: false, reason: "validation", error: "Invalid urgency" };
  }

  const summary = sanitizeText(input.summary, 200);
  if (!summary) return { ok: false, reason: "validation", error: "Summary is required" };

  const admin = createAdminSupabaseClient();

  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from("client_service_requests")
      .select("*")
      .eq("client_id", input.clientId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return { ok: true, data: toClientRequestDto(existing as RequestRow) };
    }
  }

  const { data, error } = await admin
    .from("client_service_requests")
    .insert({
      client_id: input.clientId,
      adviser_user_id: input.adviserUserId,
      request_category: input.category,
      summary,
      details: input.details ? sanitizeText(input.details, 2000) : null,
      lifecycle_status: "submitted",
      urgency,
      client_visible_status: clientVisibleServiceRequestStatus("submitted"),
      idempotency_key: input.idempotencyKey ?? null,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, reason: "validation", error: "Failed to submit request" };
  }

  const row = data as RequestRow;
  await recordRequestEvent({
    requestId: row.id,
    clientId: row.client_id,
    adviserUserId: row.adviser_user_id,
    eventType: "created",
    toStatus: "submitted",
    actorUserId: input.authUserId,
    actorRole: "client",
    occurredAt: input.now,
    reasonCode: "client_submitted",
    requestTraceId: input.requestTraceId ?? null,
  });

  await notifyClientRequestSubmitted({
    clientId: row.client_id,
    requestId: row.id,
    summary: row.summary,
  });

  return { ok: true, data: toClientRequestDto(row) };
}

function toClientRequestDto(row: RequestRow): ClientServiceRequestDto {
  return {
    requestId: row.id,
    requestCategory: row.request_category as ClientServiceRequestDto["requestCategory"],
    categoryLabel: serviceRequestCategoryLabel(
      row.request_category as ClientServiceRequestDto["requestCategory"],
    ),
    summary: row.summary,
    details: row.details,
    lifecycleStatus: row.lifecycle_status,
    clientVisibleStatus: row.client_visible_status,
    resolutionSummary: row.resolution_summary,
    resolvedAt: row.resolved_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canRespond: row.lifecycle_status === "waiting_on_client",
    canCancel: canClientCancelServiceRequest(row.lifecycle_status),
  };
}

export async function listAdviserServiceRequests(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  openOnly?: boolean;
}): Promise<AdviserServiceRequestDto[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("client_service_requests")
    .select("*, clients(display_name)")
    .order("created_at", { ascending: false })
    .limit(CRM_V2_SERVICE_MAX_COMMITMENTS + 1);

  if (input.userRole === "advisor") {
    query = query.eq("adviser_user_id", input.authUserId);
  }
  if (input.openOnly) {
    query = query.not("lifecycle_status", "in", "(resolved,closed,cancelled)");
  }

  const { data } = await query;
  return ((data ?? []) as Array<RequestRow & { clients: { display_name: string } | null }>)
    .slice(0, CRM_V2_SERVICE_MAX_COMMITMENTS)
    .map((row) => toAdviserRequestDto(row, row.clients?.display_name ?? null));
}

export async function transitionAdviserServiceRequest(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  requestId: string;
  toStatus: CrmServiceRequestLifecycleStatus;
  reasonCode: CrmServiceRequestTransitionReasonCode;
  version: number;
  resolutionSummary?: string | null;
  requestTraceId?: string;
  now: string;
}): Promise<CrmServiceResult<AdviserServiceRequestDto>> {
  const row = await loadRequestRow(input.requestId);
  if (!row) return { ok: false, reason: "not_found" };

  const access = await resolveAccessibleClient(input.authUserId, input.userRole, row.client_id);
  if (access.status !== "ok") return { ok: false, reason: "forbidden" };
  const client = access.client;

  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  try {
    validateServiceRequestTransition({
      from: row.lifecycle_status,
      to: input.toStatus,
      actorRole: "adviser",
    });
  } catch (err) {
    if (err instanceof CrmServiceRequestTransitionError) {
      return { ok: false, reason: "validation", error: err.message };
    }
    throw err;
  }

  const admin = createAdminSupabaseClient();
  const updatePayload: Record<string, unknown> = {
    lifecycle_status: input.toStatus,
    client_visible_status: clientVisibleServiceRequestStatus(input.toStatus),
    version: row.version + 1,
  };

  if (input.toStatus === "acknowledged") {
    updatePayload.acknowledged_at = input.now;
    updatePayload.acknowledged_by_user_id = input.authUserId;
  }
  if (input.toStatus === "resolved" || input.toStatus === "closed") {
    updatePayload.resolved_at = input.now;
    updatePayload.resolved_by_user_id = input.authUserId;
    updatePayload.resolution_summary = input.resolutionSummary
      ? sanitizeText(input.resolutionSummary, 1000)
      : row.resolution_summary;
  }

  const { data, error } = await admin
    .from("client_service_requests")
    .update(updatePayload as never)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Update conflict" };
  }

  const updated = data as RequestRow;
  const eventType =
    input.toStatus === "acknowledged"
      ? "acknowledged"
      : input.toStatus === "waiting_on_client"
        ? "information_requested"
        : input.toStatus === "resolved"
          ? "resolved"
          : "status_changed";

  await recordRequestEvent({
    requestId: updated.id,
    clientId: updated.client_id,
    adviserUserId: updated.adviser_user_id,
    eventType,
    fromStatus: row.lifecycle_status,
    toStatus: input.toStatus,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    occurredAt: input.now,
    reasonCode: input.reasonCode,
    requestTraceId: input.requestTraceId ?? null,
  });

  if (input.toStatus === "acknowledged") {
    await notifyClientRequestAcknowledged({
      clientId: updated.client_id,
      requestId: updated.id,
    });
  } else if (input.toStatus === "waiting_on_client") {
    await notifyClientRequestInformationRequested({
      clientId: updated.client_id,
      requestId: updated.id,
    });
  } else if (input.toStatus === "resolved") {
    await notifyClientRequestResolved({
      clientId: updated.client_id,
      requestId: updated.id,
    });
  }

  return { ok: true, data: toAdviserRequestDto(updated, client.display_name) };
}

export async function listClientServiceRequests(
  clientId: string,
): Promise<ClientServiceRequestDto[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("client_service_requests")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(CRM_V2_SERVICE_MAX_COMMITMENTS);
  return ((data ?? []) as RequestRow[]).map(toClientRequestDto);
}

export async function getClientServiceRequest(
  clientId: string,
  requestId: string,
): Promise<CrmServiceResult<{ request: ClientServiceRequestDto; events: CrmServiceRequestEventDto[] }>> {
  const row = await loadRequestRow(requestId);
  if (!row || row.client_id !== clientId) {
    return { ok: false, reason: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data: events } = await admin
    .from("client_service_request_events")
    .select("id, event_type, from_status, to_status, actor_role, occurred_at, reason_code")
    .eq("request_id", requestId)
    .order("occurred_at", { ascending: false })
    .limit(CRM_V2_SERVICE_MAX_EVENTS);

  return {
    ok: true,
    data: {
      request: toClientRequestDto(row),
      events: ((events ?? []) as Array<Record<string, unknown>>).map((e) => ({
        eventId: String(e.id),
        eventType: e.event_type as CrmServiceRequestEventDto["eventType"],
        fromStatus: (e.from_status as string | null) ?? null,
        toStatus: (e.to_status as string | null) ?? null,
        actorRole: String(e.actor_role),
        occurredAt: String(e.occurred_at),
        reasonCode: (e.reason_code as string | null) ?? null,
      })),
    },
  };
}

export async function clientRespondToServiceRequest(input: {
  clientId: string;
  authUserId: string;
  requestId: string;
  responseText: string;
  version: number;
  requestTraceId?: string;
  now: string;
}): Promise<CrmServiceResult<ClientServiceRequestDto>> {
  const row = await loadRequestRow(input.requestId);
  if (!row || row.client_id !== input.clientId) {
    return { ok: false, reason: "not_found" };
  }
  if (row.lifecycle_status !== "waiting_on_client") {
    return { ok: false, reason: "validation", error: "Response not expected" };
  }
  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  const response = sanitizeText(input.responseText, 2000);
  if (!response) return { ok: false, reason: "validation", error: "Response is required" };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_service_requests")
    .update({
      lifecycle_status: "in_progress",
      client_visible_status: clientVisibleServiceRequestStatus("in_progress"),
      details: `${row.details ?? ""}\n\n[Client response]\n${response}`.slice(0, 2000),
      version: row.version + 1,
    } as never)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Update conflict" };
  }

  const updated = data as RequestRow;
  await recordRequestEvent({
    requestId: updated.id,
    clientId: updated.client_id,
    adviserUserId: updated.adviser_user_id,
    eventType: "client_responded",
    fromStatus: row.lifecycle_status,
    toStatus: "in_progress",
    actorUserId: input.authUserId,
    actorRole: "client",
    occurredAt: input.now,
    reasonCode: "client_responded",
    requestTraceId: input.requestTraceId ?? null,
  });

  return { ok: true, data: toClientRequestDto(updated) };
}

export async function clientCancelServiceRequest(input: {
  clientId: string;
  authUserId: string;
  requestId: string;
  version: number;
  requestTraceId?: string;
  now: string;
}): Promise<CrmServiceResult<ClientServiceRequestDto>> {
  const row = await loadRequestRow(input.requestId);
  if (!row || row.client_id !== input.clientId) {
    return { ok: false, reason: "not_found" };
  }
  if (!canClientCancelServiceRequest(row.lifecycle_status)) {
    return { ok: false, reason: "validation", error: "Cannot cancel request" };
  }
  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  try {
    validateServiceRequestTransition({
      from: row.lifecycle_status,
      to: "cancelled",
      actorRole: "client",
    });
  } catch (err) {
    if (err instanceof CrmServiceRequestTransitionError) {
      return { ok: false, reason: "validation", error: err.message };
    }
    throw err;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("client_service_requests")
    .update({
      lifecycle_status: "cancelled",
      client_visible_status: clientVisibleServiceRequestStatus("cancelled"),
      version: row.version + 1,
    } as never)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Update conflict" };
  }

  const updated = data as RequestRow;
  await recordRequestEvent({
    requestId: updated.id,
    clientId: updated.client_id,
    adviserUserId: updated.adviser_user_id,
    eventType: "cancelled",
    fromStatus: row.lifecycle_status,
    toStatus: "cancelled",
    actorUserId: input.authUserId,
    actorRole: "client",
    occurredAt: input.now,
    reasonCode: "client_cancelled",
    requestTraceId: input.requestTraceId ?? null,
  });

  return { ok: true, data: toClientRequestDto(updated) };
}

export async function transitionClientCommitment(input: {
  clientId: string;
  authUserId: string;
  commitmentId: string;
  toStatus: CrmCommitmentLifecycleStatus;
  version: number;
  completionNote?: string | null;
  requestTraceId?: string;
  now: string;
}): Promise<CrmServiceResult<ClientCommitmentActionDto>> {
  const row = await loadCommitmentRow(input.commitmentId);
  if (!row || row.client_id !== input.clientId || !row.client_visible) {
    return { ok: false, reason: "not_found" };
  }

  if (row.version !== input.version) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  if (row.lifecycle_status === input.toStatus && input.toStatus === "completed") {
    return { ok: true, data: toClientCommitmentDto(row) };
  }

  try {
    validateCommitmentTransition({
      from: row.lifecycle_status,
      to: input.toStatus,
      actorRole: "client",
      owner: row.owner,
    });
  } catch (err) {
    if (err instanceof CrmCommitmentTransitionError) {
      return { ok: false, reason: "validation", error: err.message };
    }
    throw err;
  }

  const admin = createAdminSupabaseClient();
  const updatePayload: Record<string, unknown> = {
    lifecycle_status: input.toStatus,
    version: row.version + 1,
  };
  if (input.toStatus === "completed") {
    updatePayload.completed_at = input.now;
    updatePayload.completed_by_user_id = input.authUserId;
    updatePayload.completion_note = input.completionNote
      ? sanitizeText(input.completionNote, 1000)
      : null;
  }

  const { data, error } = await admin
    .from("service_commitments")
    .update(updatePayload as never)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Update conflict" };
  }

  const updated = data as CommitmentRow;
  await recordCommitmentEvent({
    commitmentId: updated.id,
    clientId: updated.client_id,
    adviserUserId: updated.adviser_user_id,
    eventType: input.toStatus === "completed" ? "completed" : "status_changed",
    fromStatus: row.lifecycle_status,
    toStatus: input.toStatus,
    actorUserId: input.authUserId,
    actorRole: "client",
    occurredAt: input.now,
    reasonCode: "client_progressed",
    requestId: input.requestTraceId ?? null,
  });

  return { ok: true, data: toClientCommitmentDto(updated) };
}

export async function listClientActions(clientId: string): Promise<ClientCommitmentActionDto[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("service_commitments")
    .select("*")
    .eq("client_id", clientId)
    .eq("client_visible", true)
    .not("lifecycle_status", "in", "(cancelled)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(CRM_V2_SERVICE_MAX_COMMITMENTS);

  return ((data ?? []) as CommitmentRow[])
    .filter((row) => row.owner === "client" || row.owner === "shared" || row.commitment_type === "document_request")
    .map(toClientCommitmentDto);
}

export { notifyCommitmentDueSoon };
