import type { CrmMomentConfirmationState } from "@/lib/crm-v2/moments/types";

export function validateMomentAcknowledgement(input: {
  active: boolean;
  confirmationState: CrmMomentConfirmationState;
}): { ok: true } | { ok: false; reason: "inactive" | "not_confirmable" } {
  if (!input.active) {
    return { ok: false, reason: "inactive" };
  }
  if (input.confirmationState === "rejected") {
    return { ok: false, reason: "not_confirmable" };
  }
  return { ok: true };
}

export function validateSuggestionTransition(input: {
  from: CrmMomentConfirmationState;
  to: "confirmed" | "rejected";
}): boolean {
  return input.from === "suggested";
}

export function validateReviewRhythmStatusTransition(
  from: string,
  to: string,
): boolean {
  const allowed: Record<string, string[]> = {
    scheduled: ["overdue", "completed", "paused"],
    overdue: ["completed", "paused", "scheduled"],
    completed: ["scheduled"],
    paused: ["scheduled"],
  };
  return (allowed[from] ?? []).includes(to);
}

export function computeReviewStatus(
  nextDueDate: string | null,
  now: Date = new Date(),
): "scheduled" | "overdue" {
  if (!nextDueDate) return "scheduled";
  const due = new Date(nextDueDate);
  return due < now ? "overdue" : "scheduled";
}

export function isIdempotentAcknowledgement(
  lastAcknowledgedAt: string | null,
  withinMinutes: number,
  now: Date = new Date(),
): boolean {
  if (!lastAcknowledgedAt) return false;
  const last = new Date(lastAcknowledgedAt);
  const diffMs = now.getTime() - last.getTime();
  return diffMs < withinMinutes * 60 * 1000;
}
