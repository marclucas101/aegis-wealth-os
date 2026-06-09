"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AnnualReviewPageResults } from "@/lib/aegis/localProfile";

interface AnnualReviewProgressPanelProps {
  results: AnnualReviewPageResults;
  saveState?: "idle" | "saving" | "saved" | "error";
}

export default function AnnualReviewProgressPanel({
  results,
  saveState,
}: AnnualReviewProgressPanelProps) {
  const { shield, projected, roadmap, totalImprovement } = results;

  const completedCount = roadmap.filter((item) => item.status === "completed").length;
  const inProgressCount = roadmap.filter(
    (item) => item.status === "in_progress"
  ).length;
  const notStartedCount = roadmap.filter(
    (item) => item.status === "not_started"
  ).length;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Shield Progression
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Current architecture to projected target
          {saveState === "saved"
            ? " · Snapshot saved"
            : saveState === "error"
              ? " · Save failed"
              : ""}
        </h3>
      </div>

      <div className="relative px-5 py-6 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
          <ScoreNode
            label="Current"
            score={shield.adjustedShieldScore}
            rating={shield.rating}
          />

          <div className="flex flex-col items-center gap-2 px-4">
            <div className="hidden h-px w-16 bg-gradient-to-r from-[#D1A866]/40 to-[#D1A866]/10 sm:block" />
            <div className="rounded-sm border border-[#D1A866]/25 bg-[#1A2A2B]/50 px-4 py-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/40">
                Estimated Improvement
              </p>
              <p className="font-mono text-lg tabular-nums text-[#D1A866]">
                +{formatScore(Math.max(0, totalImprovement))}
              </p>
            </div>
            <svg
              viewBox="0 0 24 12"
              className="h-3 w-8 text-[#D1A866]/40 sm:hidden"
              aria-hidden
            >
              <path
                d="M2 6h16m0 0l-4-4m4 4l-4 4"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>

          <ScoreNode
            label="Projected Target"
            score={projected.projectedAdjustedShieldScore}
            rating={projected.projectedRating}
            highlight
          />
        </div>

        <div className="mt-8 grid gap-px rounded-sm border border-[#D1A866]/10 bg-[#D1A866]/8 sm:grid-cols-3">
          <StatusCell label="Completed" value={completedCount} />
          <StatusCell label="In Progress" value={inProgressCount} />
          <StatusCell label="Not Started" value={notStartedCount} />
        </div>
      </div>
    </section>
  );
}

function ScoreNode({
  label,
  score,
  rating,
  highlight = false,
}: {
  label: string;
  score: number;
  rating: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-4xl font-light tabular-nums tracking-tight ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {formatScore(score)}
      </p>
      <p className="mt-1 text-xs text-[#F3F1EA]/45">Rating {rating}</p>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#10283A]/90 px-5 py-4 text-center">
      <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl tabular-nums text-[#F3F1EA]/75">
        {value}
      </p>
    </div>
  );
}
