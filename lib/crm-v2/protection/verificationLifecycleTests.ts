import {
  assertClientCannotVerify,
  validateVerificationTransition,
  verificationStateLabel,
} from "@/lib/crm-v2/protection/verificationLifecycle";
import { maskPolicyNumber } from "@/lib/crm-v2/protection/deduplication";

function expectThrows(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

function runProtectionVerificationLifecycleTests(): void {
  validateVerificationTransition({
    fromState: "provisional",
    toState: "confirmed",
    actorRole: "adviser",
  });
  validateVerificationTransition({
    fromState: "awaiting_review",
    toState: "corrected",
    actorRole: "adviser",
  });
  if (!expectThrows(() => assertClientCannotVerify())) {
    throw new Error("client confirm should throw");
  }
  if (
    !expectThrows(() =>
      validateVerificationTransition({
        fromState: "rejected",
        toState: "confirmed",
        actorRole: "adviser",
      }),
    )
  ) {
    throw new Error("rejected to confirmed should fail");
  }
  if (verificationStateLabel("confirmed") !== "Confirmed") {
    throw new Error("label mismatch");
  }
  const masked = maskPolicyNumber("ABC123456789");
  if (!masked?.endsWith("6789") || masked.includes("123456")) {
    throw new Error("mask policy number failed");
  }
}

runProtectionVerificationLifecycleTests();
console.log("protection verification lifecycle tests passed");
