import "server-only";

import {
  CRM_V2_MOMENTS_MAX_ITEMS,
  CRM_V2_MOMENTS_MAX_TITLE_LENGTH,
} from "@/lib/crm-v2/constants";
import { loadFestiveSuggestionsForClient } from "@/lib/crm-v2/moments/festiveSuggestions";
import {
  computeReviewStatus,
  isIdempotentAcknowledgement,
  validateMomentAcknowledgement,
  validateReviewRhythmStatusTransition,
  validateSuggestionTransition,
} from "@/lib/crm-v2/moments/lifecycle";
import {
  notifyClientPreferenceUpdateSubmitted,
  notifyClientRequestedReview,
} from "@/lib/crm-v2/moments/notifications";
import type {
  AdviserMomentLabel,
  AdviserMomentsWorkspaceDto,
  AdviserRelationshipMomentDto,
  AdviserReviewRhythmDto,
  ClientPreferenceUpdateInput,
  ClientRelationshipPreferencesDto,
  ClientSafePreferenceDto,
  CreateMomentInput,
  CrmClientEthnicity,
  CrmMomentConfirmationState,
  CrmMomentSensitivityClass,
  CrmMomentType,
  CrmMomentVisibility,
  UpdateMomentInput,
  UpdateReviewRhythmInput,
} from "@/lib/crm-v2/moments/types";
import {
  isValidEthnicity,
  isValidMomentType,
  momentTypeLabel,
  reviewTypeLabel,
} from "@/lib/crm-v2/moments/types";
import { createClientServiceRequest } from "@/lib/crm-v2/service/service";
import { createCrmMomentsAdmin } from "@/lib/crm-v2/moments/db";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export type CrmMomentsResult<T> =
  | { ok: false; reason: "not_found" | "forbidden" | "validation" | "conflict"; error?: string }
  | { ok: true; data: T };

type MomentRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  moment_type: string;
  title: string;
  moment_date: string | null;
  timezone: string;
  visibility: string;
  confirmation_state: string;
  sensitivity_class: string;
  reminder_preference: string;
  last_acknowledged_at: string | null;
  next_occurrence_date: string | null;
  holiday_key: string | null;
  linked_appointment_id: string | null;
  linked_commitment_id: string | null;
  active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

type ReviewRhythmRow = {
  id: string;
  client_id: string;
  review_type: string;
  cadence: string;
  next_due_date: string | null;
  last_completed_date: string | null;
  status: string;
  client_visibility: boolean;
  linked_appointment_id: string | null;
  version: number;
  updated_at: string;
};

function sanitizeTitle(title: string): string {
  return title.trim().slice(0, CRM_V2_MOMENTS_MAX_TITLE_LENGTH);
}

function buildMomentLabels(row: MomentRow): AdviserMomentLabel[] {
  const labels: AdviserMomentLabel[] = [];
  if (row.confirmation_state === "confirmed") labels.push("confirmed");
  if (row.confirmation_state === "suggested") labels.push("suggested", "unconfirmed");
  if (row.confirmation_state === "pending_client") labels.push("unconfirmed");
  if (row.visibility === "client_visible" || row.visibility === "both") {
    labels.push("client_visible");
  } else {
    labels.push("adviser_only");
  }
  if (row.sensitivity_class === "cultural_preference") {
    labels.push("sensitive_use_restricted");
  }
  return labels;
}

