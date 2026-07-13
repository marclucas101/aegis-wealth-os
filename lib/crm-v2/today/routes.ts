import type { WorkItemSourceType } from "@/lib/work-queue/sourceRegistry";

import {
  buildAppointmentDetailHref,
  buildAppointmentListHref,
} from "@/lib/crm-v2/appointments/routes";
import { buildCommunicationsWorkspaceHref } from "@/lib/crm-v2/communications/routes";
import { buildRelationshipDetailHref, buildRelationshipListHref } from "@/lib/crm-v2/relationships/routes";
import {
  CRM_V2_COMMUNICATIONS_PATH,
  CRM_V2_OPERATIONS_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_SERVICE_PATH,
  CRM_V2_SETTINGS_PATH,
  CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
  CRM_V2_TODAY_PATH,
} from "@/lib/crm-v2/navigation";

const CLIENT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_TODAY_PREFIXES = [
  CRM_V2_TODAY_PATH,
  "/advisor-v2/today",
  "/advisor/workspace/appointments",
  "/advisor-v2/appointments",
  CRM_V2_RELATIONSHIPS_PATH,
  "/advisor-v2/relationships",
  CRM_V2_SERVICE_PATH,
  "/advisor-v2/service",
  CRM_V2_COMMUNICATIONS_PATH,
  "/advisor-v2/communications",
  CRM_V2_SETTINGS_PATH,
  "/advisor-v2/settings",
  CRM_V2_OPERATIONS_PATH,
  "/advisor-v2/operations",
] as const;

function assertRelationshipId(relationshipId: string): void {
  if (!CLIENT_ID_RE.test(relationshipId)) {
    throw new Error("Invalid relationship id for Today route");
  }
}

export function buildTodayHref(): string {
  return CRM_V2_TODAY_PATH;
}

export function buildServiceWorkspaceHref(
  relationshipId?: string,
  view?: "requests" | "commitments",
): string {
  const base = CRM_V2_SERVICE_PATH;
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
  return `${CRM_V2_RELATIONSHIPS_PATH}/${relationshipId}/protection`;
}

export function buildMomentsWorkspaceHref(relationshipId: string): string {
  assertRelationshipId(relationshipId);
  return `${CRM_V2_RELATIONSHIPS_PATH}/${relationshipId}/moments`;
}

export function buildAdvocacyWorkspaceHref(relationshipId: string): string {
  assertRelationshipId(relationshipId);
  return `${CRM_V2_RELATIONSHIPS_PATH}/${relationshipId}/advocacy`;
}

export function buildGoogleCalendarSettingsHref(): string {
  return CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH;
}

export function buildGoogleCalendarOperationsHref(): string {
  return "/advisor/operations/google-calendar";
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
        : CRM_V2_SERVICE_PATH;
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
        ? `${CRM_V2_COMMUNICATIONS_PATH}?clientId=${relationshipId}`
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
