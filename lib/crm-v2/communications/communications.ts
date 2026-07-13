import "server-only";

import { channelAllowsDraft } from "@/lib/crm-v2/communications/channels";
import { createCrmCommunicationsAdmin } from "@/lib/crm-v2/communications/db";
import {
  domainEventTypeForTransition,
  isClientVisibleStatus,
  isEditableStatus,
  validateCommunicationTransition,
  validateUpdateCommunicationRecord,
} from "@/lib/crm-v2/communications/lifecycle";
import {
  notifyClientVisibleMessage,
  notifyPreferenceUpdateSubmitted,
} from "@/lib/crm-v2/communications/notifications";
import { buildPreferenceWarnings, isCampaignStyleBlocked } from "@/lib/crm-v2/communications/restrictions";
import { renderTemplateBody, validateTemplateVariables } from "@/lib/crm-v2/communications/templates";
import type {
  AdviserCommunicationLabel,
  AdviserCommunicationPreferencesDto,
  AdviserCommunicationRecordDto,
  AdviserCommunicationsWorkspaceDto,
  AdviserCommunicationTemplateDto,
  ClientCommunicationPreferencesDto,
  ClientMessageDto,
  ClientMessageReplyInput,
  ClientMessagesInboxDto,
  CommunicationFollowUpInput,
  CreateCommunicationDraftInput,
  CrmCommunicationChannel,
  CrmCommunicationLifecycleStatus,
  CrmCommunicationSourceType,
  CrmCommunicationVisibility,
  CrmCommunicationWorkspaceView,
  TransitionCommunicationInput,
  UpdateClientCommunicationPreferencesInput,
  UpdateCommunicationRecordInput,
} from "@/lib/crm-v2/communications/types";
import {
  isValidCommunicationChannel,
  isValidCommunicationSourceType,
} from "@/lib/crm-v2/communications/types";
import {
  CRM_V2_COMMUNICATIONS_MAX_BODY_LENGTH,
  CRM_V2_COMMUNICATIONS_MAX_ITEMS,
  CRM_V2_COMMUNICATIONS_MAX_SUBJECT_LENGTH,
} from "@/lib/crm-v2/constants";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import type { AppClientRow } from "@/lib/supabase/userProfile";

export type CrmCommunicationsResult<T> =
  | { ok: false; reason: "not_found" | "forbidden" | "validation" | "conflict"; error?: string }
  | { ok: true; data: T };

async function requireAccessibleClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<CrmCommunicationsResult<{ client: AppClientRow }>> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };
  return { ok: true, data: { client: access.client } };
}

type RecordRow = {
  id: string;
  client_id: string;
  thread_id: string;
  source_type: string | null;
  source_id: string | null;
  channel: string;
  direction: string;
  lifecycle_status: string;
  safe_subject: string;
  safe_body: string | null;
  template_id: string | null;
  template_version: number | null;
  client_visibility: string;
  follow_up_status: string;
  next_follow_up_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  active: boolean;
  created_by_user_id: string;
};

type PreferenceRow = {
  client_id: string;
  preferred_channel: string;
  do_not_contact: boolean;
  promotional_content: boolean;
  festive_acknowledgement_opt_out: boolean;
  adviser_messages: boolean;
  client_message_visibility: string;
  last_confirmed_at: string | null;
  version: number;
};

type TemplateRow = {
  id: string;
  template_key: string;
  category: string;
  channel: string;
  title: string;
  body: string;
  variable_schema: string[] | unknown;
  compliance_status: string;
  version: number;
  active: boolean;
};

function sanitizeSubject(value: string): string {
  return value.trim().slice(0, CRM_V2_COMMUNICATIONS_MAX_SUBJECT_LENGTH);
}

function sanitizeBody(value: string | undefined): string | null {
  if (!value) return null;
  return value.trim().slice(0, CRM_V2_COMMUNICATIONS_MAX_BODY_LENGTH);
}

function bodyPreview(body: string | null): string | null {
  if (!body) return null;
  return body.length <= 120 ? body : `${body.slice(0, 119)}…`;
}