function mapMomentRow(row: MomentRow): AdviserRelationshipMomentDto {
  return {
    momentId: row.id,
    clientId: row.client_id,
    momentType: row.moment_type as CrmMomentType,
    title: row.title,
    momentDate: row.moment_date,
    nextOccurrenceDate: row.next_occurrence_date,
    timezone: row.timezone,
    visibility: row.visibility as CrmMomentVisibility,
    confirmationState: row.confirmation_state as CrmMomentConfirmationState,
    sensitivityClass: row.sensitivity_class as CrmMomentSensitivityClass,
    reminderPreference: row.reminder_preference,
    lastAcknowledgedAt: row.last_acknowledged_at,
    active: row.active,
    labels: buildMomentLabels(row),
    holidayKey: row.holiday_key,
    linkedAppointmentId: row.linked_appointment_id,
    linkedCommitmentId: row.linked_commitment_id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReviewRhythmRow(row: ReviewRhythmRow): AdviserReviewRhythmDto {
  return {
    reviewRhythmId: row.id,
    clientId: row.client_id,
    reviewType: row.review_type as AdviserReviewRhythmDto["reviewType"],
    cadence: row.cadence as AdviserReviewRhythmDto["cadence"],
    nextDueDate: row.next_due_date,
    lastCompletedDate: row.last_completed_date,
    status: row.status as AdviserReviewRhythmDto["status"],
    clientVisibility: row.client_visibility,
    linkedAppointmentId: row.linked_appointment_id,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

async function recordMomentEvent(input: {
  clientId: string;
  adviserUserId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  actorRole: "adviser" | "client" | "system";
  safeMetadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  const admin = createCrmMomentsAdmin();
  await admin.from("relationship_moment_events").insert({
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

export async function loadAdviserMomentsWorkspace(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
}): Promise<CrmMomentsResult<AdviserMomentsWorkspaceDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const client = access.client;
  const admin = createCrmMomentsAdmin();
  const limit = CRM_V2_MOMENTS_MAX_ITEMS;

  const [momentsResult, reviewResult, pendingPrefsResult] = await Promise.all([
    admin
      .from("relationship_moments")
      .select("*")
      .eq("client_id", client.id)
      .order("next_occurrence_date", { ascending: true, nullsFirst: false })
      .limit(limit + 1),
    admin
      .from("crm_review_rhythm")
      .select("*")
      .eq("client_id", client.id)
      .order("next_due_date", { ascending: true, nullsFirst: false })
      .limit(limit),
    admin
      .from("crm_client_preference_updates")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "pending_review"),
  ]);

  const moments = ((momentsResult.data ?? []) as MomentRow[]).map(mapMomentRow);
  const bounded = moments.length > limit;
  const trimmed = moments.slice(0, limit);

  const now = new Date();
  const upcomingMoments = trimmed.filter(
    (m) => m.active && m.nextOccurrenceDate && new Date(m.nextOccurrenceDate) >= now,
  );
  const importantDates = trimmed.filter((m) => m.active && m.momentType !== "festive_greeting");
  const pastAcknowledgements = trimmed.filter((m) => m.lastAcknowledgedAt !== null);

  const ethnicity = (client.ethnicity as CrmClientEthnicity | null) ?? null;
  const festiveSuggestions = await loadFestiveSuggestionsForClient({
    clientId: client.id,
    adviserUserId: input.authUserId,
    ethnicity,
  });

  const reviewRhythm = ((reviewResult.data ?? []) as ReviewRhythmRow[]).map(mapReviewRhythmRow);

  const clientPreferences: ClientSafePreferenceDto[] = [];
  if (client.date_of_birth) {
    clientPreferences.push({
      preferenceType: "birthday",
      label: "Birthday",
      value: client.date_of_birth,
      clientEditable: true,
    });
  }
  if (ethnicity) {
    clientPreferences.push({
      preferenceType: "ethnicity",
      label: "Cultural background",
      value: ethnicity.replace(/_/g, " "),
      clientEditable: true,
    });
  }

  const dataQualityWarnings: string[] = [];
  if (!client.date_of_birth) dataQualityWarnings.push("Birthday not recorded");
  if ((pendingPrefsResult.count ?? 0) > 0) {
    dataQualityWarnings.push(`${pendingPrefsResult.count} client preference update(s) pending review`);
  }

  return {
    ok: true,
    data: {
      relationshipId: client.id,
      upcomingMoments,
      importantDates,
      reviewRhythm,
      clientPreferences,
      festiveSuggestions: festiveSuggestions.map((s) => ({
        holidayKey: s.holidayKey,
        displayName: s.displayName,
        suggestedDate: s.suggestedDate,
        confirmationState: "suggested" as const,
        overrideAction: s.overrideAction,
        labels: ["suggested", "sensitive_use_restricted"] as AdviserMomentLabel[],
      })),
      pastAcknowledgements,
      dataQualityWarnings,
      bounded,
    },
  };
}

export async function createRelationshipMoment(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  payload: CreateMomentInput;
  requestId?: string;
}): Promise<CrmMomentsResult<AdviserRelationshipMomentDto>> {
  if (!isValidMomentType(input.payload.momentType)) {
    return { ok: false, reason: "validation", error: "Invalid moment type" };
  }
  const title = sanitizeTitle(input.payload.title);
  if (!title) return { ok: false, reason: "validation", error: "Title required" };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmMomentsAdmin();

  if (input.payload.idempotencyKey) {
    const { data: existing } = await admin
      .from("relationship_moments")
      .select("*")
      .eq("client_id", access.client.id)
      .eq("idempotency_key", input.payload.idempotencyKey)
      .eq("active", true)
      .maybeSingle();
    if (existing) {
      return { ok: true, data: mapMomentRow(existing as MomentRow) };
    }
  }

  const nextOccurrence = input.payload.momentDate ?? null;
  const { data, error } = await admin
    .from("relationship_moments")
    .insert({
      client_id: access.client.id,
      adviser_user_id: input.authUserId,
      moment_type: input.payload.momentType,
      title,
      moment_date: input.payload.momentDate ?? null,
      recurrence_rule: input.payload.recurrenceRule ?? null,
      timezone: input.payload.timezone ?? "Asia/Singapore",
      visibility: input.payload.visibility ?? "adviser_only",
      source_type: "manual",
      confirmation_state: "confirmed",
      reminder_preference: input.payload.reminderPreference ?? "in_app",
      next_occurrence_date: nextOccurrence,
      holiday_key: input.payload.holidayKey ?? null,
      idempotency_key: input.payload.idempotencyKey ?? null,
      sensitivity_class:
        input.payload.momentType === "festive_greeting"
          ? "cultural_preference"
          : "standard",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, reason: "validation", error: "Failed to create moment" };
  }

  await recordMomentEvent({
    clientId: access.client.id,
    adviserUserId: input.authUserId,
    eventType: "moment_created",
    entityType: "moment",
    entityId: data.id,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    safeMetadata: { momentType: input.payload.momentType },
    requestId: input.requestId,
  });

  await writeAuditLog({
    userId: input.authUserId,
    action: "crm_moment_created",
    entityType: "relationship_moment",
    entityId: data.id,
    clientId: access.client.id,
    metadata: { momentType: input.payload.momentType },
  });

  return { ok: true, data: mapMomentRow(data as MomentRow) };
}

export async function updateRelationshipMoment(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  momentId: string;
  payload: UpdateMomentInput;
  requestId?: string;
}): Promise<CrmMomentsResult<AdviserRelationshipMomentDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmMomentsAdmin();
  const { data: existing } = await admin
    .from("relationship_moments")
    .select("*")
    .eq("id", input.momentId)
    .eq("client_id", access.client.id)
    .maybeSingle();

  if (!existing) return { ok: false, reason: "not_found" };
  const row = existing as MomentRow;
  if (row.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  const updates: Record<string, unknown> = {
    version: row.version + 1,
    updated_at: new Date().toISOString(),
  };
  if (input.payload.title !== undefined) updates.title = sanitizeTitle(input.payload.title);
  if (input.payload.momentDate !== undefined) {
    updates.moment_date = input.payload.momentDate;
    updates.next_occurrence_date = input.payload.momentDate;
  }
  if (input.payload.visibility !== undefined) updates.visibility = input.payload.visibility;
  if (input.payload.reminderPreference !== undefined) {
    updates.reminder_preference = input.payload.reminderPreference;
  }

  const { data, error } = await admin
    .from("relationship_moments")
    .update(updates)
    .eq("id", input.momentId)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "conflict", error: "Update failed" };

  await recordMomentEvent({
    clientId: access.client.id,
    adviserUserId: input.authUserId,
    eventType: "moment_updated",
    entityType: "moment",
    entityId: input.momentId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return { ok: true, data: mapMomentRow(data as MomentRow) };
}

export async function acknowledgeRelationshipMoment(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  momentId: string;
  requestId?: string;
}): Promise<CrmMomentsResult<AdviserRelationshipMomentDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmMomentsAdmin();
  const { data: existing } = await admin
    .from("relationship_moments")
    .select("*")
    .eq("id", input.momentId)
    .eq("client_id", access.client.id)
    .maybeSingle();

  if (!existing) return { ok: false, reason: "not_found" };
  const row = existing as MomentRow;

  const validation = validateMomentAcknowledgement({
    active: row.active,
    confirmationState: row.confirmation_state as CrmMomentConfirmationState,
  });
  if (!validation.ok) return { ok: false, reason: "validation", error: validation.reason };

  if (isIdempotentAcknowledgement(row.last_acknowledged_at, 5)) {
    return { ok: true, data: mapMomentRow(row) };
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("relationship_moments")
    .update({
      last_acknowledged_at: now,
      version: row.version + 1,
    })
    .eq("id", input.momentId)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "conflict" };

  await recordMomentEvent({
    clientId: access.client.id,
    adviserUserId: input.authUserId,
    eventType: "moment_acknowledged",
    entityType: "moment",
    entityId: input.momentId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return { ok: true, data: mapMomentRow(data as MomentRow) };
}

export async function deactivateRelationshipMoment(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  momentId: string;
  expectedVersion: number;
  requestId?: string;
}): Promise<CrmMomentsResult<{ momentId: string }>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmMomentsAdmin();
  const { data, error } = await admin
    .from("relationship_moments")
    .update({
      active: false,
      deactivated_at: new Date().toISOString(),
      version: input.expectedVersion + 1,
    })
    .eq("id", input.momentId)
    .eq("client_id", access.client.id)
    .eq("version", input.expectedVersion)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "conflict" };

  await recordMomentEvent({
    clientId: access.client.id,
    adviserUserId: input.authUserId,
    eventType: "moment_deactivated",
    entityType: "moment",
    entityId: input.momentId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return { ok: true, data: { momentId: data.id } };
}

export async function confirmFestiveSuggestion(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  holidayKey: string;
  momentDate?: string | null;
  requestId?: string;
}): Promise<CrmMomentsResult<AdviserRelationshipMomentDto>> {
  return createRelationshipMoment({
    authUserId: input.authUserId,
    userRole: input.userRole,
    relationshipId: input.relationshipId,
    requestId: input.requestId,
    payload: {
      momentType: "festive_greeting",
      title: `Festive greeting — ${input.holidayKey}`,
      momentDate: input.momentDate,
      visibility: "adviser_only",
      holidayKey: input.holidayKey,
      idempotencyKey: `festive:${input.holidayKey}`,
    },
  });
}

export async function updateReviewRhythm(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  payload: UpdateReviewRhythmInput;
  requestId?: string;
}): Promise<CrmMomentsResult<AdviserReviewRhythmDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmMomentsAdmin();
  const { data: existing } = await admin
    .from("crm_review_rhythm")
    .select("*")
    .eq("client_id", access.client.id)
    .eq("review_type", "annual_review")
    .maybeSingle();

  if (!existing) {
    const nextDue = input.payload.nextDueDate ?? access.client.next_review_due ?? null;
    const status = computeReviewStatus(nextDue);
    const { data: created, error } = await admin
      .from("crm_review_rhythm")
      .insert({
        client_id: access.client.id,
        adviser_user_id: input.authUserId,
        review_type: "annual_review",
        cadence: input.payload.cadence ?? "annual",
        next_due_date: nextDue,
        last_completed_date: input.payload.lastCompletedDate ?? access.client.last_review_at ?? null,
        assigned_adviser_user_id: input.authUserId,
        source_type: "client_record",
        status,
        client_visibility: input.payload.clientVisibility ?? false,
      })
      .select("*")
      .single();
    if (error || !created) return { ok: false, reason: "validation" };
    return { ok: true, data: mapReviewRhythmRow(created as ReviewRhythmRow) };
  }

  const row = existing as ReviewRhythmRow;
  if (row.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Stale version" };
  }

  const newStatus = input.payload.status ?? row.status;
  if (input.payload.status && !validateReviewRhythmStatusTransition(row.status, newStatus)) {
    return { ok: false, reason: "validation", error: "Invalid status transition" };
  }

  const updates: Record<string, unknown> = { version: row.version + 1 };
  if (input.payload.cadence !== undefined) updates.cadence = input.payload.cadence;
  if (input.payload.nextDueDate !== undefined) updates.next_due_date = input.payload.nextDueDate;
  if (input.payload.lastCompletedDate !== undefined) {
    updates.last_completed_date = input.payload.lastCompletedDate;
  }
  if (input.payload.status !== undefined) updates.status = input.payload.status;
  if (input.payload.clientVisibility !== undefined) {
    updates.client_visibility = input.payload.clientVisibility;
  }

  const { data, error } = await admin
    .from("crm_review_rhythm")
    .update(updates)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("*")
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "conflict" };

  await recordMomentEvent({
    clientId: access.client.id,
    adviserUserId: input.authUserId,
    eventType: "review_rhythm_updated",
    entityType: "review_rhythm",
    entityId: row.id,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  return { ok: true, data: mapReviewRhythmRow(data as ReviewRhythmRow) };
}

export async function loadClientRelationshipPreferences(input: {
  clientId: string;
}): Promise<ClientRelationshipPreferencesDto> {
  const admin = createCrmMomentsAdmin();
  const { data: client } = await admin
    .from("clients")
    .select("id, date_of_birth, ethnicity, next_review_due")
    .eq("id", input.clientId)
    .maybeSingle();

  const { count } = await admin
    .from("crm_client_preference_updates")
    .select("id", { count: "exact", head: true })
    .eq("client_id", input.clientId)
    .eq("status", "pending_review");

  const { data: moments } = await admin
    .from("relationship_moments")
    .select("title, moment_date, confirmation_state")
    .eq("client_id", input.clientId)
    .eq("active", true)
    .in("visibility", ["client_visible", "both"])
    .limit(CRM_V2_MOMENTS_MAX_ITEMS);

  const importantDates = (moments ?? [])
    .filter((m) => m.moment_date)
    .map((m) => ({
      label: String(m.title),
      date: String(m.moment_date),
      confirmed: m.confirmation_state === "confirmed",
    }));

  const ethnicity = client?.ethnicity
    ? (String(client.ethnicity) as CrmClientEthnicity)
    : null;

  return {
    importantDates,
    birthdayAcknowledgementOptOut: false,
    festiveAcknowledgementOptOut: false,
    greetingPreference: null,
    ethnicity: ethnicity && isValidEthnicity(ethnicity) ? ethnicity : null,
    pendingUpdates: count ?? 0,
  };
}

export async function submitClientPreferenceUpdate(input: {
  clientId: string;
  authUserId: string;
  adviserUserId: string;
  payload: ClientPreferenceUpdateInput;
  requestId?: string;
}): Promise<CrmMomentsResult<{ updateId: string }>> {
  const admin = createCrmMomentsAdmin();

  if (input.payload.idempotencyKey) {
    const { data: existing } = await admin
      .from("crm_client_preference_updates")
      .select("id")
      .eq("client_id", input.clientId)
      .eq("idempotency_key", input.payload.idempotencyKey)
      .eq("status", "pending_review")
      .maybeSingle();
    if (existing) return { ok: true, data: { updateId: existing.id } };
  }

  const { data, error } = await admin
    .from("crm_client_preference_updates")
    .insert({
      client_id: input.clientId,
      adviser_user_id: input.adviserUserId,
      preference_type: input.payload.preferenceType,
      proposed_value: input.payload.proposedValue,
      idempotency_key: input.payload.idempotencyKey ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, reason: "validation" };

  await recordMomentEvent({
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    eventType: "client_preference_submitted",
    entityType: "preference_update",
    entityId: data.id,
    actorUserId: input.authUserId,
    actorRole: "client",
    requestId: input.requestId,
  });

  await notifyClientPreferenceUpdateSubmitted({
    clientId: input.clientId,
    preferenceType: input.payload.preferenceType,
    updateId: data.id,
  });

  return { ok: true, data: { updateId: data.id } };
}

export async function requestClientReview(input: {
  clientId: string;
  authUserId: string;
  adviserUserId: string;
  idempotencyKey?: string;
  requestId?: string;
}): Promise<CrmMomentsResult<{ requestId: string }>> {
  const result = await createClientServiceRequest({
    clientId: input.clientId,
    authUserId: input.authUserId,
    adviserUserId: input.adviserUserId,
    category: "review_request",
    summary: "Client requested a review",
    idempotencyKey: input.idempotencyKey,
    requestTraceId: input.requestId,
    now: new Date().toISOString(),
  });

  if (!result.ok) return { ok: false, reason: result.reason, error: result.error };

  await notifyClientRequestedReview({
    clientId: input.clientId,
    requestId: result.data.requestId,
  });

  return { ok: true, data: { requestId: result.data.requestId } };
}

export async function loadCrmMomentsEngagementSummary(clientId: string): Promise<string> {
  const admin = createCrmMomentsAdmin();
  const { count } = await admin
    .from("relationship_moments")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("active", true);

  const { count: reviewCount } = await admin
    .from("crm_review_rhythm")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["scheduled", "overdue"]);

  const parts: string[] = [];
  if ((count ?? 0) > 0) parts.push(`${count} active moments`);
  if ((reviewCount ?? 0) > 0) parts.push(`${reviewCount} review cadence`);
  return parts.length > 0 ? parts.join(" · ") : "No moments recorded";
}

export { momentTypeLabel, reviewTypeLabel, validateSuggestionTransition };
