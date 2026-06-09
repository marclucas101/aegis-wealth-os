"use client";

import { formatPercent, formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AWRIResult, ShieldScoreResult } from "@/src/lib/scoring/types";

interface BlueprintScoreOverviewProps {
  shield: ShieldScoreResult;
  awri: AWRIResult;
}

function ScoreMetric({
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
    <div className="flex flex-col bg-[#10283A]/90 px-5 py-5 sm:px-6 sm:py-6">
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

export default function BlueprintScoreOverview({
  shield,
  awri,
}: BlueprintScoreOverviewProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Section 03
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Shield Score Overview
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Composite diagnostic metrics · AEGIS Shield Diagnostic™
        </p>
      </div>

      <div className="relative grid gap-px bg-[#D1A866]/8 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreMetric
          label="Adjusted Shield Score"
          value={formatScore(shield.adjustedShieldScore)}
          highlight
          sublabel="Confidence-adjusted composite"
        />
        <ScoreMetric
          label="Raw Shield Score"
          value={formatScore(shield.rawShieldScore)}
          sublabel="Unadjusted pillar composite"
        />
        <ScoreMetric
          label="Shield Rating"
          value={shield.rating}
          highlight
          sublabel="Institutional grade"
        />
        <ScoreMetric
          label="AWRI™"
          value={formatScore(awri.awri)}
          sublabel={`Rating ${awri.rating}`}
        />
        <ScoreMetric
          label="Discover Score"
          value={formatScore(shield.discoverScore)}
          sublabel="Profile completeness index"
        />
        <ScoreMetric
          label="Data Confidence Factor"
          value={formatPercent(shield.dataConfidenceFactor)}
          sublabel="Input reliability weight"
        />
        <ScoreMetric
          label="Resilience Score"
          value={formatScore(awri.resilienceScore)}
          sublabel="AWRI component"
        />
        <ScoreMetric
          label="Continuity Score"
          value={formatScore(awri.continuityScore)}
          sublabel="AWRI component"
        />
      </div>
    </section>
  );
}