async function recordDomainEvent(input: {
  clientId: string;
  adviserUserId: string;
  eventType: string;
  entityType: "communication_thread" | "communication_record" | "communication_template" | "communication_preference";
  entityId: string;
  actorUserId: string;
  actorRole: "adviser" | "client" | "system";
  safeMetadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  const admin = createCrmCommunicationsAdmin();
  await admin.from("crm_communication_domain_events").insert({
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId,
    actor_user_id: input.actorUserId,
    actor_role: input.actorRole,
    safe_metadata: input.safeMetadata ?? {},
    request_id: input.requestId ?? null,
  });
}

async function loadPreferenceRow(clientId: string): Promise<PreferenceRow | null> {
  const admin = createCrmCommunicationsAdmin();
  const { data } = await admin
    .from("communication_preferences")
    .select(
      "client_id, preferred_channel, do_not_contact, promotional_content, festive_acknowledgement_opt_out, adviser_messages, client_message_visibility, last_confirmed_at, version",
    )
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as PreferenceRow | null) ?? null;
}

function buildRecordLabels(
  row: RecordRow,
  preferenceWarnings: string[],
): AdviserCommunicationLabel[] {
  const labels: AdviserCommunicationLabel[] = [];
  const status = row.lifecycle_status as CrmCommunicationLifecycleStatus;
  if (status === "draft") labels.push("draft");
  if (status === "pending_review") labels.push("pending_review");
  if (status === "approved") labels.push("approved");
  if (status === "failed") labels.push("failed");
  if (row.client_visibility === "client_visible" || row.client_visibility === "both") {
    labels.push("client_visible");
  } else {
    labels.push("adviser_only");
  }
  if (preferenceWarnings.length > 0) labels.push("preference_conflict");
  if (row.follow_up_status === "pending" || row.follow_up_status === "overdue") {
    labels.push("follow_up_due");
  }
  return labels;
}

