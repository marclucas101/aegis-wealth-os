import type {
  AdviserWorkItem,
  WorkItemPriority,
  WorkItemReasonCode,
  WorkItemState,
  WorkItemTiming,
} from "./types";

export type PriorityInput = {
  state: WorkItemState;
  timing: WorkItemTiming;
  blocking: boolean;
  sourceType: string;
  reasonCodes: WorkItemReasonCode[];
};

/**
 * Explainable rules-based priority. Operational urgency only — see policy doc.
 * or demographic signals.
 */
export function deriveWorkItemPriority(input: PriorityInput): WorkItemPriority {
  if (input.state === "informational" || input.state === "completed") {
    return "low";
  }

  if (input.blocking || input.reasonCodes.includes("binder_generation_failed")) {
    return "critical";
  }

  if (
    input.timing === "overdue" &&
    (input.reasonCodes.includes("task_overdue") ||
      input.reasonCodes.includes("review_overdue"))
  ) {
    return "critical";
  }

  if (
    input.reasonCodes.includes("meeting_prep_missing") &&
    input.timing !== "not_applicable"
  ) {
    return "critical";
  }

  if (
    input.timing === "due_today" ||
    input.reasonCodes.includes("planning_publish_pending") ||
    input.reasonCodes.includes("meeting_follow_up_pending")
  ) {
    return "high";
  }

  if (
    input.timing === "overdue" ||
    input.reasonCodes.includes("review_due_soon") ||
    input.reasonCodes.includes("appointment_upcoming") ||
    input.reasonCodes.includes("planning_stale_unpublished")
  ) {
    return "high";
  }

  if (
    input.reasonCodes.includes("missing_required_data") ||
    input.reasonCodes.includes("missing_supporting_document")
  ) {
    return "normal";
  }

  return "normal";
}

/** Internal deterministic sort key — not exposed as a performance score. */
export function prioritySortWeight(priority: WorkItemPriority): number {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "normal":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

export function timingSortWeight(timing: WorkItemTiming): number {
  switch (timing) {
    case "overdue":
      return 5;
    case "due_today":
      return 4;
    case "upcoming":
      return 3;
    case "unscheduled":
      return 2;
    case "not_applicable":
      return 1;
    default:
      return 0;
  }
}

export function stateSortWeight(state: WorkItemState): number {
  switch (state) {
    case "blocked":
      return 5;
    case "actionable":
      return 4;
    case "waiting":
      return 3;
    case "informational":
      return 2;
    case "completed":
      return 1;
    default:
      return 0;
  }
}

export function applyPriorityToItem(item: AdviserWorkItem): AdviserWorkItem {
  const priority = deriveWorkItemPriority({
    state: item.state,
    timing: item.timing,
    blocking: item.blocking,
    sourceType: item.sourceType,
    reasonCodes: item.reasonCodes,
  });
  return { ...item, priority };
}
