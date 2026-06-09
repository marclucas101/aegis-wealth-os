import type { AWRIResult, ShieldScoreResult } from "@/src/lib/scoring/types";

export function formatScore(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `S$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (abs >= 10_000) {
    return `S$${(value / 1_000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(value);
}

interface ShieldScoreCardProps {
  shield: ShieldScoreResult;
  awri: AWRIResult;
}

function MetricCell({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
        {label}
      </span>
      <span
        className={`min-w-0 truncate font-mono text-xl font-light tabular-nums tracking-tight sm:text-2xl lg:text-3xl ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </span>
      {sublabel && (
        <span className="text-xs text-[#F3F1EA]/45">{sublabel}</span>
      )}
    </div>
  );
}

export default function ShieldScoreCard({ shield, awri }: ShieldScoreCardProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/60 to-transparent" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
              AEGIS Shield™ Diagnostic
            </p>
            <h2 className="mt-1 text-lg font-light tracking-wide text-[#F3F1EA] sm:text-xl">
              Composite Shield Assessment
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
              Shield Rating
            </span>
            <span className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-4 py-1.5 font-mono text-xl font-medium tracking-widest text-[#D1A866]">
              {shield.rating}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-[#D1A866]/10 pt-6 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5 lg:gap-6">
          <MetricCell
            label="Adjusted Shield Score"
            value={formatScore(shield.adjustedShieldScore)}
            sublabel="Primary diagnostic metric"
            highlight
          />
          <MetricCell
            label="Raw Shield Score"
            value={formatScore(shield.rawShieldScore)}
            sublabel="Unadjusted composite"
          />
          <MetricCell
            label="AWRI"
            value={formatScore(awri.awri)}
            sublabel={`Rating ${awri.rating}`}
          />
          <MetricCell
            label="Data Confidence"
            value={formatPercent(shield.dataConfidenceFactor)}
            sublabel="Profile confidence"
          />
          <MetricCell
            label="Discover Score"
            value={formatScore(shield.discoverScore)}
            sublabel="Profile completeness"
          />
        </div>
      </div>
    </section>
  );
}
