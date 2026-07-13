/**
 * Canonical CRM V2 protection verification lifecycle (Phase 07).
 * Extraction review and policy version states share this vocabulary.
 */

export const CRM_PROTECTION_VERIFICATION_STATES = [
  "provisional",
  "awaiting_review",
  "confirmed",
  "corrected",
  "rejected",
  "superseded",
  "archived",
] as const;

export type CrmProtectionVerificationState =
  (typeof CRM_PROTECTION_VERIFICATION_STATES)[number];

export const CRM_PROTECTION_TERMINAL_VERIFICATION_STATES: ReadonlySet<CrmProtectionVerificationState> =
  new Set(["rejected", "superseded", "archived"]);

export const CRM_PROTECTION_PORTFOLIO_ELIGIBLE_STATES: ReadonlySet<CrmProtectionVerificationState> =
  new Set(["confirmed", "corrected"]);

export type CrmProtectionVerificationActorRole = "adviser" | "system";

export type CrmProtectionVerificationTransitionReasonCode =
  | "extraction_created"
  | "submitted_for_review"
  | "adviser_confirmed"
  | "adviser_corrected"
  | "adviser_rejected"
  | "version_superseded"
  | "policy_archived"
  | "operator_override";

export type CrmProtectionVerificationTransitionErrorCode =
  | "invalid_transition"
  | "terminal_state"
  | "same_state_noop"
  | "actor_forbidden"
  | "client_forbidden";

export class CrmProtectionVerificationTransitionError extends Error {
  readonly code: CrmProtectionVerificationTransitionErrorCode;

  constructor(code: CrmProtectionVerificationTransitionErrorCode, message: string) {
    super(message);
    this.name = "CrmProtectionVerificationTransitionError";
    this.code = code;
  }
}

const ADVISER_TRANSITIONS: Record<
  CrmProtectionVerificationState,
  ReadonlySet<CrmProtectionVerificationState>
> = {
  provisional: new Set(["awaiting_review", "confirmed", "corrected", "rejected", "archived"]),
  awaiting_review: new Set(["confirmed", "corrected", "rejected", "archived"]),
  confirmed: new Set(["superseded", "archived"]),
  corrected: new Set(["superseded", "archived"]),
  rejected: new Set(["archived"]),
  superseded: new Set(["archived"]),
  archived: new Set(),
};

export function verificationStateLabel(state: CrmProtectionVerificationState): string {
  const labels: Record<CrmProtectionVerificationState, string> = {
    provisional: "Provisional",
    awaiting_review: "Awaiting review",
    confirmed: "Confirmed",
    corrected: "Corrected",
    rejected: "Rejected",
    superseded: "Superseded",
    archived: "Archived",
  };
  return labels[state];
}

export function isValidVerificationState(
  value: string,
): value is CrmProtectionVerificationState {
  return (CRM_PROTECTION_VERIFICATION_STATES as readonly string[]).includes(value);
}

export function validateVerificationTransition(input: {
  fromState: CrmProtectionVerificationState;
  toState: CrmProtectionVerificationState;
  actorRole: CrmProtectionVerificationActorRole;
}): void {
  if (input.actorRole !== "adviser" && input.actorRole !== "system") {
    throw new CrmProtectionVerificationTransitionError(
      "actor_forbidden",
      "Only adviser or system may transition verification state",
    );
  }

  if (input.fromState === input.toState) {
    throw new CrmProtectionVerificationTransitionError(
      "same_state_noop",
      "Transition to same state is not a write",
    );
  }

  if (CRM_PROTECTION_TERMINAL_VERIFICATION_STATES.has(input.fromState)) {
    throw new CrmProtectionVerificationTransitionError(
      "terminal_state",
      "Cannot transition from terminal verification state",
    );
  }

  const allowed = ADVISER_TRANSITIONS[input.fromState];
  if (!allowed.has(input.toState)) {
    throw new CrmProtectionVerificationTransitionError(
      "invalid_transition",
      `Invalid verification transition from ${input.fromState} to ${input.toState}`,
    );
  }
}

export function assertClientCannotVerify(): void {
  throw new CrmProtectionVerificationTransitionError(
    "client_forbidden",
    "Clients cannot confirm or correct protection policy versions",
  );
}

export function getAllowedAdviserVerificationTransitions(
  fromState: CrmProtectionVerificationState,
): CrmProtectionVerificationState[] {
  if (CRM_PROTECTION_TERMINAL_VERIFICATION_STATES.has(fromState)) {
    return [];
  }
  return Array.from(ADVISER_TRANSITIONS[fromState]);
}

export function isPortfolioEligibleState(state: CrmProtectionVerificationState): boolean {
  return CRM_PROTECTION_PORTFOLIO_ELIGIBLE_STATES.has(state);
}

export function initialExtractionReviewState(): CrmProtectionVerificationState {
  return "provisional";
}

export function reviewSubmittedState(): CrmProtectionVerificationState {
  return "awaiting_review";
}
