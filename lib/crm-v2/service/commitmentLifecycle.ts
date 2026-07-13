/**
 * Canonical CRM V2 commitment lifecycle — deterministic transitions.
 * Phase 06: owner-aware and visibility-aware rules.
 */

export const CRM_COMMITMENT_LIFECYCLE_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_client",
  "waiting_on_adviser",
  "blocked",
  "completed",
  "cancelled",
] as const;

export type CrmCommitmentLifecycleStatus =
  (typeof CRM_COMMITMENT_LIFECYCLE_STATUSES)[number];

export const CRM_COMMITMENT_TERMINAL_STATUSES: ReadonlySet<CrmCommitmentLifecycleStatus> =
  new Set(["completed", "cancelled"]);

export type CrmCommitmentOwner = "adviser" | "client" | "shared";

export type CrmCommitmentActorRole = "adviser" | "client" | "system";

export type CrmCommitmentTransitionReasonCode =
  | "adviser_created"
  | "client_created"
  | "adviser_progressed"
  | "client_progressed"
  | "waiting_on_client"
  | "waiting_on_adviser"
  | "blocked"
  | "adviser_completed"
  | "client_completed"
  | "shared_completed"
  | "adviser_cancelled"
  | "client_cancelled"
  | "meeting_outcome_linked"
  | "document_received"
  | "operator_override";

export type CrmCommitmentTransitionErrorCode =
  | "invalid_transition"
  | "terminal_state"
  | "same_state_noop"
  | "owner_forbidden";

export class CrmCommitmentTransitionError extends Error {
  readonly code: CrmCommitmentTransitionErrorCode;

  constructor(code: CrmCommitmentTransitionErrorCode, message: string) {
    super(message);
    this.name = "CrmCommitmentTransitionError";
    this.code = code;
  }
}

const ADVISER_TRANSITIONS: Record<
  CrmCommitmentLifecycleStatus,
  ReadonlySet<CrmCommitmentLifecycleStatus>
> = {
  open: new Set([
    "in_progress",
    "waiting_on_client",
    "waiting_on_adviser",
    "blocked",
    "completed",
    "cancelled",
  ]),
  in_progress: new Set([
    "waiting_on_client",
    "waiting_on_adviser",
    "blocked",
    "completed",
    "cancelled",
  ]),
  waiting_on_client: new Set([
    "in_progress",
    "waiting_on_adviser",
    "blocked",
    "completed",
    "cancelled",
  ]),
  waiting_on_adviser: new Set([
    "in_progress",
    "waiting_on_client",
    "blocked",
    "completed",
    "cancelled",
  ]),
  blocked: new Set(["in_progress", "waiting_on_client", "waiting_on_adviser", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const CLIENT_TRANSITIONS: Record<
  CrmCommitmentLifecycleStatus,
  ReadonlySet<CrmCommitmentLifecycleStatus>
> = {
  open: new Set(["in_progress", "waiting_on_adviser", "completed", "cancelled"]),
  in_progress: new Set(["waiting_on_adviser", "completed", "cancelled"]),
  waiting_on_client: new Set(["in_progress", "completed"]),
  waiting_on_adviser: new Set(["waiting_on_client"]),
  blocked: new Set(),
  completed: new Set(),
  cancelled: new Set(),
};

export function isTerminalCommitmentStatus(
  status: CrmCommitmentLifecycleStatus,
): boolean {
  return CRM_COMMITMENT_TERMINAL_STATUSES.has(status);
}

export function canAdviserTransitionCommitment(
  from: CrmCommitmentLifecycleStatus,
  to: CrmCommitmentLifecycleStatus,
): boolean {
  if (from === to) return false;
  return ADVISER_TRANSITIONS[from]?.has(to) ?? false;
}

export function canClientTransitionCommitment(
  from: CrmCommitmentLifecycleStatus,
  to: CrmCommitmentLifecycleStatus,
  owner: CrmCommitmentOwner,
): boolean {
  if (from === to) return false;
  if (owner === "adviser") return false;
  return CLIENT_TRANSITIONS[from]?.has(to) ?? false;
}

export function canClientCompleteCommitment(owner: CrmCommitmentOwner): boolean {
  return owner === "client" || owner === "shared";
}

export function commitmentStatusLabel(status: CrmCommitmentLifecycleStatus): string {
  return status.replace(/_/g, " ");
}

export function validateCommitmentTransition(input: {
  from: CrmCommitmentLifecycleStatus;
  to: CrmCommitmentLifecycleStatus;
  actorRole: CrmCommitmentActorRole;
  owner: CrmCommitmentOwner;
}): void {
  if (input.from === input.to) {
    throw new CrmCommitmentTransitionError("same_state_noop", "No transition required");
  }
  if (isTerminalCommitmentStatus(input.from)) {
    throw new CrmCommitmentTransitionError(
      "terminal_state",
      "Commitment is in a terminal state",
    );
  }

  if (input.actorRole === "adviser" || input.actorRole === "system") {
    if (!canAdviserTransitionCommitment(input.from, input.to)) {
      throw new CrmCommitmentTransitionError(
        "invalid_transition",
        "Transition not permitted for adviser",
      );
    }
    return;
  }

  if (!canClientTransitionCommitment(input.from, input.to, input.owner)) {
    throw new CrmCommitmentTransitionError(
      "invalid_transition",
      "Transition not permitted for client",
    );
  }

  if (
    input.to === "completed" &&
    !canClientCompleteCommitment(input.owner)
  ) {
    throw new CrmCommitmentTransitionError(
      "owner_forbidden",
      "Client cannot complete adviser-owned commitment",
    );
  }
}

export function getAllowedAdviserCommitmentTransitions(
  from: CrmCommitmentLifecycleStatus,
): CrmCommitmentLifecycleStatus[] {
  return [...(ADVISER_TRANSITIONS[from] ?? [])];
}

export function getAllowedClientCommitmentTransitions(
  from: CrmCommitmentLifecycleStatus,
  owner: CrmCommitmentOwner,
): CrmCommitmentLifecycleStatus[] {
  if (owner === "adviser") return [];
  return [...(CLIENT_TRANSITIONS[from] ?? [])].filter(
    (to) => to !== "completed" || canClientCompleteCommitment(owner),
  );
}
