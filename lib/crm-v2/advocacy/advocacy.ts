import "server-only";

import { createCrmAdvocacyAdmin } from "@/lib/crm-v2/advocacy/db";
import {
  consentStateForEventType,
  deriveFollowUpStatus,
  domainEventTypeForTransition,
  isIdempotentConsentWithdrawal,
  validateAdvocacyTransition,
  validateClientPreferenceUpdate,
  validateConsentTransition,
  validateUpdateAdvocacyEvent,
} from "@/lib/crm-v2/advocacy/lifecycle";
import {
  notifyAdvocacyConsentWithdrawn,
  notifyTestimonialPermissionUpdated,
} from "@/lib/crm-v2/advocacy/notifications";
import { computeAdvocacyYearScore } from "@/lib/crm-v2/advocacy/score";
import type {
  AdviserAdvocacyEventDto,
  AdviserAdvocacyLabel,
  AdviserAdvocacySummaryDto,
  AdviserAdvocacyWorkspaceDto,
  ClientAdvocacyPreferencesDto,
  CreateAdvocacyEventInput,
  CrmAdvocacyConsentState,
  CrmAdvocacyEventType,
  CrmAdvocacyFollowUpStatus,
  CrmAdvocacyVisibility,
  TransitionAdvocacyEventInput,
  UpdateAdvocacyEventInput,
  UpdateClientAdvocacyPreferencesInput,
} from "@/lib/crm-v2/advocacy/types";
import {
  advocacyEventTypeLabel,
  isIntroductionEventType,
  isReferralEventType,
  isTestimonialEventType,
  isValidAdvocacyConsentState,
  isValidAdvocacyEventType,
} from "@/lib/crm-v2/advocacy/types";
import {
  CRM_V2_ADVOCACY_MAX_ITEMS,
  CRM_V2_ADVOCACY_MAX_TITLE_LENGTH,
} from "@/lib/crm-v2/constants";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export type CrmAdvocacyResult<T> =
  | { ok: false; reason: "not_found" | "forbidden" | "validation" | "conflict"; error?: string }
  | { ok: true; data: T };

type AdvocacyEventRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  event_type: string;
  event_date: string;
  consent_state: string;
  visibility: string;
  safe_title: string;
  notes: string | null;
  referred_person_label: string | null;
  has_contact_details: boolean;
  follow_up_status: string;
  next_follow_up_date: string | null;
  linked_appointment_id: string | null;
  linked_service_request_id: string | null;
  linked_relationship_moment_id: string | null;
  active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

type PreferenceRow = {
  client_id: string;
  testimonial_consent: string;
  referral_ask_opt_out: boolean;
  permission_to_mention: boolean;
  do_not_ask: boolean;
  version: number;
};

function sanitizeTitle(title: string): string {
  return title.trim().slice(0, CRM_V2_ADVOCACY_MAX_TITLE_LENGTH);
}

function buildAdvocacyLabels(
  row: AdvocacyEventRow,
  prefs?: PreferenceRow | null,
): AdviserAdvocacyLabel[] {
  const labels: AdviserAdvocacyLabel[] = [];
  if (row.consent_state === "granted" || row.consent_state === "limited") {
    labels.push("consent_granted");
  } else if (row.consent_state === "pending") {
    labels.push("consent_pending");
  } else if (row.consent_state === "withdrawn") {
    labels.push("consent_withdrawn");
  } else if (row.consent_state === "declined") {
    labels.push("consent_declined");
  }
  if (row.visibility === "client_visible" || row.visibility === "both") {
    labels.push("client_visible");
  } else {
    labels.push("adviser_only");
  }
  if (prefs?.do_not_ask) labels.push("do_not_ask");
  if (row.follow_up_status === "overdue" || row.follow_up_status === "pending") {
    labels.push("follow_up_due");
  }
  if (row.consent_state === "limited") labels.push("restricted");
  return labels;
}

