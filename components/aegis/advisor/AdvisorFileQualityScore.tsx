"use client";

import type { ReadinessRating } from "@/lib/supabase/clientFileQuality";

import AdvisorFileQualityBadge from "@/components/aegis/advisor/AdvisorFileQualityBadge";

interface AdvisorFileQualityScoreProps {
  readinessScore: number;
  readinessRating: ReadinessRating;
  reviewReady: boolean;
}

function scoreRingColor(rating: ReadinessRating): string {
  switch (rating) {
    case "excellent":
      return "stroke-emerald-400";
    case "good":
      return "stroke-[#D1A866]";
    case "incomplete":
      return "stroke-amber-400";
    default:
      return "stroke-red-400";
  }
}

export default function AdvisorFileQualityScore({
  readinessScore,
  readinessRating,
  reviewReady,
}: AdvisorFileQualityScoreProps) {
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (readinessScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-28 w-28 shrink-0">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 96 96"
          aria-hidden
        >
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-[#F3F1EA]/8"
          />
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`transition-all duration-700 ${scoreRingColor(readinessRating)}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-light tabular-nums text-[#F3F1EA]">
            {readinessScore}
          </span>
          <span className="text-[8px] uppercase tracking-[0.18em] text-[#F3F1EA]/40">
            Readiness
          </span>
        </div>
      </div>

      <div className="text-center sm:text-left">
        <AdvisorFileQualityBadge
          rating={readinessRating}
          reviewReady={reviewReady}
        />
        <p className="mt-2 text-sm font-light text-[#F3F1EA]/55">
          {reviewReady
            ? "Client file meets review-ready criteria."
            : "Additional data or documents required before review."}
        </p>
      </div>
    </div>
  );
}
