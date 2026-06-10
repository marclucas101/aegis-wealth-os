"use client";

export type ReviewServicingState =
  | "onboarding"
  | "active"
  | "review_due"
  | "overdue"
  | "high_priority"
  | "completed";

const STATE_LABELS: Record<ReviewServicingState, string> = {
  onboarding: "Onboarding",
  active: "Active",
  review_due: "Review Due",
  overdue: "Overdue",
  high_priority: "High Priority",
  completed: "Completed",
};

const STATE_STYLES: Record<ReviewServicingState, string> = {
  onboarding: "border-[#D1A866]/35 bg-[#D1A866]/10 text-[#D1A866]",
  active: "border-emerald-400/25 bg-emerald-950/30 text-emerald-300/90",
  review_due: "border-amber-400/25 bg-amber-950/30 text-amber-300/90",
  overdue: "border-red-400/25 bg-red-950/30 text-red-300/90",
  high_priority: "border-orange-400/25 bg-orange-950/30 text-orange-300/90",
  completed: "border-sky-400/25 bg-sky-950/30 text-sky-300/90",
};

interface AdvisorReviewStatusBadgeProps {
  state: ReviewServicingState;
  compact?: boolean;
}

export default function AdvisorReviewStatusBadge({
  state,
  compact = false,
}: AdvisorReviewStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border font-medium uppercase tracking-[0.14em] ${STATE_STYLES[state]} ${
        compact
          ? "px-2 py-0.5 text-[8px]"
          : "px-2.5 py-1 text-[9px]"
      }`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}

export { STATE_LABELS as REVIEW_STATE_LABELS };
