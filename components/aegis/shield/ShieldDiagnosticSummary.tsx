"use client";

import type { ShieldScoreResult } from "@/src/lib/scoring/types";

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFactor(value: number): string {
  return value.toFixed(3);
}

interface ShieldDiagnosticSummaryProps {
  shield: ShieldScoreResult;
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
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
        {label}
      </span>
      <span
        className={`font-mono text-2xl font-light tabular-nums tracking-tight sm:text-3xl ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </span>
      {sublabel && (
        <span className="text-xs font-light text-[#F3F1EA]/40">{sublabel}</span>
      )}
    </div>
  );
}

export default function ShieldDiagnosticSummary({
  shield,
}: ShieldDiagnosticSummaryProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/60 to-transparent" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
              Shield Diagnostic™
            </p>
            <h2 className="mt-1 text-lg font-light tracking-wide text-[#F3F1EA] sm:text-xl">
              Preliminary Composite Assessment
            </h2>
            <p className="mt-2 max-w-xl text-sm font-light text-[#F3F1EA]/40">
              Derived from Discover™ profile data. Scores adjust as profile
              completeness improves via the Data Confidence Factor™.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start rounded-sm border border-[#D1A866]/25 bg-[#1A2A2B]/50 px-4 py-3 sm:self-auto">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/45">
              Shield Rating
            </span>
            <span className="font-mono text-2xl font-light tracking-wider text-[#D1A866]">
              {shield.rating}
            </span>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCell
            label="Adjusted Shield Score™"
            value={formatScore(shield.adjustedShieldScore)}
            sublabel="Confidence-adjusted composite"
            highlight
          />
          <MetricCell
            label="Raw Shield Score™"
            value={formatScore(shield.rawShieldScore)}
            sublabel="Unadjusted pillar composite"
          />
          <MetricCell
            label="Discover Score™"
            value={formatScore(shield.discoverScore)}
            sublabel="Profile completeness"
          />
          <MetricCell
            label="Data Confidence Factor™"
            value={formatFactor(shield.dataConfidenceFactor)}
            sublabel="Range 0.70 – 1.00"
          />
          <MetricCell
            label="Pillar Coverage"
            value="7 / 7"
            sublabel="Preliminary diagnostic pillars"
          />
        </div>
      </div>
    </section>
  );
}
