"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { StressTestResult } from "@/src/lib/scoring/types";

const SCENARIO_LABELS: Record<StressTestResult["scenario"], string> = {
  income_loss: "Income Loss",
  critical_illness: "Critical Illness",
  death_event: "Death Event",
  disability: "Disability",
  market_crash: "Market Crash",
  inflation_shock: "Inflation Shock",
  longevity: "Longevity",
  business_failure: "Business Failure",
  parent_care: "Parent Care",
  estate_delay: "Estate Transfer Delay",
};

interface BlueprintStressSummaryProps {
  topExposures: StressTestResult[];
  preStressScore: number;
}

export default function BlueprintStressSummary({
  topExposures,
  preStressScore,
}: BlueprintStressSummaryProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Section 05
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Stress Test Summary
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Top three disruption exposures · Moderate severity calibration
        </p>
      </div>

      <div className="grid gap-px bg-[#D1A866]/8 sm:grid-cols-3">
        {topExposures.map((test, index) => {
          const impact = test.preStressScore - test.postStressScore;
          const stabilityRatio =
            test.postStressScore / Math.max(test.preStressScore, 1);

          return (
            <div key={test.scenario} className="bg-[#10283A]/90 px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="rounded-sm border border-[#D1A866]/20 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-[#D1A866]/70">
                  #{index + 1}
                </span>
                <p className="text-sm text-[#F3F1EA]">
                  {SCENARIO_LABELS[test.scenario]}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Post-Stress Score
                  </span>
                  <span className="font-mono text-lg tabular-nums text-[#F3F1EA]">
                    {formatScore(test.postStressScore)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Score Impact
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[#F3F1EA]/60">
                    −{formatScore(impact)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                    Absorption Ratio
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[#D1A866]/80">
                    {Math.round(stabilityRatio * 100)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#D1A866]/10 px-6 py-4 sm:px-8">
        <p className="text-xs font-light text-[#F3F1EA]/40">
          Baseline shield score {formatScore(preStressScore)} · Scenarios ranked
          by lowest post-stress absorption at moderate severity
        </p>
      </div>
    </section>
  );
}
