import type { CrmCommitmentLifecycleStatus, CrmCommitmentOwner } from "./commitmentLifecycle";
import type {
  CrmServiceRequestCategory,
  CrmServiceRequestLifecycleStatus,
  CrmServiceRequestUrgency,
} from "./requestLifecycle";

export const CRM_COMMITMENT_TYPES = [
  "adviser_commitment",
  "client_commitment",
  "shared_commitment",
  "document_request",
  "appointment_follow_up_item",
] as const;

export type CrmCommitmentType = (typeof CRM_COMMITMENT_TYPES)[number];

export const CRM_COMMITMENT_VISIBILITY = [
  "adviser_only",
  "client_visible",
  "shared",
] as const;

export type CrmCommitmentVisibility = (typeof CRM_COMMITMENT_VISIBILITY)[number];

export type CrmCommitmentEventType =
  | "created"
  | "updated"
  | "status_changed"
  | "due_date_changed"
  | "ownership_changed"
  | "completed"
  | "cancelled"
  | "reopened";

export type CrmServiceRequestEventType =
  | "created"
  | "acknowledged"
  | "status_changed"
  | "information_requested"
  | "client_responded"
  | "resolved"
  | "closed"
  | "cancelled";

export type AdviserCommitmentDto = {
  commitmentId: string;
  relationshipId: string;
  relationshipDisplayName: string | null;
  commitmentType: CrmCommitmentType;
  owner: CrmCommitmentOwner;
  visibility: CrmCommitmentVisibility;
  title: string;
  description: string | null;
  lifecycleStatus: CrmCommitmentLifecycleStatus;
  lifecycleLabel: string;
  dueAt: string | null;
  completedAt: string | null;
  completionNote: string | null;
  sourceType: string | null;
  sourceId: string | null;
  appointmentId: string | null;
  clientVisible: boolean;
  internalNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: CrmCommitmentLifecycleStatus[];
};

export type ClientCommitmentActionDto = {
  commitmentId: string;
  commitmentType: CrmCommitmentType;
  owner: CrmCommitmentOwner;
  title: string;
  description: string | null;
  lifecycleStatus: CrmCommitmentLifecycleStatus;
  lifecycleLabel: string;
  dueAt: string | null;
  completedAt: string | null;
  version: number;
  updatedAt: string;
  allowedTransitions: CrmCommitmentLifecycleStatus[];
  canComplete: boolean;
};

export type AdviserServiceRequestDto = {
  requestId: string;
  relationshipId: string;
  relationshipDisplayName: string | null;
  requestCategory: CrmServiceRequestCategory;
  categoryLabel: string;
  summary: string;
  details: string | null;
  lifecycleStatus: CrmServiceRequestLifecycleStatus;
  urgency: CrmServiceRequestUrgency;
  clientVisibleStatus: string;
  acknowledgedAt: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  nextExpectedAction: string;
  allowedTransitions: CrmServiceRequestLifecycleStatus[];
};

export type ClientServiceRequestDto = {
  requestId: string;
  requestCategory: CrmServiceRequestCategory;
  categoryLabel: string;
  summary: string;
  details: string | null;
  lifecycleStatus: CrmServiceRequestLifecycleStatus;
  clientVisibleStatus: string;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  canRespond: boolean;
  canCancel: boolean;
};

export type CrmServiceWorkspaceView =
  | "my_work"
  | "client_requests"
  | "reviews"
  | "commitments"
  | "documents_required"
  | "workflow_cases"
  | "completed";

export type CrmServiceMyWorkItem = {
  itemId: string;
  source: string;
  relationshipId: string;
  relationshipDisplayName: string | null;
  summary: string;
  statusLabel: string;
  dueAt: string | null;
  workflowHref: string;
};

export type CrmCommitmentEventDto = {
  eventId: string;
  eventType: CrmCommitmentEventType;
  fromStatus: string | null;
  toStatus: string | null;
  actorRole: string;
  occurredAt: string;
  reasonCode: string | null;
};

export type CrmServiceRequestEventDto = {
  eventId: string;
  eventType: CrmServiceRequestEventType;
  fromStatus: string | null;
  toStatus: string | null;
  actorRole: string;
  occurredAt: string;
  reasonCode: string | null;
};
