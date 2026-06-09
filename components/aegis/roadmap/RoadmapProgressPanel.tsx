"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { ProjectedShieldResult, ShieldScoreResult } from "@/src/lib/scoring/types";

interface RoadmapProgressPanelProps {
  shield: ShieldScoreResult;
  projected: ProjectedShieldResult;
}

export default function RoadmapProgressPanel({
  shield,
  projected,
}: RoadmapProgressPanelProps) {
  const improvement =
    projected.projectedAdjustedShieldScore - shield.adjustedShieldScore;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Projected Shield
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Score progression on roadmap completion
        </h3>
      </div>

      <div className="relative grid gap-px bg-[#D1A866]/8 sm:grid-cols-2 lg:grid-cols-3">
        <MetricBlock
          label="Current Shield Score"
          value={formatScore(shield.adjustedShieldScore)}
          sublabel={`Raw ${formatScore(shield.rawShieldScore)}`}
        />
        <MetricBlock
          label="Projected Shield Score"
          value={formatScore(projected.projectedAdjustedShieldScore)}
          highlight
          sublabel={`Raw ${formatScore(projected.projectedRawShieldScore)}`}
        />
        <MetricBlock
          label="Estimated Improvement"
          value={`+${formatScore(Math.max(0, improvement))}`}
          highlight={improvement > 0}
          sublabel="From completed & in-progress actions"
        />
        <MetricBlock
          label="Current Rating"
          value={shield.rating}
        />
        <MetricBlock
          label="Projected Rating"
          value={projected.projectedRating}
          highlight={projected.projectedRating !== shield.rating}
        />
        <MetricBlock
          label="Data Confidence"
          value={`${Math.round(shield.dataConfidenceFactor * 100)}%`}
          sublabel="Discover profile completeness"
        />
      </div>
    </section>
  );
}

function MetricBlock({
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
    <div className="flex flex-col bg-[#10283A]/90 p-5 sm:p-6">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-light tabular-nums tracking-tight sm:text-3xl ${
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
