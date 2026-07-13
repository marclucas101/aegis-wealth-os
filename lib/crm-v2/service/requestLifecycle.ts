/**
 * Canonical CRM V2 client service request lifecycle.
 */

export const CRM_SERVICE_REQUEST_LIFECYCLE_STATUSES = [
  "submitted",
  "acknowledged",
  "in_progress",
  "waiting_on_client",
  "resolved",
  "closed",
  "cancelled",
] as const;

export type CrmServiceRequestLifecycleStatus =
  (typeof CRM_SERVICE_REQUEST_LIFECYCLE_STATUSES)[number];

export const CRM_SERVICE_REQUEST_TERMINAL_STATUSES: ReadonlySet<CrmServiceRequestLifecycleStatus> =
  new Set(["resolved", "closed", "cancelled"]);

export const CRM_SERVICE_REQUEST_CATEGORIES = [
  "general_enquiry",
  "document_help",
  "appointment_scheduling",
  "account_update",
  "plan_question",
  "protection_correction",
  "protection_review",
  "other",
] as const;

export type CrmServiceRequestCategory =
  (typeof CRM_SERVICE_REQUEST_CATEGORIES)[number];

export const CRM_SERVICE_REQUEST_URGENCIES = ["low", "normal", "high"] as const;

export type CrmServiceRequestUrgency =
  (typeof CRM_SERVICE_REQUEST_URGENCIES)[number];

export type CrmServiceRequestActorRole = "adviser" | "client" | "system";

export type CrmServiceRequestTransitionReasonCode =
  | "client_submitted"
  | "adviser_acknowledged"
  | "adviser_progressed"
  | "information_requested"
  | "client_responded"
  | "adviser_resolved"
  | "client_cancelled"
  | "adviser_closed"
  | "operator_override";

export type CrmServiceRequestTransitionErrorCode =
  | "invalid_transition"
  | "terminal_state"
  | "same_state_noop"
  | "actor_forbidden";

export class CrmServiceRequestTransitionError extends Error {
  readonly code: CrmServiceRequestTransitionErrorCode;

  constructor(code: CrmServiceRequestTransitionErrorCode, message: string) {
    super(message);
    this.name = "CrmServiceRequestTransitionError";
    this.code = code;
  }
}

const ADVISER_TRANSITIONS: Record<
  CrmServiceRequestLifecycleStatus,
  ReadonlySet<CrmServiceRequestLifecycleStatus>
> = {
  submitted: new Set(["acknowledged", "in_progress", "cancelled"]),
  acknowledged: new Set(["in_progress", "waiting_on_client", "resolved", "cancelled"]),
  in_progress: new Set(["waiting_on_client", "resolved", "closed", "cancelled"]),
  waiting_on_client: new Set(["in_progress", "resolved", "closed"]),
  resolved: new Set(["closed"]),
  closed: new Set(),
  cancelled: new Set(),
};

const CLIENT_TRANSITIONS: Record<
  CrmServiceRequestLifecycleStatus,
  ReadonlySet<CrmServiceRequestLifecycleStatus>
> = {
  submitted: new Set(["cancelled"]),
  acknowledged: new Set(["waiting_on_client"]),
  in_progress: new Set(["waiting_on_client"]),
  waiting_on_client: new Set(["in_progress"]),
  resolved: new Set(),
  closed: new Set(),
  cancelled: new Set(),
};

const CLIENT_VISIBLE_STATUS: Record<CrmServiceRequestLifecycleStatus, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  waiting_on_client: "Information requested",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function isTerminalServiceRequestStatus(
  status: CrmServiceRequestLifecycleStatus,
): boolean {
  return CRM_SERVICE_REQUEST_TERMINAL_STATUSES.has(status);
}

export function clientVisibleServiceRequestStatus(
  status: CrmServiceRequestLifecycleStatus,
): string {
  return CLIENT_VISIBLE_STATUS[status];
}

export function canAdviserTransitionServiceRequest(
  from: CrmServiceRequestLifecycleStatus,
  to: CrmServiceRequestLifecycleStatus,
): boolean {
  if (from === to) return false;
  return ADVISER_TRANSITIONS[from]?.has(to) ?? false;
}

export function canClientTransitionServiceRequest(
  from: CrmServiceRequestLifecycleStatus,
  to: CrmServiceRequestLifecycleStatus,
): boolean {
  if (from === to) return false;
  return CLIENT_TRANSITIONS[from]?.has(to) ?? false;
}

export function canClientCancelServiceRequest(
  status: CrmServiceRequestLifecycleStatus,
): boolean {
  return status === "submitted";
}

export function validateServiceRequestTransition(input: {
  from: CrmServiceRequestLifecycleStatus;
  to: CrmServiceRequestLifecycleStatus;
  actorRole: CrmServiceRequestActorRole;
}): void {
  if (input.from === input.to) {
    throw new CrmServiceRequestTransitionError("same_state_noop", "No transition required");
  }
  if (isTerminalServiceRequestStatus(input.from)) {
    throw new CrmServiceRequestTransitionError(
      "terminal_state",
      "Request is in a terminal state",
    );
  }

  const allowed =
    input.actorRole === "client"
      ? canClientTransitionServiceRequest(input.from, input.to)
      : canAdviserTransitionServiceRequest(input.from, input.to);

  if (!allowed) {
    throw new CrmServiceRequestTransitionError(
      "invalid_transition",
      "Transition not permitted",
    );
  }
}

export function isValidServiceRequestCategory(
  value: string,
): value is CrmServiceRequestCategory {
  return (CRM_SERVICE_REQUEST_CATEGORIES as readonly string[]).includes(value);
}

export function isValidServiceRequestUrgency(
  value: string,
): value is CrmServiceRequestUrgency {
  return (CRM_SERVICE_REQUEST_URGENCIES as readonly string[]).includes(value);
}

export function serviceRequestCategoryLabel(category: CrmServiceRequestCategory): string {
  return category.replace(/_/g, " ");
}
