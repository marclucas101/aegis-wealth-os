import "server-only";

import { CRM_V2_TIMELINE_MAX_ENTRIES } from "@/lib/crm-v2/constants";
import {
  buildLegacyDocumentVaultHref,
  buildLegacyMeetingStudioHref,
  buildLegacyPlanningOutputsHref,
  buildLegacyTasksHref,
  isAllowlistedRelationshipLink,
} from "@/lib/crm-v2/relationships/routes";
import { buildMomentsWorkspaceHref } from "@/lib/crm-v2/moments/routes";
import { buildAdvocacyWorkspaceHref } from "@/lib/crm-v2/advocacy/routes";
import { buildCommunicationsWorkspaceHref } from "@/lib/crm-v2/communications/routes";
import { createCrmMomentsAdmin } from "@/lib/crm-v2/moments/db";
import type { CrmTimelineEntry } from "@/lib/crm-v2/relationships/types";

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  insurance_policy: "Insurance document",
  investment_statement: "Investment document",
  cpf: "CPF document",
  estate: "Estate document",
  will: "Will document",
  trust: "Trust document",
  financial_statement: "Financial document",
  other: "Client document",
};

function safeDocumentTitle(category: string): string {
  return DOCUMENT_CATEGORY_LABELS[category] ?? "Client document";
}

function momentEventTitle(eventType: string): string {
  const labels: Record<string, string> = {
    moment_created: "Relationship moment created",
    moment_updated: "Relationship moment updated",
    moment_deactivated: "Relationship moment deactivated",
    moment_acknowledged: "Relationship moment acknowledged",
    suggestion_confirmed: "Festive suggestion confirmed",
    suggestion_rejected: "Festive suggestion rejected",
    review_rhythm_updated: "Review rhythm updated",
    client_preference_submitted: "Client preference submitted",
    client_preference_approved: "Client preference approved",
    review_requested: "Review requested",
  };
  return labels[eventType] ?? "Relationship moment activity";
}

function communicationEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    draft_created: "Communication draft created",
    template_rendered: "Template applied to draft",
    draft_updated: "Communication draft updated",
    review_requested: "Communication submitted for review",
    approved: "Communication approved",
    sent_or_logged: "Communication sent or logged",
    failed: "Communication delivery failed",
    archived: "Communication archived",
    client_replied: "Client replied to message",
    preference_conflict_recorded: "Communication preference conflict",
    follow_up_scheduled: "Communication follow-up scheduled",
    follow_up_completed: "Communication follow-up completed",
    cancelled: "Communication cancelled",
    received: "Communication received",
  };
  return titles[eventType] ?? "Communication activity";
}

function advocacyEventTitle(eventType: string): string {
  const labels: Record<string, string> = {
    advocacy_event_created: "Advocacy event recorded",
    advocacy_event_updated: "Advocacy event updated",
    consent_granted: "Advocacy consent granted",
    consent_limited: "Advocacy consent limited",
    consent_withdrawn: "Advocacy consent withdrawn",
    referral_outcome_updated: "Referral outcome updated",
    testimonial_permission_updated: "Testimonial permission updated",
    thank_you_recorded: "Thank-you recorded",
    advocacy_event_deactivated: "Advocacy event deactivated",
    do_not_ask_recorded: "Do-not-ask preference recorded",
  };
  return labels[eventType] ?? "Advocacy activity";
}

function meetingTitle(meetingType: string, status: string): string {
  const typeLabel = meetingType.replace(/_/g, " ");
  return `Meeting session — ${typeLabel} (${status.replace(/_/g, " ")})`;
}