function mapEventRow(row: AdvocacyEventRow, prefs?: PreferenceRow | null): AdviserAdvocacyEventDto {
  return {
    eventId: row.id,
    clientId: row.client_id,
    eventType: row.event_type as CrmAdvocacyEventType,
    eventDate: row.event_date,
    safeTitle: row.safe_title,
    consentState: row.consent_state as CrmAdvocacyConsentState,
    visibility: row.visibility as CrmAdvocacyVisibility,
    followUpStatus: row.follow_up_status as CrmAdvocacyFollowUpStatus,
    nextFollowUpDate: row.next_follow_up_date,
    referredPersonLabel: row.referred_person_label,
    hasContactDetails: row.has_contact_details,
    labels: buildAdvocacyLabels(row, prefs),
    linkedAppointmentId: row.linked_appointment_id,
    linkedServiceRequestId: row.linked_service_request_id,
    linkedRelationshipMomentId: row.linked_relationship_moment_id,
    active: row.active,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function recordAdvocacyDomainEvent(input: {
  clientId: string;
  adviserUserId: string;
  eventType: string;
  entityType: "advocacy_event" | "advocacy_preference";
  entityId: string;
  actorUserId: string;
  actorRole: "adviser" | "client" | "system";
  safeMetadata?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  const admin = createCrmAdvocacyAdmin();
  await admin.from("advocacy_domain_events").insert({
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

async function loadPreferencesRow(clientId: string): Promise<PreferenceRow | null> {
  const admin = createCrmAdvocacyAdmin();
  const { data } = await admin
    .from("crm_client_advocacy_preferences")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as PreferenceRow | null) ?? null;
}

async function buildSummary(
  clientId: string,
  prefs: PreferenceRow | null,
): Promise<AdviserAdvocacySummaryDto> {
  const score = await computeAdvocacyYearScore({ clientId });
  const admin = createCrmAdvocacyAdmin();
  const { count } = await admin
    .from("advocacy_events")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("active", true)
    .in("follow_up_status", ["pending", "overdue"]);

  return {
    relationshipId: clientId,
    calendarYear: score.calendarYear,
    eventCount: score.eventCount,
    yearlyScore: score.cappedScore,
    scoreExplanation: score.explanation,
    consentStatus: (prefs?.testimonial_consent ?? "unknown") as CrmAdvocacyConsentState,
    doNotAsk: prefs?.do_not_ask ?? false,
    referralAskOptOut: prefs?.referral_ask_opt_out ?? false,
    permissionToMention: prefs?.permission_to_mention ?? false,
    followUpDueCount: count ?? 0,
  };
}

export async function loadAdviserAdvocacyWorkspace(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
}): Promise<CrmAdvocacyResult<AdviserAdvocacyWorkspaceDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const client = access.client;
  const admin = createCrmAdvocacyAdmin();
  const limit = CRM_V2_ADVOCACY_MAX_ITEMS;

  const [eventsResult, prefs] = await Promise.all([
    admin
      .from("advocacy_events")
      .select("*")
      .eq("client_id", client.id)
      .eq("active", true)
      .order("event_date", { ascending: false })
      .limit(limit + 1),
    loadPreferencesRow(client.id),
  ]);

  const rows = (eventsResult.data ?? []) as AdvocacyEventRow[];
  const bounded = rows.length > limit;
  const events = rows.slice(0, limit).map((row) => mapEventRow(row, prefs));
  const summary = await buildSummary(client.id, prefs);

  return {
    ok: true,
    data: {
      relationshipId: client.id,
      summary,
      history: events,
      introductions: events.filter((e) => isIntroductionEventType(e.eventType)),
      referrals: events.filter((e) => isReferralEventType(e.eventType)),
      testimonials: events.filter((e) => isTestimonialEventType(e.eventType)),
      followUpNeeded: events.filter(
        (e) => e.followUpStatus === "pending" || e.followUpStatus === "overdue",
      ),
      bounded,
    },
  };
}

export async function loadCrmAdvocacyEngagementSummary(clientId: string): Promise<string> {
  const admin = createCrmAdvocacyAdmin();
  const { count } = await admin
    .from("advocacy_events")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("active", true);
  if (!count) return "No advocacy events recorded";
  return `${count} advocacy event${count === 1 ? "" : "s"} recorded`;
}

export async function createAdvocacyEvent(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  payload: CreateAdvocacyEventInput;
  requestId?: string;
}): Promise<CrmAdvocacyResult<AdviserAdvocacyEventDto>> {
  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const payload = input.payload;
  if (!isValidAdvocacyEventType(payload.eventType)) {
    return { ok: false, reason: "validation", error: "Invalid event type." };
  }
  if (!payload.safeTitle?.trim()) {
    return { ok: false, reason: "validation", error: "Title is required." };
  }

  const admin = createCrmAdvocacyAdmin();
  const client = access.client;

  if (payload.idempotencyKey) {
    const { data: existing } = await admin
      .from("advocacy_events")
      .select("*")
      .eq("client_id", client.id)
      .eq("idempotency_key", payload.idempotencyKey)
      .eq("active", true)
      .maybeSingle();
    if (existing) {
      const prefs = await loadPreferencesRow(client.id);
      return { ok: true, data: mapEventRow(existing as AdvocacyEventRow, prefs) };
    }
  }

  const prefs = await loadPreferencesRow(client.id);
  if (prefs?.do_not_ask && payload.eventType === "introduction_offered") {
    return { ok: false, reason: "validation", error: "Client has do-not-ask preference." };
  }

  const consentState =
    payload.consentState ?? consentStateForEventType(payload.eventType);
  const today = new Date().toISOString().slice(0, 10);

  const { data: inserted, error } = await admin
    .from("advocacy_events")
    .insert({
      client_id: client.id,
      adviser_user_id: client.advisor_user_id ?? input.authUserId,
      event_type: payload.eventType,
      event_date: payload.eventDate ?? today,
      source_type: payload.sourceType ?? "manual",
      source_id: payload.sourceId ?? null,
      initiated_by: "adviser",
      recorded_by: input.authUserId,
      consent_state: consentState,
      visibility: payload.visibility ?? "adviser_only",
      safe_title: sanitizeTitle(payload.safeTitle),
      notes: payload.notes?.trim().slice(0, 2000) ?? null,
      referred_person_label: payload.referredPersonLabel?.trim().slice(0, 120) ?? null,
      has_contact_details: payload.hasContactDetails ?? false,
      follow_up_status: payload.followUpStatus ?? "none",
      next_follow_up_date: payload.nextFollowUpDate ?? null,
      linked_appointment_id: payload.linkedAppointmentId ?? null,
      linked_service_request_id: payload.linkedServiceRequestId ?? null,
      linked_relationship_moment_id: payload.linkedRelationshipMomentId ?? null,
      idempotency_key: payload.idempotencyKey ?? null,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    return { ok: false, reason: "validation", error: "Unable to create advocacy event." };
  }

  await recordAdvocacyDomainEvent({
    clientId: client.id,
    adviserUserId: client.advisor_user_id ?? input.authUserId,
    eventType: "advocacy_event_created",
    entityType: "advocacy_event",
    entityId: inserted.id,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    safeMetadata: { eventType: payload.eventType },
    requestId: input.requestId,
  });

  await writeAuditLog({
    action: "crm_v2_advocacy_event_created",
    userId: input.authUserId,
    entityType: "advocacy_event",
    entityId: inserted.id,
    clientId: client.id,
    metadata: { eventType: payload.eventType },
  });

  return { ok: true, data: mapEventRow(inserted as AdvocacyEventRow, prefs) };
}

export async function updateAdvocacyEvent(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  eventId: string;
  payload: UpdateAdvocacyEventInput;
  requestId?: string;
}): Promise<CrmAdvocacyResult<AdviserAdvocacyEventDto>> {
  const validation = validateUpdateAdvocacyEvent(input.payload);
  if (!validation.ok) return { ok: false, reason: "validation", error: validation.error };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmAdvocacyAdmin();
  const { data: row } = await admin
    .from("advocacy_events")
    .select("*")
    .eq("id", input.eventId)
    .eq("client_id", access.client.id)
    .eq("active", true)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  const current = row as AdvocacyEventRow;
  if (current.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Stale version." };
  }

  if (input.payload.consentState) {
    const consentCheck = validateConsentTransition(
      current.consent_state as CrmAdvocacyConsentState,
      input.payload.consentState,
    );
    if (!consentCheck.ok) {
      return { ok: false, reason: "validation", error: consentCheck.error };
    }
  }

  const today = new Date().toISOString();
  const followUpStatus = input.payload.followUpStatus
    ? deriveFollowUpStatus(
        input.payload.nextFollowUpDate ?? current.next_follow_up_date,
        input.payload.followUpStatus,
        today,
      )
    : current.follow_up_status;

  const { data: updated, error } = await admin
    .from("advocacy_events")
    .update({
      safe_title: input.payload.safeTitle
        ? sanitizeTitle(input.payload.safeTitle)
        : current.safe_title,
      notes: input.payload.notes !== undefined ? input.payload.notes : current.notes,
      consent_state: input.payload.consentState ?? current.consent_state,
      visibility: input.payload.visibility ?? current.visibility,
      follow_up_status: followUpStatus,
      next_follow_up_date:
        input.payload.nextFollowUpDate !== undefined
          ? input.payload.nextFollowUpDate
          : current.next_follow_up_date,
      referred_person_label:
        input.payload.referredPersonLabel !== undefined
          ? input.payload.referredPersonLabel
          : current.referred_person_label,
      version: current.version + 1,
    })
    .eq("id", input.eventId)
    .eq("version", current.version)
    .select("*")
    .single();

  if (error || !updated) return { ok: false, reason: "conflict", error: "Update conflict." };

  await recordAdvocacyDomainEvent({
    clientId: access.client.id,
    adviserUserId: current.adviser_user_id,
    eventType: "advocacy_event_updated",
    entityType: "advocacy_event",
    entityId: input.eventId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  const prefs = await loadPreferencesRow(access.client.id);
  return { ok: true, data: mapEventRow(updated as AdvocacyEventRow, prefs) };
}

export async function transitionAdvocacyEvent(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  relationshipId: string;
  eventId: string;
  payload: TransitionAdvocacyEventInput;
  requestId?: string;
}): Promise<CrmAdvocacyResult<AdviserAdvocacyEventDto>> {
  const validation = validateAdvocacyTransition(input.payload);
  if (!validation.ok) return { ok: false, reason: "validation", error: validation.error };

  const access = await resolveAccessibleClient(
    input.authUserId,
    input.userRole,
    input.relationshipId,
  );
  if (access.status === "not_found") return { ok: false, reason: "not_found" };
  if (access.status === "forbidden") return { ok: false, reason: "forbidden" };

  const admin = createCrmAdvocacyAdmin();
  const { data: row } = await admin
    .from("advocacy_events")
    .select("*")
    .eq("id", input.eventId)
    .eq("client_id", access.client.id)
    .eq("active", true)
    .maybeSingle();

  if (!row) return { ok: false, reason: "not_found" };
  const current = row as AdvocacyEventRow;
  if (current.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Stale version." };
  }

  const updates: Record<string, unknown> = { version: current.version + 1 };
  if (input.payload.transition === "deactivate") {
    updates.active = false;
    updates.deactivated_at = new Date().toISOString();
  } else if (input.payload.transition === "consent_granted") {
    updates.consent_state = "granted";
  } else if (input.payload.transition === "consent_withdrawn") {
    updates.consent_state = "withdrawn";
  } else if (input.payload.transition === "thank_you_sent") {
    updates.follow_up_status = "completed";
    updates.event_type = "thank_you_sent";
    updates.safe_title = "Thank-you sent";
  }

  const { data: updated, error } = await admin
    .from("advocacy_events")
    .update(updates)
    .eq("id", input.eventId)
    .eq("version", current.version)
    .select("*")
    .single();

  if (error || !updated) return { ok: false, reason: "conflict", error: "Transition conflict." };

  const domainType = domainEventTypeForTransition(input.payload.transition);
  await recordAdvocacyDomainEvent({
    clientId: access.client.id,
    adviserUserId: current.adviser_user_id,
    eventType: domainType,
    entityType: "advocacy_event",
    entityId: input.eventId,
    actorUserId: input.authUserId,
    actorRole: "adviser",
    requestId: input.requestId,
  });

  const prefs = await loadPreferencesRow(access.client.id);
  return { ok: true, data: mapEventRow(updated as AdvocacyEventRow, prefs) };
}

export async function loadClientAdvocacyPreferences(input: {
  clientId: string;
}): Promise<ClientAdvocacyPreferencesDto> {
  const admin = createCrmAdvocacyAdmin();
  const prefs = await loadPreferencesRow(input.clientId);
  const { data: events } = await admin
    .from("advocacy_domain_events")
    .select("event_type, occurred_at, safe_metadata")
    .eq("client_id", input.clientId)
    .in("event_type", [
      "consent_granted",
      "consent_withdrawn",
      "testimonial_permission_updated",
      "do_not_ask_recorded",
    ])
    .order("occurred_at", { ascending: false })
    .limit(20);

  return {
    testimonialConsent: (prefs?.testimonial_consent ?? "unknown") as CrmAdvocacyConsentState,
    referralAskOptOut: prefs?.referral_ask_opt_out ?? false,
    permissionToMention: prefs?.permission_to_mention ?? false,
    doNotAsk: prefs?.do_not_ask ?? false,
    safeAcknowledgementHistory: (events ?? []).map((e) => ({
      eventType: String(e.event_type),
      occurredAt: String(e.occurred_at),
      safeTitle: advocacyEventTypeLabel(
        (e.safe_metadata as { eventType?: string })?.eventType as CrmAdvocacyEventType,
      ) || String(e.event_type).replace(/_/g, " "),
    })),
    version: prefs?.version ?? 1,
  };
}

export async function submitClientAdvocacyPreferences(input: {
  authUserId: string;
  clientId: string;
  adviserUserId: string;
  payload: UpdateClientAdvocacyPreferencesInput;
  requestId?: string;
}): Promise<CrmAdvocacyResult<ClientAdvocacyPreferencesDto>> {
  const validation = validateClientPreferenceUpdate(input.payload);
  if (!validation.ok) return { ok: false, reason: "validation", error: validation.error };

  const admin = createCrmAdvocacyAdmin();
  const existing = await loadPreferencesRow(input.clientId);

  if (existing && existing.version !== input.payload.expectedVersion) {
    return { ok: false, reason: "conflict", error: "Stale version." };
  }

  const nextConsent = input.payload.testimonialConsent ?? existing?.testimonial_consent ?? "unknown";
  if (
    existing &&
    isIdempotentConsentWithdrawal(
      existing.testimonial_consent as CrmAdvocacyConsentState,
      nextConsent as CrmAdvocacyConsentState,
    )
  ) {
    return { ok: true, data: await loadClientAdvocacyPreferences({ clientId: input.clientId }) };
  }

  if (input.payload.testimonialConsent && !isValidAdvocacyConsentState(input.payload.testimonialConsent)) {
    return { ok: false, reason: "validation", error: "Invalid consent state." };
  }

  const upsertPayload = {
    client_id: input.clientId,
    testimonial_consent: nextConsent,
    referral_ask_opt_out: input.payload.referralAskOptOut ?? existing?.referral_ask_opt_out ?? false,
    permission_to_mention: input.payload.permissionToMention ?? existing?.permission_to_mention ?? false,
    do_not_ask: input.payload.doNotAsk ?? existing?.do_not_ask ?? false,
    version: (existing?.version ?? 0) + 1,
  };

  const { error } = await admin.from("crm_client_advocacy_preferences").upsert(upsertPayload);
  if (error) return { ok: false, reason: "validation", error: "Unable to save preferences." };

  const domainEventType =
    nextConsent === "withdrawn"
      ? "consent_withdrawn"
      : nextConsent === "granted"
        ? "consent_granted"
        : input.payload.doNotAsk
          ? "do_not_ask_recorded"
          : "testimonial_permission_updated";

  await recordAdvocacyDomainEvent({
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    eventType: domainEventType,
    entityType: "advocacy_preference",
    entityId: input.clientId,
    actorUserId: input.authUserId,
    actorRole: "client",
    requestId: input.requestId,
  });

  if (nextConsent === "withdrawn") {
    await notifyAdvocacyConsentWithdrawn({ clientId: input.clientId });
  }
  if (input.payload.testimonialConsent === "granted") {
    await notifyTestimonialPermissionUpdated({ clientId: input.clientId });
  }

  await writeAuditLog({
    action: "crm_v2_client_advocacy_preferences_updated",
    userId: input.authUserId,
    entityType: "crm_client_advocacy_preferences",
    entityId: input.clientId,
    clientId: input.clientId,
    metadata: { consent: nextConsent },
  });

  return { ok: true, data: await loadClientAdvocacyPreferences({ clientId: input.clientId }) };
}

export async function withdrawClientAdvocacyConsent(input: {
  authUserId: string;
  clientId: string;
  adviserUserId: string;
  expectedVersion: number;
  requestId?: string;
}): Promise<CrmAdvocacyResult<ClientAdvocacyPreferencesDto>> {
  return submitClientAdvocacyPreferences({
    authUserId: input.authUserId,
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    requestId: input.requestId,
    payload: {
      expectedVersion: input.expectedVersion,
      testimonialConsent: "withdrawn",
      permissionToMention: false,
    },
  });
}
