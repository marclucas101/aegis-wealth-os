import type { WorkItemSourceType } from "@/lib/work-queue/sourceRegistry";

import {
  buildAppointmentDetailHref,
  buildAppointmentListHref,
} from "@/lib/crm-v2/appointments/routes";
import { buildCommunicationsWorkspaceHref } from "@/lib/crm-v2/communications/routes";
import { buildRelationshipDetailHref, buildRelationshipListHref } from "@/lib/crm-v2/relationships/routes";

const CLIENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TODAY_PREFIXES = [
  "/advisor-v2/today",
  "/advisor-v2/appointments",
  "/advisor-v2/relationships",
  "/advisor-v2/service",
  "/advisor-v2/communications",
  "/advisor-v2/settings",
  "/advisor-v2/operations",
] as const;

function assertRelationshipId(relationshipId: string): void {
  if (!CLIENT_ID_RE.test(relationshipId)) {
    throw new Error("Invalid relationship id for Today route");
  }
}

export function buildTodayHref(): string {
  return "/advisor-v2/today";
}

export function buildServiceWorkspaceHref(
  relationshipId?: string,
  view?: "requests" | "commitments",
): string {
  const base = "/advisor-v2/service";
  const params = new URLSearchParams();
  if (relationshipId) {
    assertRelationshipId(relationshipId);
    params.set("clientId", relationshipId);
  }
  if (view) params.set("view", view);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function buildProtectionWorkspaceHref(relationshipId: string): string {
  assertRelationshipId(relationshipId);
  return `/advisor-v2/relationships/${relationshipId}/protection`;
}

export function buildMomentsWorkspaceHref(relationshipId: string): string {
  assertRelationshipId(relationshipId);
  return `/advisor-v2/relationships/${relationshipId}/moments`;
}

export function buildAdvocacyWorkspaceHref(relationshipId: string): string {
  assertRelationshipId(relationshipId);
  return `/advisor-v2/relationships/${relationshipId}/advocacy`;
}

export function buildGoogleCalendarSettingsHref(): string {
  return "/advisor-v2/settings/integrations/google-calendar";
}

export function buildGoogleCalendarOperationsHref(): string {
  return "/advisor-v2/operations/google-calendar";
}

/** Map authoritative source types to CRM V2 workflow routes. */
export function buildTodayCardRouteHref(input: {
  sourceType: WorkItemSourceType | "google_calendar_connection" | "google_calendar_sync";
  sourceId: string;
  relationshipId: string | null;
  metadataAppointmentId?: string;
}): string {
  const relationshipId = input.relationshipId;

  switch (input.sourceType) {
    case "appointment":
      return buildAppointmentDetailHref(input.sourceId);
    case "meeting_follow_up":
      if (input.metadataAppointmentId) {
        return buildAppointmentDetailHref(input.metadataAppointmentId);
      }
      return buildAppointmentListHref("follow_up");
    case "service_commitment":
      return relationshipId
        ? buildServiceWorkspaceHref(relationshipId, "commitments")
        : "/advisor-v2/service";
    case "client_service_request":
    case "document_follow_up":
      return relationshipId
        ? buildServiceWorkspaceHref(relationshipId, "requests")
        : buildServiceWorkspaceHref(undefined, "requests");
    case "protection_extraction":
    case "protection_policy_servicing":
      return relationshipId
        ? buildProtectionWorkspaceHref(relationshipId)
        : buildRelationshipListHref();
    case "relationship_moment":
      return relationshipId
        ? buildMomentsWorkspaceHref(relationshipId)
        : buildRelationshipListHref();
    case "crm_review_rhythm":
    case "review_due":
      return relationshipId
        ? buildRelationshipDetailHref(relationshipId)
        : buildRelationshipListHref();
    case "client_preference_update":
      return relationshipId
        ? buildRelationshipDetailHref(relationshipId, "profile")
        : buildRelationshipListHref();
    case "advocacy_event":
      return relationshipId
        ? buildAdvocacyWorkspaceHref(relationshipId)
        : buildRelationshipListHref();
    case "communication_record":
      return relationshipId
        ? `/advisor-v2/communications?clientId=${relationshipId}`
        : buildCommunicationsWorkspaceHref("needs_review");
    case "google_calendar_connection":
    case "google_calendar_sync":
      return buildGoogleCalendarSettingsHref();
    default:
      return relationshipId
        ? buildRelationshipDetailHref(relationshipId)
        : buildTodayHref();
  }
}

export function isAllowlistedTodayHref(href: string): boolean {
  if (!href.startsWith("/")) return false;
  return ALLOWED_TODAY_PREFIXES.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`) || href.startsWith(`${prefix}?`),
  );
}
