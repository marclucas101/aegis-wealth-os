import type { CalendarLocationType } from "@/lib/aegis/calendar";

import type { CrmAppointmentLifecycleStatus } from "./lifecycle";
import type { CrmAppointmentTemplateKey } from "./templates";

export const CRM_APPOINTMENT_UNKNOWN_LABEL = "Not established";

export type CrmAppointmentListView =
  | "agenda"
  | "upcoming"
  | "requests"
  | "preparation"
  | "follow_up"
  | "history";

export type CrmAppointmentPreparationState =
  | "not_started"
  | "in_progress"
  | "complete";

export type CrmAppointmentFollowUpState = "none" | "required" | "complete";

export type CrmAppointmentBinderReadiness =
  | "not_generated"
  | "preparing"
  | "ready"
  | "failed"
  | "unknown";

export type CrmAppointmentMeetingSessionLinkState =
  | "none"
  | "linked"
  | "in_progress";

export type CrmAppointmentParticipantDto = {
  participantId: string;
  displayName: string;
  role: "client" | "adviser" | "guest";
  isPrimary: boolean;
};

export type CrmAppointmentChecklistItemDto = {
  itemId: string;
  label: string;
  required: boolean;
  owner: "adviser" | "client" | "shared";
  visibility: "adviser" | "client" | "shared";
  completed: boolean;
  dueDate: string | null;
  sortOrder: number;
};

export type CrmAppointmentTopicDto = {
  topicId: string;
  source: "client" | "adviser_agenda";
  label: string;
  sortOrder: number;
};

export type CrmAppointmentListItem = {
  appointmentId: string;
  relationshipId: string;
  clientDisplayName: string;
  templateKey: CrmAppointmentTemplateKey | null;
  templateLabel: string;
  title: string | null;
  lifecycleStatus: CrmAppointmentLifecycleStatus;
  lifecycleLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  deliveryMode: CalendarLocationType;
  locationSummary: string;
  preparationState: CrmAppointmentPreparationState;
  followUpState: CrmAppointmentFollowUpState;
  allowedActions: string[];
  detailHref: string;
};

export type CrmAppointmentListPage = {
  view: CrmAppointmentListView;
  appointments: CrmAppointmentListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  partialDataWarning: boolean;
};

export type CrmAppointmentStateEventDto = {
  eventId: string;
  eventType: string;
  fromState: CrmAppointmentLifecycleStatus | null;
  toState: CrmAppointmentLifecycleStatus | null;
  occurredAt: string;
  reasonCode: string | null;
};

export type CrmAppointmentDetail = {
  appointmentId: string;
  relationshipId: string;
  clientDisplayName: string;
  templateKey: CrmAppointmentTemplateKey | null;
  templateLabel: string;
  title: string | null;
  lifecycleStatus: CrmAppointmentLifecycleStatus;
  lifecycleLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  deliveryMode: CalendarLocationType;
  locationSummary: string;
  participants: CrmAppointmentParticipantDto[];
  clientTopics: CrmAppointmentTopicDto[];
  adviserAgenda: CrmAppointmentTopicDto[];
  checklistItems: CrmAppointmentChecklistItemDto[];
  checklistCompletedCount: number;
  checklistRequiredCount: number;
  preparationState: CrmAppointmentPreparationState;
  followUpState: CrmAppointmentFollowUpState;
  meetingSessionLinkState: CrmAppointmentMeetingSessionLinkState;
  meetingSessionHref: string | null;
  meetingSessionId: string | null;
  binderReadiness: CrmAppointmentBinderReadiness;
  binderHref: string | null;
  allowedActions: string[];
  version: number;
  detailHref: string;
  relationshipHref: string;
  recentEvents: CrmAppointmentStateEventDto[];
  sourceWarnings: string[];
};

export type CrmAssignedRelationshipOption = {
  relationshipId: string;
  displayName: string;
};
