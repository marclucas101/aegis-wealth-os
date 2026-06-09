"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import type { AnnualReviewPageResults } from "@/lib/aegis/localProfile";

interface AnnualReviewScoreCardProps {
  results: AnnualReviewPageResults;
}

export default function AnnualReviewScoreCard({
  results,
}: AnnualReviewScoreCardProps) {
  const { shield, projected, discoverScore, dataConfidenceFactor, awri, weakestPillars, totalImprovement } =
    results;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Diagnostic Summary
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Current architecture metrics
        </h3>
      </div>

      <div className="relative grid gap-px bg-[#D1A866]/8 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCell
          label="Current Shield Score"
          value={formatScore(shield.adjustedShieldScore)}
          sublabel={`Rating ${shield.rating}`}
        />
        <MetricCell
          label="Projected Shield Score"
          value={formatScore(projected.projectedAdjustedShieldScore)}
          sublabel={`Rating ${projected.projectedRating}`}
          highlight
        />
        <MetricCell
          label="Estimated Total Improvement"
          value={`+${formatScore(Math.max(0, totalImprovement))}`}
          sublabel="On full roadmap completion"
          highlight={totalImprovement > 0}
        />
        <MetricCell
          label="Discover Score"
          value={formatScore(discoverScore)}
          sublabel="Profile completeness"
        />
        <MetricCell
          label="Data Confidence Factor"
          value={`${Math.round(dataConfidenceFactor * 100)}%`}
          sublabel="Diagnostic reliability"
        />
        <MetricCell
          label="AWRI™"
          value={formatScore(awri.awri)}
          sublabel={`Rating ${awri.rating}`}
        />
        <MetricCell
          label="Current Rating"
          value={shield.rating}
        />
        <MetricCell
          label="Projected Rating"
          value={projected.projectedRating}
          highlight={projected.projectedRating !== shield.rating}
        />
      </div>

      <div className="relative border-t border-[#D1A866]/10 px-6 py-6 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Top 3 Weakest Pillars
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {weakestPillars.map((pillar, index) => (
            <div
              key={pillar.pillar}
              className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/50 px-4 py-4"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tabular-nums text-[#D1A866]/60">
                  #{index + 1}
                </span>
                <p className="text-sm text-[#F3F1EA]">{pillar.label}</p>
              </div>
              <p className="mt-2 font-mono text-xl font-light tabular-nums text-[#F3F1EA]/80">
                {formatScore(pillar.score)}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
                {PILLAR_LABELS[pillar.pillar]} pillar
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCell({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[#10283A]/90 px-5 py-5 sm:px-6">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-light tabular-nums tracking-tight ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-xs text-[#F3F1EA]/35">{sublabel}</p>
      )}
    </div>
  );
}
