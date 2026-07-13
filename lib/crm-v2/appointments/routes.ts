/** Allowlisted internal route builders for CRM V2 appointment workspace. */

import type { CrmAppointmentListView } from "./types";
import {
  CRM_V2_APPOINTMENTS_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
} from "@/lib/crm-v2/navigation";

const ALLOWED_PREFIXES = [
  CRM_V2_APPOINTMENTS_PATH,
  "/advisor-v2/appointments",
  CRM_V2_RELATIONSHIPS_PATH,
  "/advisor-v2/relationships",
  "/advisor/clients",
] as const;

export const CRM_V2_APPOINTMENT_LIST_VIEWS: CrmAppointmentListView[] = [
  "agenda",
  "upcoming",
  "requests",
  "preparation",
  "follow_up",
  "history",
];

export function buildAppointmentListHref(view?: CrmAppointmentListView): string {
  const base = CRM_V2_APPOINTMENTS_PATH;
  if (!view || view === "agenda") {
    return base;
  }
  return `${base}?view=${view}`;
}

export function buildAppointmentDetailHref(appointmentId: string): string {
  return `${CRM_V2_APPOINTMENTS_PATH}/${appointmentId}`;
}

export function buildAppointmentNewHref(relationshipId?: string): string {
  const base = `${CRM_V2_APPOINTMENTS_PATH}/new`;
  if (!relationshipId) {
    return base;
  }
  return `${base}?relationshipId=${relationshipId}`;
}

export function buildMeetingStudioHref(clientId: string): string {
  return `/advisor/clients/${clientId}/meeting-studio`;
}

export function buildRelationshipHref(relationshipId: string): string {
  return `${CRM_V2_RELATIONSHIPS_PATH}/${relationshipId}`;
}

export function isAllowlistedAppointmentLink(href: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`),
  );
}

export function parseAppointmentListView(
  value: string | null | undefined,
): CrmAppointmentListView {
  if (value && CRM_V2_APPOINTMENT_LIST_VIEWS.includes(value as CrmAppointmentListView)) {
    return value as CrmAppointmentListView;
  }
  return "agenda";
}

export function listViewLabel(view: CrmAppointmentListView): string {
  switch (view) {
    case "agenda":
      return "Agenda";
    case "upcoming":
      return "Upcoming";
    case "requests":
      return "Requests";
    case "preparation":
      return "Preparation";
    case "follow_up":
      return "Follow-up";
    case "history":
      return "History";
    default:
      return "Agenda";
  }
}