async function mapRecordRow(
  row: RecordRow,
  clientDisplayName: string | null,
): Promise<AdviserCommunicationRecordDto> {
  const prefs = await loadPreferenceRow(row.client_id);
  const preferenceWarnings = buildPreferenceWarnings({
    doNotContact: prefs?.do_not_contact ?? false,
    marketingOptOut: !(prefs?.promotional_content ?? false),
    festiveAcknowledgementOptOut: prefs?.festive_acknowledgement_opt_out ?? false,
    adviserMessagesEnabled: prefs?.adviser_messages ?? true,
  });

  let templateKey: string | null = null;
  if (row.template_id) {
    const admin = createCrmCommunicationsAdmin();
    const { data } = await admin
      .from("crm_communication_templates")
      .select("template_key")
      .eq("id", row.template_id)
      .maybeSingle();
    templateKey = data ? String((data as { template_key: string }).template_key) : null;
  }

  return {
    recordId: row.id,
    threadId: row.thread_id,
    clientId: row.client_id,
    clientDisplayName,
    channel: row.channel as CrmCommunicationChannel,
    direction: row.direction as AdviserCommunicationRecordDto["direction"],
    lifecycleStatus: row.lifecycle_status as CrmCommunicationLifecycleStatus,
    safeSubject: row.safe_subject,
    safeBodyPreview: bodyPreview(row.safe_body),
    sourceType: row.source_type as CrmCommunicationSourceType | null,
    sourceId: row.source_id,
    clientVisibility: row.client_visibility as CrmCommunicationVisibility,
    followUpStatus: row.follow_up_status as AdviserCommunicationRecordDto["followUpStatus"],
    nextFollowUpDate: row.next_follow_up_date,
    templateKey,
    templateVersion: row.template_version,
    labels: buildRecordLabels(row, preferenceWarnings),
    preferenceWarnings,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureThread(input: {
  clientId: string;
  adviserUserId: string;
  channel: CrmCommunicationChannel;
  subject: string;
  sourceType?: CrmCommunicationSourceType;
  sourceId?: string;
}): Promise<string> {
  const admin = createCrmCommunicationsAdmin();
  const { data, error } = await admin
    .from("crm_communication_threads")
    .insert({
      client_id: input.clientId,
      adviser_user_id: input.adviserUserId,
      thread_type: input.sourceType ? "source_linked" : "relationship",
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      subject: input.subject,
      channel: input.channel,
      visibility: "adviser_only",
      status: "open",
      assigned_adviser_user_id: input.adviserUserId,
      last_activity_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Failed to create communication thread.");
  return String((data as { id: string }).id);
}

export async function loadAdviserCommunicationsWorkspace(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  view?: CrmCommunicationWorkspaceView;
  clientIdFilter?: string;
}): Promise<CrmCommunicationsResult<AdviserCommunicationsWorkspaceDto>> {
  const admin = createCrmCommunicationsAdmin();
  const view = input.view ?? "drafts";

  let query = admin
    .from("crm_communication_records")
    .select("*")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(CRM_V2_COMMUNICATIONS_MAX_ITEMS + 1);

  if (input.userRole === "advisor") {
    query = query.eq("created_by_user_id", input.authUserId);
  }
  if (input.clientIdFilter) {
    const access = await resolveAccessibleClient(
      input.authUserId,
      input.userRole,
      input.clientIdFilter,
    );
    if (access.status === "not_found") return { ok: false, reason: "not_found" };
    if (access.status === "forbidden") return { ok: false, reason: "forbidden" };
    query = query.eq("client_id", input.clientIdFilter);
  }

  const { data, error } = await query;
  if (error) return { ok: false, reason: "validation", error: "Unable to load communications." };

  const rows = (data ?? []) as RecordRow[];
  const bounded = rows.length > CRM_V2_COMMUNICATIONS_MAX_ITEMS;
  const limited = rows.slice(0, CRM_V2_COMMUNICATIONS_MAX_ITEMS);

  const clientIds = [...new Set(limited.map((r) => r.client_id))];
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await admin
      .from("clients")
      .select("id, display_name")
      .in("id", clientIds);
    for (const c of (clients ?? []) as Array<{ id: string; display_name: string }>) {
      clientNames.set(c.id, c.display_name);
    }
  }

  const mapped: AdviserCommunicationRecordDto[] = [];
  for (const row of limited) {
    mapped.push(await mapRecordRow(row, clientNames.get(row.client_id) ?? null));
  }

  const templates = await loadActiveTemplates();

  return {
    ok: true,
    data: {
      view,
      drafts: mapped.filter((r) => r.lifecycleStatus === "draft"),
      needsReview: mapped.filter((r) => r.lifecycleStatus === "pending_review"),
      recent: mapped.filter((r) =>
        ["sent", "logged", "received"].includes(r.lifecycleStatus),
      ),
      followUps: mapped.filter(
        (r) => r.followUpStatus === "pending" || r.followUpStatus === "overdue",
      ),
      actionRequired: mapped.filter(
        (r) => r.lifecycleStatus === "failed" || r.labels.includes("preference_conflict"),
      ),
      templates,
      bounded,
    },
  };
}

async function loadActiveTemplates(): Promise<AdviserCommunicationTemplateDto[]> {
  const admin = createCrmCommunicationsAdmin();
  const { data } = await admin
    .from("crm_communication_templates")
    .select("*")
    .eq("active", true)
    .eq("compliance_status", "approved")
    .order("category")
    .limit(CRM_V2_COMMUNICATIONS_MAX_ITEMS);

  return ((data ?? []) as TemplateRow[]).map((row) => ({
    templateId: row.id,
    templateKey: row.template_key,
    category: row.category as AdviserCommunicationTemplateDto["category"],
    channel: row.channel as AdviserCommunicationTemplateDto["channel"],
    title: row.title,
    bodyPreview: bodyPreview(row.body) ?? "",
    variableSchema: Array.isArray(row.variable_schema)
      ? (row.variable_schema as string[])
      : [],
    complianceStatus: row.compliance_status,
    version: row.version,
    active: row.active,
  }));
}

export async function createCommunicationDraft(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  payload: CreateCommunicationDraftInput;
  requestId?: string;
}): Promise<CrmCommunicationsResult<AdviserCommunicationRecordDto>> {
  if (!isValidCommunicationChannel(input.payload.channel)) {
    return { ok: false, reason: "validation", error: "Invalid channel." };
  }
  if (!channelAllowsDraft(input.payload.channel) && input.payload.channel !== "phone_call_log") {
    return { ok: false, reason: "validation", error: "Channel does not support drafts." };
  }
  if (input.payload.sourceType && !isValidCommunicationSourceType(input.payload.sourceType)) {
    return { ok: false, reason: "validation", error: "Invalid source type." };
  }

  const access = await requireAccessibleClient(
    input.authUserId,
    input.userRole,
    input.payload.clientId,
  );
  if (!access.ok) return { ok: false, reason: access.reason };
  const client = access.data.client;

  const prefs = await loadPreferenceRow(input.payload.clientId);
  if (prefs?.do_not_contact) {
    return { ok: false, reason: "validation", error: "Client has do-not-contact preference." };
  }

  const admin = createCrmCommunicationsAdmin();

  if (input.payload.idempotencyKey) {
    const { data: existing } = await admin
      .from("crm_communication_records")
      .select("*")
      .eq("client_id", input.payload.clientId)
      .eq("idempotency_key", input.payload.idempotencyKey)
      .eq("active", true)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        data: await mapRecordRow(existing as RecordRow, client.display_name),
      };
    }
  }

  let safeBody = sanitizeBody(input.payload.safeBody);
  let templateId: string | null = null;
  let templateVersion: number | null = null;

  if (input.payload.templateKey) {
    const { data: template } = await admin
      .from("crm_communication_templates")
      .select("*")
      .eq("template_key", input.payload.templateKey)
      .eq("active", true)
      .eq("compliance_status", "approved")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!template) {
      return { ok: false, reason: "validation", error: "Template not found." };
    }
    const t = template as TemplateRow;
    const schema = Array.isArray(t.variable_schema) ? (t.variable_schema as string[]) : [];
    const vars = input.payload.templateVariables ?? {};
    const varCheck = validateTemplateVariables(schema, vars);
    if (!varCheck.ok) return { ok: false, reason: "validation", error: varCheck.error };
    const rendered = renderTemplateBody(t.body, vars);
    if (!rendered.ok) return { ok: false, reason: "validation", error: rendered.error };
    safeBody = rendered.rendered;
    templateId = t.id;
    templateVersion = t.version;
  }

  const subject = sanitizeSubject(input.payload.safeSubject);
  const threadId = await ensureThread({
    clientId: input.payload.clientId,
    adviserUserId: input.authUserId,
    channel: input.payload.channel,
    subject,
    sourceType: input.payload.sourceType,
    sourceId: input.payload.sourceId,
  });

  const lifecycleStatus: CrmCommunicationLifecycleStatus =
    input.payload.channel === "phone_call_log" || input.payload.channel === "external_message_log"
      ? "logged"
      : "draft";

  const { data, error } = await admin
    .from("crm_communication_records")
    .insert({
      client_id: input.payload.clientId,
      thread_id: threadId,
      source_type: input.payload.sourceType ?? null,
      source_id: input.payload.sourceId ?? null,
      channel: input.payload.channel,
      direction: "outbound",
      lifecycle_status: lifecycleStatus,
      safe_subject: subject,
      safe_body: safeBody,
      template_id: templateId,
      template_version: templateVersion,
      created_by_user_id: input.authUserId,
      client_visibility: input.payload.clientVisibility ?? "adviser_only",
      consent_basis: "operational",
      delivery_state: lifecycleStatus === "logged" ? "logged_only" : "not_applicable",
      idempotency_key: input.payload.idempotencyKey ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, reason: "validation", error: "Unable to create draft." };
  }

  await recordDomainEvent({
    clientId: input.payload.clientId,
    adviserUserId: input.authUserId,
    eventType: templateId ? "template_rendered" : "draft_created",
    entityType: "communication_record",
    entityId: String((data as RecordRow).id),
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  await writeAuditLog({
    action: "crm_communication_draft_created",
    entityType: "crm_communication_record",
    entityId: String((data as RecordRow).id),
    clientId: input.payload.clientId,
    userId: input.authUserId,
    metadata: { channel: input.payload.channel },
  });

  return {
    ok: true,
    data: await mapRecordRow(data as RecordRow, client.display_name),
  };
}

export async function updateCommunicationRecord(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  communicationId: string;
  payload: UpdateCommunicationRecordInput;
  requestId?: string;
}): Promise<CrmCommunicationsResult<AdviserCommunicationRecordDto>> {
  const validation = validateUpdateCommunicationRecord(input.payload);
  if (!validation.ok) return { ok: false, reason: "validation", error: validation.error };

  const admin = createCrmCommunicationsAdmin();
  const { data: row } = await admin
    .from("crm_communication_records")
    .select("*")
    .eq("id", input.communicationId)
    .eq("active", true)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  const record = row as RecordRow;

  const access = await requireAccessibleClient(
    input.authUserId,
    input.userRole,
    record.client_id,
  );
  if (!access.ok) return { ok: false, reason: access.reason };
  const client = access.data.client;

  if (record.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Record was updated elsewhere." };
  }
  if (!isEditableStatus(record.lifecycle_status as CrmCommunicationLifecycleStatus)) {
    return { ok: false, reason: "validation", error: "Record is not editable." };
  }

  const updates: Record<string, unknown> = {
    version: record.version + 1,
  };
  if (input.payload.safeSubject !== undefined) {
    updates.safe_subject = sanitizeSubject(input.payload.safeSubject);
  }
  if (input.payload.safeBody !== undefined) {
    updates.safe_body = sanitizeBody(input.payload.safeBody);
  }
  if (input.payload.clientVisibility !== undefined) {
    updates.client_visibility = input.payload.clientVisibility;
  }

  const { data, error } = await admin
    .from("crm_communication_records")
    .update(updates)
    .eq("id", input.communicationId)
    .eq("version", record.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Record was updated elsewhere." };
  }

  await recordDomainEvent({
    clientId: record.client_id,
    adviserUserId: input.authUserId,
    eventType: "draft_updated",
    entityType: "communication_record",
    entityId: input.communicationId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return {
    ok: true,
    data: await mapRecordRow(data as RecordRow, client.display_name),
  };
}

export async function transitionCommunicationRecord(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  communicationId: string;
  payload: TransitionCommunicationInput;
  requestId?: string;
}): Promise<CrmCommunicationsResult<AdviserCommunicationRecordDto>> {
  const admin = createCrmCommunicationsAdmin();
  const { data: row } = await admin
    .from("crm_communication_records")
    .select("*")
    .eq("id", input.communicationId)
    .eq("active", true)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  const record = row as RecordRow;

  const access = await requireAccessibleClient(
    input.authUserId,
    input.userRole,
    record.client_id,
  );
  if (!access.ok) return { ok: false, reason: access.reason };
  const client = access.data.client;

  const currentStatus = record.lifecycle_status as CrmCommunicationLifecycleStatus;
  const transitionCheck = validateCommunicationTransition(currentStatus, input.payload);
  if (!transitionCheck.ok) {
    return { ok: false, reason: "validation", error: transitionCheck.error };
  }
  if (record.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Record was updated elsewhere." };
  }

  const prefs = await loadPreferenceRow(record.client_id);
  if (
    isCampaignStyleBlocked(!(prefs?.promotional_content ?? false), prefs?.do_not_contact ?? false) &&
    input.payload.transition === "mark_sent"
  ) {
    return { ok: false, reason: "validation", error: "Preference conflict blocks send." };
  }

  const updates: Record<string, unknown> = {
    lifecycle_status: transitionCheck.target,
    version: record.version + 1,
  };

  if (input.payload.transition === "approve") {
    updates.reviewed_by_user_id = input.authUserId;
  }
  if (input.payload.transition === "mark_sent" || input.payload.transition === "mark_logged") {
    updates.sent_by_user_id = input.authUserId;
    updates.delivery_state = "logged_only";
  }

  const { data, error } = await admin
    .from("crm_communication_records")
    .update(updates)
    .eq("id", input.communicationId)
    .eq("version", record.version)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Record was updated elsewhere." };
  }

  const updated = data as RecordRow;
  if (
    isClientVisibleStatus(transitionCheck.target) &&
    (updated.client_visibility === "client_visible" || updated.client_visibility === "both")
  ) {
    await notifyClientVisibleMessage({
      clientId: record.client_id,
      recordId: input.communicationId,
      safeSubject: updated.safe_subject,
    });
  }

  await recordDomainEvent({
    clientId: record.client_id,
    adviserUserId: input.authUserId,
    eventType: domainEventTypeForTransition(input.payload.transition),
    entityType: "communication_record",
    entityId: input.communicationId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return {
    ok: true,
    data: await mapRecordRow(updated, client.display_name),
  };
}

export async function updateCommunicationFollowUp(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  communicationId: string;
  payload: CommunicationFollowUpInput;
  requestId?: string;
}): Promise<CrmCommunicationsResult<AdviserCommunicationRecordDto>> {
  const admin = createCrmCommunicationsAdmin();
  const { data: row } = await admin
    .from("crm_communication_records")
    .select("*")
    .eq("id", input.communicationId)
    .eq("active", true)
    .maybeSingle();
  if (!row) return { ok: false, reason: "not_found" };
  const record = row as RecordRow;

  const access = await requireAccessibleClient(
    input.authUserId,
    input.userRole,
    record.client_id,
  );
  if (!access.ok) return { ok: false, reason: access.reason };
  const client = access.data.client;
  if (record.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Record was updated elsewhere." };
  }

  const updates: Record<string, unknown> = { version: record.version + 1 };
  if (input.payload.action === "schedule") {
    updates.follow_up_status = "pending";
    updates.next_follow_up_date = input.payload.nextFollowUpDate ?? null;
  } else {
    updates.follow_up_status = "completed";
    updates.next_follow_up_date = null;
  }

  const { data, error } = await admin
    .from("crm_communication_records")
    .update(updates)
    .eq("id", input.communicationId)
    .eq("version", record.version)
    .select("*")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, reason: "conflict", error: "Record was updated elsewhere." };
  }

  await recordDomainEvent({
    clientId: record.client_id,
    adviserUserId: input.authUserId,
    eventType: input.payload.action === "schedule" ? "follow_up_scheduled" : "follow_up_completed",
    entityType: "communication_record",
    entityId: input.communicationId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return {
    ok: true,
    data: await mapRecordRow(data as RecordRow, client.display_name),
  };
}

export async function loadAdviserCommunicationPreferences(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
}): Promise<CrmCommunicationsResult<AdviserCommunicationPreferencesDto>> {
  const access = await requireAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (!access.ok) return { ok: false, reason: access.reason };

  const prefs = await loadPreferenceRow(input.relationshipId);
  const preferenceWarnings = buildPreferenceWarnings({
    doNotContact: prefs?.do_not_contact ?? false,
    marketingOptOut: !(prefs?.promotional_content ?? false),
    festiveAcknowledgementOptOut: prefs?.festive_acknowledgement_opt_out ?? false,
    adviserMessagesEnabled: prefs?.adviser_messages ?? true,
  });

  return {
    ok: true,
    data: {
      relationshipId: input.relationshipId,
      preferredChannel: prefs?.preferred_channel ?? "in_app",
      doNotContact: prefs?.do_not_contact ?? false,
      marketingOptOut: !(prefs?.promotional_content ?? false),
      festiveAcknowledgementOptOut: prefs?.festive_acknowledgement_opt_out ?? false,
      clientMessageVisibility: prefs?.client_message_visibility ?? "visible",
      adviserMessagesEnabled: prefs?.adviser_messages ?? true,
      lastConfirmedAt: prefs?.last_confirmed_at ?? null,
      preferenceWarnings,
      version: prefs?.version ?? 1,
    },
  };
}

