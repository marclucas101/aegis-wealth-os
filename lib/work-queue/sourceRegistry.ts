import type { WorkItemCategory } from "./types";

export const WORK_ITEM_SOURCE_TYPES = [
  "advisor_task",
  "roadmap_item",
  "review_due",
  "appointment",
  "meeting_follow_up",
  "planning_output",
  "binder_export",
  "data_completeness",
  "document_follow_up",
] as const;

export type WorkItemSourceType = (typeof WORK_ITEM_SOURCE_TYPES)[number];

export type WorkItemSourceDefinition = {
  sourceType: WorkItemSourceType;
  category: WorkItemCategory;
  sourceOwner: "persisted" | "computed";
  supportedLifecycleStates: readonly string[];
  adapterName: string;
  mayBeBlocking: boolean;
  supportsDueDate: boolean;
  informationalOnly: boolean;
  routeBuilderKey: string;
  queueSuitability: "include" | "defer" | "reject";
  suitabilityReason: string;
};

export const WORK_ITEM_SOURCE_REGISTRY: Record<
  WorkItemSourceType,
  WorkItemSourceDefinition
> = {
  advisor_task: {
    sourceType: "advisor_task",
    category: "task",
    sourceOwner: "persisted",
    supportedLifecycleStates: ["open", "in_progress"],
    adapterName: "advisorTaskAdapter",
    mayBeBlocking: true,
    supportsDueDate: true,
    informationalOnly: false,
    routeBuilderKey: "clientTasks",
    queueSuitability: "include",
    suitabilityReason: "advisor_tasks table with stable id and due_date",
  },
  roadmap_item: {
    sourceType: "roadmap_item",
    category: "roadmap",
    sourceOwner: "persisted",
    supportedLifecycleStates: ["not_started", "in_progress"],
    adapterName: "roadmapItemAdapter",
    mayBeBlocking: false,
    supportsDueDate: false,
    informationalOnly: false,
    routeBuilderKey: "clientRoadmap",
    queueSuitability: "include",
    suitabilityReason: "roadmap_items with task_owner and client_visible",
  },
  review_due: {
    sourceType: "review_due",
    category: "review",
    sourceOwner: "computed",
    supportedLifecycleStates: ["review_due", "overdue"],
    adapterName: "reviewDueAdapter",
    mayBeBlocking: false,
    supportsDueDate: true,
    informationalOnly: false,
    routeBuilderKey: "clientShieldReview",
    queueSuitability: "include",
    suitabilityReason: "review pipeline uses existing 12/15 month rules",
  },
  appointment: {
    sourceType: "appointment",
    category: "meeting",
    sourceOwner: "persisted",
    supportedLifecycleStates: ["pending", "confirmed"],
    adapterName: "appointmentAdapter",
    mayBeBlocking: true,
    supportsDueDate: true,
    informationalOnly: false,
    routeBuilderKey: "adviserAppointments",
    queueSuitability: "include",
    suitabilityReason: "adviser_appointments with starts_at",
  },
  meeting_follow_up: {
    sourceType: "meeting_follow_up",
    category: "meeting",
    sourceOwner: "persisted",
    supportedLifecycleStates: ["prepared", "in_progress", "completed"],
    adapterName: "meetingFollowUpAdapter",
    mayBeBlocking: true,
    supportsDueDate: false,
    informationalOnly: false,
    routeBuilderKey: "clientMeetingStudio",
    queueSuitability: "include",
    suitabilityReason: "meeting_sessions lifecycle and summary_status",
  },
  planning_output: {
    sourceType: "planning_output",
    category: "planning",
    sourceOwner: "persisted",
    supportedLifecycleStates: ["draft", "adviser_reviewed"],
    adapterName: "planningOutputAdapter",
    mayBeBlocking: false,
    supportsDueDate: false,
    informationalOnly: false,
    routeBuilderKey: "clientPlanningOutputs",
    queueSuitability: "include",
    suitabilityReason: "published_outputs draft/reviewed states",
  },
  binder_export: {
    sourceType: "binder_export",
    category: "binder",
    sourceOwner: "persisted",
    supportedLifecycleStates: ["failed"],
    adapterName: "binderExportAdapter",
    mayBeBlocking: true,
    supportsDueDate: false,
    informationalOnly: false,
    routeBuilderKey: "clientMeetingPacks",
    queueSuitability: "include",
    suitabilityReason: "binder_exports.generation_status failed",
  },
  data_completeness: {
    sourceType: "data_completeness",
    category: "data_quality",
    sourceOwner: "computed",
    supportedLifecycleStates: ["gap_detected"],
    adapterName: "dataCompletenessAdapter",
    mayBeBlocking: false,
    supportsDueDate: false,
    informationalOnly: false,
    routeBuilderKey: "clientOverview",
    queueSuitability: "include",
    suitabilityReason: "clientFileQuality checklist without scoring formulas",
  },
  document_follow_up: {
    sourceType: "document_follow_up",
    category: "document",
    sourceOwner: "computed",
    supportedLifecycleStates: ["missing_category"],
    adapterName: "dataCompletenessAdapter",
    mayBeBlocking: false,
    supportsDueDate: false,
    informationalOnly: false,
    routeBuilderKey: "clientDocumentVault",
    queueSuitability: "include",
    suitabilityReason: "document coverage gaps from file quality",
  },
};

/** Sources audited but excluded from Phase 10.2 adapters. */
export const DEFERRED_WORK_QUEUE_SOURCES = [
  {
    source: "advisor_task_suggestions",
    suitability: "defer" as const,
    reason: "Computed suggestions duplicate file-quality and review signals; promote via tasks instead",
  },
  {
    source: "advisor_notifications",
    suitability: "defer" as const,
    reason: "Ephemeral computed feed; duplicates persisted and pipeline sources",
  },
  {
    source: "client_notifications",
    suitability: "reject" as const,
    reason: "Client-facing queue; not adviser work queue",
  },
  {
    source: "communication_delivery",
    suitability: "defer" as const,
    reason: "Admin API only; no adviser-scoped delivery failure surface in 10.2",
  },
] as const;

export function getSourceDefinition(
  sourceType: WorkItemSourceType,
): WorkItemSourceDefinition {
  return WORK_ITEM_SOURCE_REGISTRY[sourceType];
}

export function listIncludedSourceTypes(): WorkItemSourceType[] {
  return WORK_ITEM_SOURCE_TYPES.filter(
    (type) => WORK_ITEM_SOURCE_REGISTRY[type].queueSuitability === "include",
  );
}
