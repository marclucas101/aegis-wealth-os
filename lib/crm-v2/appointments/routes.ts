/** Allowlisted internal route builders for CRM V2 appointment workspace. */

import type { CrmAppointmentListView } from "./types";

const ALLOWED_PREFIXES = [
  "/advisor-v2/appointments",
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
  const base = "/advisor-v2/appointments";
  if (!view || view === "agenda") {
    return base;
  }
  return `${base}?view=${view}`;
}

export function buildAppointmentDetailHref(appointmentId: string): string {
  return `/advisor-v2/appointments/${appointmentId}`;
}

export function buildAppointmentNewHref(relationshipId?: string): string {
  const base = "/advisor-v2/appointments/new";
  if (!relationshipId) {
    return base;
  }
  return `${base}?relationshipId=${relationshipId}`;
}

export function buildMeetingStudioHref(clientId: string): string {
  return `/advisor/clients/${clientId}/meeting-studio`;
}

export function buildRelationshipHref(relationshipId: string): string {
  return `/advisor-v2/relationships/${relationshipId}`;
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
