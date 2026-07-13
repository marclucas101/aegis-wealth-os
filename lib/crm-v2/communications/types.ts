/** CRM V2 communications — allowlisted types and DTOs (Phase 10). */

export const CRM_COMMUNICATION_CHANNELS = [
  "internal_client_message",
  "in_app_notification",
  "email_draft",
  "phone_call_log",
  "meeting_note_reference",
  "whatsapp_draft",
  "sms_draft",
  "external_message_log",
] as const;

export type CrmCommunicationChannel = (typeof CRM_COMMUNICATION_CHANNELS)[number];

export const CRM_COMMUNICATION_LIFECYCLE_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "sent",
  "logged",
  "received",
  "failed",
  "cancelled",
  "archived",
] as const;

export type CrmCommunicationLifecycleStatus =
  (typeof CRM_COMMUNICATION_LIFECYCLE_STATUSES)[number];

export const CRM_COMMUNICATION_SOURCE_TYPES = [
  "relationship",
  "appointment",
  "service_commitment",
  "client_service_request",
  "protection_policy",
  "protection_correction_request",
  "relationship_moment",
  "review_rhythm",
  "advocacy_event",
  "document_request",
] as const;

export type CrmCommunicationSourceType = (typeof CRM_COMMUNICATION_SOURCE_TYPES)[number];

export const CRM_COMMUNICATION_VISIBILITY = ["adviser_only", "client_visible", "both"] as const;
export type CrmCommunicationVisibility = (typeof CRM_COMMUNICATION_VISIBILITY)[number];

export const CRM_COMMUNICATION_DIRECTIONS = ["outbound", "inbound", "internal"] as const;
export type CrmCommunicationDirection = (typeof CRM_COMMUNICATION_DIRECTIONS)[number];

export const CRM_COMMUNICATION_FOLLOW_UP_STATUSES = [
  "none",
  "pending",
  "completed",
  "overdue",
] as const;

export type CrmCommunicationFollowUpStatus =
  (typeof CRM_COMMUNICATION_FOLLOW_UP_STATUSES)[number];

export const CRM_COMMUNICATION_TEMPLATE_CATEGORIES = [
  "appointment_preparation",
  "appointment_follow_up",
  "service_request_update",
  "document_request",
  "protection_correction_request",
  "annual_review",
  "relationship_moment_acknowledgement",
  "advocacy_consent_acknowledgement",
  "general_client_service_update",
] as const;

export type CrmCommunicationTemplateCategory =
  (typeof CRM_COMMUNICATION_TEMPLATE_CATEGORIES)[number];

export const CRM_COMMUNICATION_WORKSPACE_VIEWS = [
  "inbox",
  "drafts",
  "needs_review",
  "recent",
  "templates",
  "follow_ups",
  "preferences",
  "action_required",
] as const;

export type CrmCommunicationWorkspaceView =
  (typeof CRM_COMMUNICATION_WORKSPACE_VIEWS)[number];

export const CRM_COMMUNICATION_TRANSITIONS = [
  "submit_review",
  "approve",
  "mark_sent",
  "mark_logged",
  "mark_received",
  "mark_failed",
  "cancel",
  "archive",
] as const;

export type CrmCommunicationTransition = (typeof CRM_COMMUNICATION_TRANSITIONS)[number];

export const CRM_TEMPLATE_VARIABLE_ALLOWLIST = [
  "client_name",
  "adviser_name",
  "appointment_date",
  "request_reference",
  "update_summary",
  "document_name",
  "moment_label",
] as const;

export type CrmTemplateVariable = (typeof CRM_TEMPLATE_VARIABLE_ALLOWLIST)[number];

export type AdviserCommunicationLabel =
  | "draft"
  | "pending_review"
  | "approved"
  | "client_visible"
  | "adviser_only"
  | "preference_conflict"
  | "restricted"
  | "failed"
  | "follow_up_due";