export async function loadCrmTimelineProjection(
  clientId: string,
): Promise<{ timeline: CrmTimelineEntry[]; bounded: boolean }> {
  const admin = createCrmMomentsAdmin();

  const [
    meetingsResult,
    appointmentsResult,
    tasksResult,
    outputsResult,
    bindersResult,
    documentsResult,
    momentEventsResult,
    advocacyEventsResult,
    communicationEventsResult,
  ] = await Promise.all([
    admin
      .from("meeting_sessions")
      .select("id, meeting_type, status, created_at, completed_at, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("adviser_appointments")
      .select("id, status, starts_at, created_at, title")
      .eq("client_id", clientId)
      .order("starts_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("advisor_tasks")
      .select("id, title, task_type, status, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("published_outputs")
      .select("id, output_type, published_at, created_at, publication_status")
      .eq("client_id", clientId)
      .eq("publication_status", "published")
      .order("published_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("binder_exports")
      .select("id, status, published_at, created_at, published_to_client")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("documents")
      .select("id, category, created_at")
      .eq("client_id", clientId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("relationship_moment_events")
      .select("id, event_type, occurred_at, entity_type, entity_id")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("advocacy_domain_events")
      .select("id, event_type, occurred_at, entity_type, entity_id")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
    admin
      .from("crm_communication_domain_events")
      .select("id, event_type, occurred_at, entity_type, entity_id")
      .eq("client_id", clientId)
      .order("occurred_at", { ascending: false })
      .limit(CRM_V2_TIMELINE_MAX_ENTRIES),
  ]);

  const entries: CrmTimelineEntry[] = [];

  for (const row of (meetingsResult.data ?? []) as Array<{
    id: string;
    meeting_type: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    updated_at: string;
  }>) {
    const occurredAt = row.completed_at ?? row.updated_at ?? row.created_at;
    const href = buildLegacyMeetingStudioHref(clientId);
    entries.push({
      eventId: `meeting_session:${row.id}`,
      eventType: "meeting_session",
      occurredAt,
      title: meetingTitle(row.meeting_type, row.status),
      summary: "Meeting studio session activity",
      sourceLink: isAllowlistedRelationshipLink(href) ? href : null,
      visibility: "adviser",
    });
  }

  for (const row of (appointmentsResult.data ?? []) as Array<{
    id: string;
    status: string;
    starts_at: string;
    created_at: string;
    title: string | null;
  }>) {
    entries.push({
      eventId: `adviser_appointment:${row.id}`,
      eventType: "appointment",
      occurredAt: row.starts_at ?? row.created_at,
      title: row.title?.trim() || "Adviser appointment",
      summary: `Appointment ${row.status.replace(/_/g, " ")}`,
      sourceLink: `/advisor/appointments`,
      visibility: "adviser",
    });
  }

  for (const row of (tasksResult.data ?? []) as Array<{
    id: string;
    title: string;
    task_type: string;
    status: string;
    created_at: string;
  }>) {
    const href = buildLegacyTasksHref(clientId);
    entries.push({
      eventId: `advisor_task:${row.id}`,
      eventType: "adviser_task",
      occurredAt: row.created_at,
      title: row.title,
      summary: `${row.task_type.replace(/_/g, " ")} task — ${row.status.replace(/_/g, " ")}`,
      sourceLink: isAllowlistedRelationshipLink(href) ? href : null,
      visibility: "adviser",
    });
  }

  for (const row of (outputsResult.data ?? []) as Array<{
    id: string;
    output_type: string;
    published_at: string | null;
    created_at: string;
    publication_status: string;
  }>) {
    const href = buildLegacyPlanningOutputsHref(clientId);
    entries.push({
      eventId: `published_output:${row.id}`,
      eventType: "published_output",
      occurredAt: row.published_at ?? row.created_at,
      title: "Planning output published",
      summary: `${row.output_type.replace(/_/g, " ")} — ${row.publication_status}`,
      sourceLink: isAllowlistedRelationshipLink(href) ? href : null,
      visibility: "client_visible",
    });
  }

  for (const row of (bindersResult.data ?? []) as Array<{
    id: string;
    status: string;
    published_at: string | null;
    created_at: string;
    published_to_client: boolean;
  }>) {
    entries.push({
      eventId: `binder_export:${row.id}`,
      eventType: "binder_export",
      occurredAt: row.published_at ?? row.created_at,
      title: row.published_to_client ? "Binder published to client" : "Binder generated",
      summary: `Binder export ${row.status.replace(/_/g, " ")}`,
      sourceLink: buildLegacyDocumentVaultHref(clientId),
      visibility: row.published_to_client ? "client_visible" : "adviser",
    });
  }

  for (const row of (documentsResult.data ?? []) as Array<{
    id: string;
    category: string;
    created_at: string;
  }>) {
    entries.push({
      eventId: `document:${row.id}`,
      eventType: "document_upload",
      occurredAt: row.created_at,
      title: safeDocumentTitle(row.category),
      summary: "Document added to client vault",
      sourceLink: buildLegacyDocumentVaultHref(clientId),
      visibility: "adviser",
    });
  }

  for (const row of (momentEventsResult.data ?? []) as Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    entity_type: string;
    entity_id: string;
  }>) {
    const href = buildMomentsWorkspaceHref(clientId);
    entries.push({
      eventId: `relationship_moment_event:${row.id}`,
      eventType: "relationship_moment",
      occurredAt: row.occurred_at,
      title: momentEventTitle(row.event_type),
      summary: "Relationship moment activity",
      sourceLink: isAllowlistedRelationshipLink(href) ? href : null,
      visibility: row.event_type.startsWith("client_") ? "client_visible" : "adviser",
    });
  }

  for (const row of (advocacyEventsResult.data ?? []) as Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    entity_type: string;
    entity_id: string;
  }>) {
    const href = buildAdvocacyWorkspaceHref(clientId);
    entries.push({
      eventId: `advocacy_domain_event:${row.id}`,
      eventType: "advocacy",
      occurredAt: row.occurred_at,
      title: advocacyEventTitle(row.event_type),
      summary: "Advocacy activity",
      sourceLink: isAllowlistedRelationshipLink(href) ? href : null,
      visibility: row.event_type.startsWith("consent_") ? "client_visible" : "adviser",
    });
  }

  for (const row of (communicationEventsResult.data ?? []) as Array<{
    id: string;
    event_type: string;
    occurred_at: string;
    entity_type: string;
    entity_id: string;
  }>) {
    const href = `${buildCommunicationsWorkspaceHref()}?clientId=${clientId}`;
    entries.push({
      eventId: `communication_domain_event:${row.id}`,
      eventType: "communication",
      occurredAt: row.occurred_at,
      title: communicationEventTitle(row.event_type),
      summary: "Communication activity",
      sourceLink: isAllowlistedRelationshipLink(href) ? href : null,
      visibility: row.event_type === "client_replied" ? "client_visible" : "adviser",
    });
  }

  entries.sort((a, b) => {
    const aTime = new Date(a.occurredAt).getTime();
    const bTime = new Date(b.occurredAt).getTime();
    return bTime - aTime;
  });

  const bounded = entries.length > CRM_V2_TIMELINE_MAX_ENTRIES;
  return {
    timeline: entries.slice(0, CRM_V2_TIMELINE_MAX_ENTRIES),
    bounded,
  };
}
