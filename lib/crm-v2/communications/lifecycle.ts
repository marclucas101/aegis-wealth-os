import type {
  CrmCommunicationLifecycleStatus,
  CrmCommunicationTransition,
  TransitionCommunicationInput,
  UpdateCommunicationRecordInput,
} from "@/lib/crm-v2/communications/types";

const ALLOWED_TRANSITIONS: Record<
  CrmCommunicationLifecycleStatus,
  Partial<Record<CrmCommunicationTransition, CrmCommunicationLifecycleStatus>>
> = {
  draft: {
    submit_review: "pending_review",
    mark_logged: "logged",
    cancel: "cancelled",
    archive: "archived",
  },
  pending_review: {
    approve: "approved",
    cancel: "cancelled",
    archive: "archived",
  },
  approved: {
    mark_sent: "sent",
    mark_logged: "logged",
    cancel: "cancelled",
    archive: "archived",
  },
  sent: {
    mark_failed: "failed",
    archive: "archived",
  },
  logged: {
    archive: "archived",
  },
  received: {
    archive: "archived",
  },
  failed: {
    submit_review: "pending_review",
    cancel: "cancelled",
    archive: "archived",
  },
  cancelled: {
    archive: "archived",
  },
  archived: {},
};

export function resolveTransitionTarget(
  current: CrmCommunicationLifecycleStatus,
  transition: CrmCommunicationTransition,
): CrmCommunicationLifecycleStatus | null {
  return ALLOWED_TRANSITIONS[current]?.[transition] ?? null;
}

export function validateCommunicationTransition(
  current: CrmCommunicationLifecycleStatus,
  input: TransitionCommunicationInput,
): { ok: true; target: CrmCommunicationLifecycleStatus } | { ok: false; error: string } {
  if (input.expectedVersion < 1) {
    return { ok: false, error: "Invalid version." };
  }
  const target = resolveTransitionTarget(current, input.transition);
  if (!target) {
    return { ok: false, error: "Invalid transition." };
  }
  return { ok: true, target };
}

export function validateUpdateCommunicationRecord(
  input: UpdateCommunicationRecordInput,
): { ok: true } | { ok: false; error: string } {
  if (input.expectedVersion < 1) {
    return { ok: false, error: "Invalid version." };
  }
  if (input.safeSubject !== undefined && input.safeSubject.trim().length === 0) {
    return { ok: false, error: "Subject is required." };
  }
  return { ok: true };
}

export function domainEventTypeForTransition(
  transition: CrmCommunicationTransition,
): string {
  switch (transition) {
    case "submit_review":
      return "review_requested";
    case "approve":
      return "approved";
    case "mark_sent":
    case "mark_logged":
      return "sent_or_logged";
    case "mark_failed":
      return "failed";
    case "cancel":
      return "cancelled";
    case "archive":
      return "archived";
    case "mark_received":
      return "received";
    default:
      return "draft_updated";
  }
}

export function isClientVisibleStatus(status: CrmCommunicationLifecycleStatus): boolean {
  return status === "sent" || status === "logged" || status === "received";
}

export function isEditableStatus(status: CrmCommunicationLifecycleStatus): boolean {
  return status === "draft" || status === "pending_review";
}
