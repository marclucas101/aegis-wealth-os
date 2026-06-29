/**
 * Canonical CRM V2 appointment lifecycle — deterministic, no scattered Date usage.
 * Phase 03: adviser-permitted transitions; client transitions defined for Phase 04.
 */

export const CRM_APPOINTMENT_LIFECYCLE_STATUSES = [
  "requested",
  "proposed",
  "awaiting_confirmation",
  "confirmed",
  "rescheduled",
  "preparing",
  "ready",
  "in_progress",
  "follow_up_required",
  "closed",
  "cancelled_by_client",
  "cancelled_by_adviser",
  "no_show",
  "legacy_cancelled",
  "legacy_failed",
  "legacy_unknown",
] as const;

export type CrmAppointmentLifecycleStatus =
  (typeof CRM_APPOINTMENT_LIFECYCLE_STATUSES)[number];

export const CRM_APPOINTMENT_TERMINAL_STATUSES: ReadonlySet<CrmAppointmentLifecycleStatus> =
  new Set([
    "closed",
    "cancelled_by_client",
    "cancelled_by_adviser",
    "no_show",
    "legacy_cancelled",
    "legacy_failed",
  ]);

export const CRM_APPOINTMENT_CREATION_ALLOWED_STATUSES: ReadonlySet<CrmAppointmentLifecycleStatus> =
  new Set(["requested", "proposed", "awaiting_confirmation", "confirmed"]);

export type CrmAppointmentTransitionReasonCode =
  | "adviser_created"
  | "client_requested"
  | "adviser_proposed"
  | "client_confirmed"
  | "adviser_confirmed"
  | "begin_preparation"
  | "preparation_complete"
  | "meeting_started"
  | "meeting_completed"
  | "follow_up_needed"
  | "follow_up_complete"
  | "adviser_cancelled"
  | "client_cancelled"
  | "no_show_recorded"
  | "rescheduled"
  | "schedule_updated"
  | "legacy_mapped"
  | "operator_override";

export type CrmAppointmentActorRole = "adviser" | "client" | "system";

export type CrmAppointmentTransitionRequest = {
  from: CrmAppointmentLifecycleStatus;
  to: CrmAppointmentLifecycleStatus;
  actorRole: CrmAppointmentActorRole;
  reasonCode: CrmAppointmentTransitionReasonCode;
  occurredAt: string;
};

export type CrmAppointmentTransitionErrorCode =
  | "invalid_transition"
  | "terminal_state"
  | "same_state_noop";

export class CrmAppointmentTransitionError extends Error {
  readonly code: CrmAppointmentTransitionErrorCode;

  constructor(code: CrmAppointmentTransitionErrorCode, message: string) {
    super(message);
    this.name = "CrmAppointmentTransitionError";
    this.code = code;
  }
}

/** Adviser-permitted transitions (Phase 03). */
const ADVISER_TRANSITIONS: Record<
  CrmAppointmentLifecycleStatus,
  ReadonlySet<CrmAppointmentLifecycleStatus>
> = {
  requested: new Set([
    "proposed",
    "awaiting_confirmation",
    "confirmed",
    "cancelled_by_adviser",
  ]),
  proposed: new Set([
    "awaiting_confirmation",
    "confirmed",
    "cancelled_by_adviser",
    "cancelled_by_client",
  ]),
  awaiting_confirmation: new Set([
    "confirmed",
    "proposed",
    "cancelled_by_adviser",
    "cancelled_by_client",
  ]),
  confirmed: new Set([
    "preparing",
    "rescheduled",
    "cancelled_by_adviser",
    "cancelled_by_client",
  ]),
  rescheduled: new Set([
    "proposed",
    "awaiting_confirmation",
    "confirmed",
    "cancelled_by_adviser",
  ]),
  preparing: new Set(["ready", "cancelled_by_adviser"]),
  ready: new Set([
    "in_progress",
    "no_show",
    "rescheduled",
    "cancelled_by_adviser",
  ]),
  in_progress: new Set(["follow_up_required", "closed", "cancelled_by_adviser"]),
  follow_up_required: new Set(["closed", "preparing"]),
  closed: new Set(),
  cancelled_by_client: new Set(),
  cancelled_by_adviser: new Set(),
  no_show: new Set(),
  legacy_cancelled: new Set(),
  legacy_failed: new Set(),
  legacy_unknown: new Set(["proposed", "confirmed", "cancelled_by_adviser"]),
};

/** Future client-permitted transitions (Phase 04) — defined now, not writable in Phase 03 APIs. */
const CLIENT_TRANSITIONS: Record<
  CrmAppointmentLifecycleStatus,
  ReadonlySet<CrmAppointmentLifecycleStatus>
