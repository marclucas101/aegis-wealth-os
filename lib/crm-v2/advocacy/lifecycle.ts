import type {
  CrmAdvocacyConsentState,
  CrmAdvocacyEventType,
  CrmAdvocacyFollowUpStatus,
  TransitionAdvocacyEventInput,
  UpdateAdvocacyEventInput,
  UpdateClientAdvocacyPreferencesInput,
} from "@/lib/crm-v2/advocacy/types";
import { requiresExplicitConsent } from "@/lib/crm-v2/advocacy/types";

export function validateConsentTransition(
  current: CrmAdvocacyConsentState,
  next: CrmAdvocacyConsentState,
): { ok: true } | { ok: false; error: string } {
  if (current === "withdrawn" && next === "granted") {
    return { ok: false, error: "Withdrawn consent requires a new explicit grant." };
  }
  if (current === next) {
    return { ok: true };
  }
  return { ok: true };
}

export function validateAdvocacyTransition(
  input: TransitionAdvocacyEventInput,
): { ok: true } | { ok: false; error: string } {
  const allowed = new Set(["deactivate", "consent_granted", "consent_withdrawn", "thank_you_sent"]);
  if (!allowed.has(input.transition)) {
    return { ok: false, error: "Invalid transition." };
  }
  if (input.expectedVersion < 1) {
    return { ok: false, error: "Invalid version." };
  }
  return { ok: true };
}

export function validateUpdateAdvocacyEvent(
  input: UpdateAdvocacyEventInput,
): { ok: true } | { ok: false; error: string } {
  if (input.expectedVersion < 1) {
    return { ok: false, error: "Invalid version." };
  }
  if (input.safeTitle !== undefined && input.safeTitle.trim().length === 0) {
    return { ok: false, error: "Title is required." };
  }
  return { ok: true };
}

export function validateClientPreferenceUpdate(
  input: UpdateClientAdvocacyPreferencesInput,
): { ok: true } | { ok: false; error: string } {
  if (input.expectedVersion < 1) {
    return { ok: false, error: "Invalid version." };
  }
  return { ok: true };
}

export function isIdempotentConsentWithdrawal(
  current: CrmAdvocacyConsentState,
  requested: CrmAdvocacyConsentState,
): boolean {
  return current === "withdrawn" && requested === "withdrawn";
}

export function deriveFollowUpStatus(
  nextFollowUpDate: string | null,
  current: CrmAdvocacyFollowUpStatus,
  todayIso: string,
): CrmAdvocacyFollowUpStatus {
  if (current === "completed" || current === "declined" || current === "none") {
    return current;
  }
  if (!nextFollowUpDate) return current;
  if (nextFollowUpDate < todayIso.slice(0, 10) && current === "pending") {
    return "overdue";
  }
  return current;
}

export function consentStateForEventType(eventType: CrmAdvocacyEventType): CrmAdvocacyConsentState {
  if (requiresExplicitConsent(eventType)) {
    return "pending";
  }
  if (eventType === "testimonial_withdrawn" || eventType === "permission_withdrawn") {
    return "withdrawn";
  }
  if (eventType === "do_not_ask_recorded") {
    return "declined";
  }
  return "not_required";
}

export function domainEventTypeForTransition(
  transition: TransitionAdvocacyEventInput["transition"],
): string {
  switch (transition) {
    case "consent_granted":
      return "consent_granted";
    case "consent_withdrawn":
      return "consent_withdrawn";
    case "thank_you_sent":
      return "thank_you_recorded";
    case "deactivate":
      return "advocacy_event_deactivated";
    default:
      return "advocacy_event_updated";
  }
}