export async function loadClientMessages(input: {
  clientId: string;
}): Promise<ClientMessagesInboxDto> {
  const admin = createCrmCommunicationsAdmin();
  const { data } = await admin
    .from("crm_communication_records")
    .select("id, safe_subject, safe_body, direction, updated_at, version, lifecycle_status, client_visibility")
    .eq("client_id", input.clientId)
    .eq("active", true)
    .in("client_visibility", ["client_visible", "both"])
    .in("lifecycle_status", ["sent", "logged", "received"])
    .order("updated_at", { ascending: false })
    .limit(CRM_V2_COMMUNICATIONS_MAX_ITEMS + 1);

  const rows = (data ?? []) as Array<{
    id: string;
    safe_subject: string;
    safe_body: string | null;
    direction: string;
    updated_at: string;
    version: number;
    lifecycle_status: string;
    client_visibility: string;
  }>;

  const prefs = await loadPreferenceRow(input.clientId);
  const preferenceWarnings = buildPreferenceWarnings({
    doNotContact: prefs?.do_not_contact ?? false,
    marketingOptOut: !(prefs?.promotional_content ?? false),
    festiveAcknowledgementOptOut: prefs?.festive_acknowledgement_opt_out ?? false,
    adviserMessagesEnabled: prefs?.adviser_messages ?? true,
  });

  const messages: ClientMessageDto[] = rows.slice(0, CRM_V2_COMMUNICATIONS_MAX_ITEMS).map((row) => ({
    messageId: row.id,
    safeSubject: row.safe_subject,
    safeBody: row.safe_body ?? "",
    direction: row.direction as ClientMessageDto["direction"],
    occurredAt: row.updated_at,
    canReply: row.direction === "outbound" && (prefs?.adviser_messages ?? true),
    version: row.version,
  }));

  return { messages, preferenceWarnings, bounded: rows.length > CRM_V2_COMMUNICATIONS_MAX_ITEMS };
}

