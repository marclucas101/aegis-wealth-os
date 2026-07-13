import {
  canAdviserTransitionCommitment,
  canClientCompleteCommitment,
  canClientTransitionCommitment,
  isTerminalCommitmentStatus,
  validateCommitmentTransition,
  CrmCommitmentTransitionError,
} from "./commitmentLifecycle";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(canAdviserTransitionCommitment("open", "in_progress"), "adviser open→in_progress");
assert(!canAdviserTransitionCommitment("completed", "open"), "no reopen without explicit flow");
assert(isTerminalCommitmentStatus("completed"), "completed is terminal");
assert(isTerminalCommitmentStatus("cancelled"), "cancelled is terminal");
assert(canClientCompleteCommitment("client"), "client can complete client-owned");
assert(canClientCompleteCommitment("shared"), "client can complete shared");
assert(!canClientCompleteCommitment("adviser"), "client cannot complete adviser-owned");
assert(
  canClientTransitionCommitment("waiting_on_client", "completed", "client"),
  "client can complete from waiting_on_client",
);
assert(
  !canClientTransitionCommitment("open", "completed", "adviser"),
  "client blocked on adviser-owned complete",
);

try {
  validateCommitmentTransition({
    from: "completed",
    to: "open",
    actorRole: "adviser",
    owner: "adviser",
  });
  assert(false, "terminal should throw");
} catch (err) {
  assert(
    err instanceof CrmCommitmentTransitionError && err.code === "terminal_state",
    "terminal_state error",
  );
}

console.log("CRM V2 commitment lifecycle tests passed");
