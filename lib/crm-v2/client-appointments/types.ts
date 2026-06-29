import type { CalendarLocationType } from "@/lib/aegis/calendar";
import type { CrmAppointmentLifecycleStatus } from "@/lib/crm-v2/appointments/lifecycle";

export type ClientAppointmentListView =
  | "upcoming"
  | "awaiting_response"
  | "preparation"
  | "follow_up"
  | "history";

export type ClientAppointmentAction =
  | "confirm_proposal"
  | "decline_proposal"
  | "request_another_time"
  | "request_reschedule"
  | "cancel_appointment"
  | "submit_topics"
  | "complete_checklist";

export type ClientAppointmentChecklistItemDto = {
  itemId: string;
  label: string;
  required: boolean;
  owner: "client" | "shared";
  completed: boolean;
  dueDate: string | null;
  sortOrder: number;
};

export type ClientAppointmentTopicDto = {
  topicId: string;
  topic: string;
  sortOrder: number;
  createdAt: string;
};

export type ClientAppointmentParticipantDto = {
  participantId: string;
  displayName: string;
  role: "client" | "adviser" | "guest";
  isPrimary: boolean;
};

export type ClientAppointmentSummaryDto = {
  appointmentId: string;
  lifecycleStatus: CrmAppointmentLifecycleStatus;
  lifecycleLabel: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  deliveryMode: CalendarLocationType;
  title: string | null;
  templateLabel: string;
  allowedActions: ClientAppointmentAction[];
  preparationCompletedCount: number;
  preparationRequiredCount: number;
};

export type ClientAppointmentDetailDto = ClientAppointmentSummaryDto & {
  locationSummary: string;
  participants: ClientAppointmentParticipantDto[];
  clientTopics: ClientAppointmentTopicDto[];
  checklistItems: ClientAppointmentChecklistItemDto[];
  requiredDocumentCategories: string[];
  preparationProgress: number;
  publishedMeetingSummary: {
    title: string;
    summary: string;
    publishedAt: string;
  } | null;
  clientVisibleFollowUp: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }>;
  safeLinks: {
    documentUploadEntry: string | null;
    roadmap: string | null;
  };
  version: number;
};