export async function replyToClientMessage(input: {
  clientId: string;
  authUserId: string;
  messageId: string;
  payload: ClientMessageReplyInput;
  requestId?: string;
}): Promise<CrmCommunicationsResult<ClientMessageDto>> {
  const body = sanitizeBody(input.payload.safeBody);
  if (!body || body.trim().length === 0) {
    return { ok: false, reason: "validation", error: "Reply body is required." };
  }

  const admin = createCrmCommunicationsAdmin();
  const { data: parent } = await admin
    .from("crm_communication_records")
    .select("*")
    .eq("id", input.messageId)
    .eq("client_id", input.clientId)
    .eq("active", true)
    .maybeSingle();
  if (!parent) return { ok: false, reason: "not_found" };
  const parentRow = parent as RecordRow;

  const prefs = await loadPreferenceRow(input.clientId);
  if (!prefs?.adviser_messages) {
    return { ok: false, reason: "validation", error: "Adviser messages disabled." };
  }

  const { data, error } = await admin
    .from("crm_communication_records")
    .insert({
      client_id: input.clientId,
      thread_id: parentRow.thread_id,
      channel: "internal_client_message",
      direction: "inbound",
      lifecycle_status: "received",
      safe_subject: `Re: ${parentRow.safe_subject}`.slice(0, CRM_V2_COMMUNICATIONS_MAX_SUBJECT_LENGTH),
      safe_body: body,
      created_by_user_id: input.authUserId,
      client_visibility: "both",
      consent_basis: "client_request",
      delivery_state: "logged_only",
    })
    .select("id, safe_subject, safe_body, direction, updated_at, version")
    .single();

  if (error || !data) {
    return { ok: false, reason: "validation", error: "Unable to send reply." };
  }

  await recordDomainEvent({
    clientId: input.clientId,
    adviserUserId: parentRow.created_by_user_id,
    eventType: "client_replied",
    entityType: "communication_record",
    entityId: String((data as { id: string }).id),
    actorUserId: input.authUserId,
    actorRole: "client",
    requestId: input.requestId,
  });

  const row = data as {
    id: string;
    safe_subject: string;
    safe_body: string | null;
    direction: string;
    updated_at: string;
    version: number;
  };

  return {
    ok: true,
    data: {
      messageId: row.id,
      safeSubject: row.safe_subject,
      safeBody: row.safe_body ?? "",
      direction: row.direction as ClientMessageDto["direction"],
      occurredAt: row.updated_at,
      canReply: false,
      version: row.version,
    },
  };
}