> = {
  requested: new Set(["cancelled_by_client"]),
  proposed: new Set(["awaiting_confirmation", "confirmed", "cancelled_by_client"]),
  awaiting_confirmation: new Set(["confirmed", "cancelled_by_client"]),
  confirmed: new Set(["cancelled_by_client"]),
  rescheduled: new Set(["confirmed", "cancelled_by_client"]),
  preparing: new Set(),
  ready: new Set(),
  in_progress: new Set(),
  follow_up_required: new Set(),
  closed: new Set(),
  cancelled_by_client: new Set(),
  cancelled_by_adviser: new Set(),
  no_show: new Set(),
  legacy_cancelled: new Set(),
  legacy_failed: new Set(),
  legacy_unknown: new Set(),
};

export function isTerminalLifecycleStatus(
  status: CrmAppointmentLifecycleStatus,
): boolean {
  return CRM_APPOINTMENT_TERMINAL_STATUSES.has(status);
}

export function isCreationAllowedStatus(
  status: CrmAppointmentLifecycleStatus,
): boolean {
  return CRM_APPOINTMENT_CREATION_ALLOWED_STATUSES.has(status);
}

export function getAllowedAdviserTransitions(
  from: CrmAppointmentLifecycleStatus,
): CrmAppointmentLifecycleStatus[] {
  return [...(ADVISER_TRANSITIONS[from] ?? [])];
}

export function getAllowedClientTransitions(
  from: CrmAppointmentLifecycleStatus,
): CrmAppointmentLifecycleStatus[] {
  return [...(CLIENT_TRANSITIONS[from] ?? [])];
}

export function canAdviserTransition(
  from: CrmAppointmentLifecycleStatus,
  to: CrmAppointmentLifecycleStatus,
): boolean {
  if (from === to) return false;
  return ADVISER_TRANSITIONS[from]?.has(to) ?? false;
}

export function canClientTransition(
  from: CrmAppointmentLifecycleStatus,
  to: CrmAppointmentLifecycleStatus,
): boolean {
  if (from === to) return false;
  return CLIENT_TRANSITIONS[from]?.has(to) ?? false;
}

/**
 * Validates and returns transition metadata. Throws on invalid transition.
 * Same-state transitions throw — callers must treat as no-op before calling if idempotent.
 */
export function validateAppointmentTransition(
  request: CrmAppointmentTransitionRequest,
): CrmAppointmentTransitionRequest {
  const { from, to, actorRole } = request;

  if (from === to) {
    throw new CrmAppointmentTransitionError(
      "same_state_noop",
      "Transition target matches current state",
    );
  }

  if (isTerminalLifecycleStatus(from)) {
    throw new CrmAppointmentTransitionError(
      "terminal_state",
      `Cannot transition from terminal state: ${from}`,
    );
  }

  const allowed =
    actorRole === "adviser"
      ? canAdviserTransition(from, to)
      : actorRole === "client"
        ? canClientTransition(from, to)
        : canAdviserTransition(from, to) || canClientTransition(from, to);

  if (!allowed) {
    throw new CrmAppointmentTransitionError(
      "invalid_transition",
      `Transition not allowed: ${from} → ${to} for ${actorRole}`,
    );
  }

  return request;
}

/** Maps CRM lifecycle to legacy adviser_appointment_status for compatibility writes. */
export function mapLifecycleToLegacyStatus(
  lifecycle: CrmAppointmentLifecycleStatus,
): "pending" | "confirmed" | "cancelled" | "completed" | "failed" {
  switch (lifecycle) {
    case "requested":
    case "proposed":
    case "awaiting_confirmation":
    case "rescheduled":
    case "preparing":
    case "ready":
      return "pending";
    case "confirmed":
    case "in_progress":
    case "follow_up_required":
      return "confirmed";
    case "closed":
    case "no_show":
      return "completed";
    case "cancelled_by_client":
    case "cancelled_by_adviser":
    case "legacy_cancelled":
      return "cancelled";
    case "legacy_failed":
      return "failed";
    case "legacy_unknown":
      return "pending";
    default:
      return "pending";
  }
}

export function lifecycleStatusLabel(status: CrmAppointmentLifecycleStatus): string {
  return status.replace(/_/g, " ");
}

export function deriveAdviserActions(
  status: CrmAppointmentLifecycleStatus,
): string[] {
  const transitions = getAllowedAdviserTransitions(status);
  const actions: string[] = [];

  for (const target of transitions) {
    switch (target) {
      case "confirmed":
        actions.push("confirm");
        break;
      case "preparing":
        actions.push("begin_preparation");
        break;
      case "ready":
        actions.push("mark_ready");
        break;
      case "in_progress":
        actions.push("start_meeting");
        break;
      case "follow_up_required":
        actions.push("move_to_follow_up");
        break;
      case "closed":
        actions.push("close");
        break;
      case "cancelled_by_adviser":
        actions.push("cancel");
        break;
      case "no_show":
        actions.push("record_no_show");
        break;
      case "rescheduled":
      case "proposed":
      case "awaiting_confirmation":
        break;
      default:
        break;
    }
  }

  if (
    status === "confirmed" ||
    status === "ready" ||
    status === "preparing" ||
    status === "rescheduled"
  ) {
    actions.push("reschedule");
  }

  return [...new Set(actions)];
}