export type AdviserCommunicationRecordDto = {
  recordId: string;
  threadId: string;
  clientId: string;
  clientDisplayName: string | null;
  channel: CrmCommunicationChannel;
  direction: CrmCommunicationDirection;
  lifecycleStatus: CrmCommunicationLifecycleStatus;
  safeSubject: string;
  safeBodyPreview: string | null;
  sourceType: CrmCommunicationSourceType | null;
  sourceId: string | null;
  clientVisibility: CrmCommunicationVisibility;
  followUpStatus: CrmCommunicationFollowUpStatus;
  nextFollowUpDate: string | null;
  templateKey: string | null;
  templateVersion: number | null;
  labels: AdviserCommunicationLabel[];
  preferenceWarnings: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AdviserCommunicationTemplateDto = {
  templateId: string;
  templateKey: string;
  category: CrmCommunicationTemplateCategory;
  channel: CrmCommunicationChannel;
  title: string;
  bodyPreview: string;
  variableSchema: string[];
  complianceStatus: string;
  version: number;
  active: boolean;
};

export type AdviserCommunicationPreferencesDto = {
  relationshipId: string;
  preferredChannel: string;
  doNotContact: boolean;
  marketingOptOut: boolean;
  festiveAcknowledgementOptOut: boolean;
  clientMessageVisibility: string;
  adviserMessagesEnabled: boolean;
  lastConfirmedAt: string | null;
  preferenceWarnings: string[];
  version: number;
};

export type AdviserCommunicationsWorkspaceDto = {
  view: CrmCommunicationWorkspaceView;
  drafts: AdviserCommunicationRecordDto[];
  needsReview: AdviserCommunicationRecordDto[];
  recent: AdviserCommunicationRecordDto[];
  followUps: AdviserCommunicationRecordDto[];
  actionRequired: AdviserCommunicationRecordDto[];
  templates: AdviserCommunicationTemplateDto[];
  bounded: boolean;
};

export type ClientMessageDto = {
  messageId: string;
  safeSubject: string;
  safeBody: string;
  direction: CrmCommunicationDirection;
  occurredAt: string;
  canReply: boolean;
  version: number;
};

export type ClientMessagesInboxDto = {
  messages: ClientMessageDto[];
  preferenceWarnings: string[];
  bounded: boolean;
};

export type ClientCommunicationPreferencesDto = {
  preferredChannel: string;
  doNotContact: boolean;
  marketingOptOut: boolean;
  festiveAcknowledgementOptOut: boolean;
  adviserMessagesEnabled: boolean;
  version: number;
};

export type CreateCommunicationDraftInput = {
  clientId: string;
  channel: CrmCommunicationChannel;
  safeSubject: string;
  safeBody?: string;
  sourceType?: CrmCommunicationSourceType;
  sourceId?: string;
  clientVisibility?: CrmCommunicationVisibility;
  templateKey?: string;
  templateVariables?: Record<string, string>;
  idempotencyKey?: string;
};

export type UpdateCommunicationRecordInput = {
  expectedVersion: number;
  safeSubject?: string;
  safeBody?: string;
  clientVisibility?: CrmCommunicationVisibility;
};

export type TransitionCommunicationInput = {
  expectedVersion: number;
  transition: CrmCommunicationTransition;
};

export type CommunicationFollowUpInput = {
  expectedVersion: number;
  action: "schedule" | "complete";
  nextFollowUpDate?: string | null;
};

export type ClientMessageReplyInput = {
  safeBody: string;
  expectedVersion: number;
};

export type UpdateClientCommunicationPreferencesInput = {
  expectedVersion: number;
  preferredChannel?: string;
  doNotContact?: boolean;
  marketingOptOut?: boolean;
  festiveAcknowledgementOptOut?: boolean;
  adviserMessagesEnabled?: boolean;
};

export function isValidCommunicationChannel(value: string): value is CrmCommunicationChannel {
  return (CRM_COMMUNICATION_CHANNELS as readonly string[]).includes(value);
}

export function isValidCommunicationSourceType(
  value: string,
): value is CrmCommunicationSourceType {
  return (CRM_COMMUNICATION_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isValidLifecycleStatus(
  value: string,
): value is CrmCommunicationLifecycleStatus {
  return (CRM_COMMUNICATION_LIFECYCLE_STATUSES as readonly string[]).includes(value);
}

export function channelLabel(channel: CrmCommunicationChannel): string {
  return channel.replace(/_/g, " ");
}

export function lifecycleLabel(status: CrmCommunicationLifecycleStatus): string {
  return status.replace(/_/g, " ");
}