export async function loadClientCommunicationPreferences(input: {
  clientId: string;
}): Promise<ClientCommunicationPreferencesDto> {
  const prefs = await loadPreferenceRow(input.clientId);
  return {
    preferredChannel: prefs?.preferred_channel ?? "in_app",
    doNotContact: prefs?.do_not_contact ?? false,
    marketingOptOut: !(prefs?.promotional_content ?? false),
    festiveAcknowledgementOptOut: prefs?.festive_acknowledgement_opt_out ?? false,
    adviserMessagesEnabled: prefs?.adviser_messages ?? true,
    version: prefs?.version ?? 1,
  };
}

export async function updateClientCommunicationPreferences(input: {
  clientId: string;
  authUserId: string;
  payload: UpdateClientCommunicationPreferencesInput;
  requestId?: string;
}): Promise<CrmCommunicationsResult<ClientCommunicationPreferencesDto>> {
  if (input.payload.expectedVersion < 1) {
    return { ok: false, reason: "validation", error: "Invalid version." };
  }

  const admin = createCrmCommunicationsAdmin();
  const existing = await loadPreferenceRow(input.clientId);

  const updates: Record<string, unknown> = {
    version: (existing?.version ?? 1) + 1,
    last_confirmed_at: new Date().toISOString(),
  };
  if (input.payload.preferredChannel !== undefined) {
    updates.preferred_channel = input.payload.preferredChannel;
  }
  if (input.payload.doNotContact !== undefined) {
    updates.do_not_contact = input.payload.doNotContact;
  }
  if (input.payload.marketingOptOut !== undefined) {
    updates.promotional_content = !input.payload.marketingOptOut;
  }
  if (input.payload.festiveAcknowledgementOptOut !== undefined) {
    updates.festive_acknowledgement_opt_out = input.payload.festiveAcknowledgementOptOut;
  }
  if (input.payload.adviserMessagesEnabled !== undefined) {
    updates.adviser_messages = input.payload.adviserMessagesEnabled;
  }

  if (existing) {
    const { error } = await admin
      .from("communication_preferences")
      .update(updates)
      .eq("client_id", input.clientId)
      .eq("version", input.payload.expectedVersion);
    if (error) {
      return { ok: false, reason: "conflict", error: "Preferences were updated elsewhere." };
    }
  } else {
    const { error } = await admin.from("communication_preferences").insert({
      client_id: input.clientId,
      ...updates,
    });
    if (error) {
      return { ok: false, reason: "validation", error: "Unable to save preferences." };
    }
  }

  await notifyPreferenceUpdateSubmitted({ clientId: input.clientId });

  await recordDomainEvent({
    clientId: input.clientId,
    adviserUserId: input.authUserId,
    eventType: "preference_conflict_recorded",
    entityType: "communication_preference",
    entityId: input.clientId,
    actorUserId: input.authUserId,
    actorRole: "client",
    requestId: input.requestId,
  });

  return { ok: true, data: await loadClientCommunicationPreferences({ clientId: input.clientId }) };
}

export async function loadCrmCommunicationsEngagementSummary(clientId: string): Promise<string> {
  const admin = createCrmCommunicationsAdmin();
  const { count } = await admin
    .from("crm_communication_records")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("active", true)
    .in("follow_up_status", ["pending", "overdue"]);

  const followUps = count ?? 0;
  if (followUps > 0) return `${followUps} follow-up${followUps === 1 ? "" : "s"} due`;
  return "No open follow-ups";
}

export async function loadCrmCommunicationsRecentForRelationship(
  clientId: string,
): Promise<AdviserCommunicationRecordDto[]> {
  const admin = createCrmCommunicationsAdmin();
  const { data } = await admin
    .from("crm_communication_records")
    .select("*")
    .eq("client_id", clientId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(5);

  const rows = (data ?? []) as RecordRow[];
  const mapped: AdviserCommunicationRecordDto[] = [];
  for (const row of rows) {
    mapped.push(await mapRecordRow(row, null));
  }
  return mapped;
}
