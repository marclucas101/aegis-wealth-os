"use client";

import type { ReadinessRating } from "@/lib/supabase/clientFileQuality";

const RATING_LABELS: Record<ReadinessRating, string> = {
  excellent: "Excellent",
  good: "Good",
  incomplete: "Incomplete",
  poor: "Poor",
};

const RATING_STYLES: Record<ReadinessRating, string> = {
  excellent: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  good: "border-[#D1A866]/35 bg-[#D1A866]/10 text-[#D1A866]",
  incomplete: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  poor: "border-red-400/30 bg-red-400/10 text-red-300",
};

interface AdvisorFileQualityBadgeProps {
  rating: ReadinessRating;
  score?: number;
  reviewReady?: boolean;
  compact?: boolean;
}

export default function AdvisorFileQualityBadge({
  rating,
  score,
  reviewReady,
  compact = false,
}: AdvisorFileQualityBadgeProps) {
  const label =
    score != null
      ? `${score}% · ${RATING_LABELS[rating]}`
      : RATING_LABELS[rating];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border font-medium uppercase tracking-[0.12em] ${RATING_STYLES[rating]} ${
        compact ? "px-2 py-0.5 text-[8px]" : "px-2.5 py-1 text-[9px]"
      }`}
      title={reviewReady ? "Review-ready client file" : "File not review-ready"}
    >
      {reviewReady ? (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ) : null}
      {label}
    </span>
  );
}

export { RATING_LABELS as FILE_QUALITY_RATING_LABELS };
