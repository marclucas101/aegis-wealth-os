import type { WorkItemSourceType } from "./sourceRegistry";

export const WORK_ITEM_CATEGORIES = [
  "task",
  "roadmap",
  "review",
  "meeting",
  "planning",
  "binder",
  "data_quality",
  "document",
] as const;

export type WorkItemCategory = (typeof WORK_ITEM_CATEGORIES)[number];

export const WORK_ITEM_STATES = [
  "actionable",
  "blocked",
  "waiting",
  "informational",
  "completed",
] as const;

export type WorkItemState = (typeof WORK_ITEM_STATES)[number];

export const WORK_ITEM_TIMINGS = [
  "overdue",
  "due_today",
  "upcoming",
  "unscheduled",
  "not_applicable",
] as const;

export type WorkItemTiming = (typeof WORK_ITEM_TIMINGS)[number];

export const WORK_ITEM_PRIORITIES = ["critical", "high", "normal", "low"] as const;

export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];

export const WORK_ITEM_ACTION_OWNERS = [
  "adviser",
  "client",
  "shared",
  "system",
] as const;

export type WorkItemActionOwner = (typeof WORK_ITEM_ACTION_OWNERS)[number];

export const WORK_ITEM_REASON_CODES = [
  "task_overdue",
  "task_due_today",
  "task_open",
  "roadmap_in_progress",
  "roadmap_not_started",
  "roadmap_waiting_client",
  "review_overdue",
  "review_due_soon",
  "review_missing_date",
  "appointment_upcoming",
  "meeting_prep_missing",
  "meeting_follow_up_pending",
  "planning_draft_pending",
  "planning_review_pending",
  "planning_publish_pending",
  "planning_stale_unpublished",
  "binder_generation_failed",
  "missing_required_data",
  "stale_financial_data",
  "missing_supporting_document",
  "deduplicated_related_source",
  "invalid_date_skipped",
] as const;

export type WorkItemReasonCode = (typeof WORK_ITEM_REASON_CODES)[number];

/** Allowlisted metadata keys — no arbitrary source payloads. */
export type SafeWorkItemMetadata = {
  relatedSourceType?: WorkItemSourceType;
  relatedSourceId?: string;
  deduplicationGroup?: string;
  deduplicatedSourceIds?: string[];
  outputType?: string;
  appointmentId?: string;
  meetingSessionId?: string;
  checklistItemId?: string;
};

export type AdviserWorkItem = {
  id: string;
  sourceType: WorkItemSourceType;
  sourceId: string;
  clientId: string;
  clientDisplayName: string;

  category: WorkItemCategory;
  title: string;
  summary: string | null;

  actionOwner: WorkItemActionOwner;
  state: WorkItemState;
  timing: WorkItemTiming;
  priority: WorkItemPriority;

  dueAt: string | null;
  occurredAt: string | null;
  updatedAt: string | null;

  reasonCodes: WorkItemReasonCode[];
  actionHref: string;
  sourceStatus: string | null;

  blocking: boolean;
  dismissible: boolean;
  metadata: SafeWorkItemMetadata;
};

export type WorkQueueClientScope = {
  id: string;
  displayName: string;
  advisorUserId: string | null;
  status: string;
  relationshipStage: string;
  nextReviewDue: string | null;
};

export type WorkQueueAdapterWarningCode =
  | "adapter_error"
  | "invalid_date"
  | "admin_scope_deferred"
  | "empty_client_scope"
  | "source_skipped";

export type AdviserWorkItemAdapterResult = {
  items: AdviserWorkItem[];
  sourceCount: number;
  skippedCount: number;
  warningCodes: WorkQueueAdapterWarningCode[];
};

export type SafeAdapterStatus = {
  sourceType: WorkItemSourceType;
  ok: boolean;
  itemCount: number;
  sourceCount: number;
  skippedCount: number;
  warningCodes: WorkQueueAdapterWarningCode[];
};

export type AdviserWorkQueueSummary = {
  total: number;
  critical: number;
  high: number;
  overdue: number;
  blocked: number;
  clientsAffected: number;
};

export type AdviserWorkQueueResult = {
  generatedAt: string;
  items: AdviserWorkItem[];
  summary: AdviserWorkQueueSummary;
  adapterStatus: SafeAdapterStatus[];
};
