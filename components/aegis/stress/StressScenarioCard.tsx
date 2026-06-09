"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { StressScenario, StressTestResult } from "@/src/lib/scoring/types";

export const SCENARIO_LABELS: Record<StressScenario, string> = {
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

interface StressScenarioCardProps {
  test: StressTestResult;
  selected: boolean;
  rank?: number;
  onSelect: () => void;
}

export default function StressScenarioCard({
  test,
  selected,
  rank,
  onSelect,
}: StressScenarioCardProps) {
  const impact = test.preStressScore - test.postStressScore;
  const stabilityRatio = test.postStressScore / Math.max(test.preStressScore, 1);
  const isHighExposure = stabilityRatio < 0.85;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-sm border px-4 py-4 text-left transition-all ${
        selected
          ? "border-[#D1A866]/50 bg-[#D1A866]/10 shadow-[inset_0_0_0_1px_rgba(209,168,102,0.15)]"
          : "border-[#D1A866]/12 bg-[#10283A]/40 hover:border-[#D1A866]/25 hover:bg-[#10283A]/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span className="rounded-sm border border-[#D1A866]/20 px-1.5 py-0.5 font-mono text-[9px] tabular-nums text-[#D1A866]/70">
                #{rank}
              </span>
            )}
            <p className="truncate text-sm text-[#F3F1EA]">
              {SCENARIO_LABELS[test.scenario]}
            </p>
          </div>
          <p className="mt-1 font-mono text-[10px] tabular-nums text-[#F3F1EA]/35">
            Post-stress {formatScore(test.postStressScore)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`font-mono text-xs tabular-nums ${
              isHighExposure ? "text-[#F3F1EA]/70" : "text-[#D1A866]/80"
            }`}
          >
            −{formatScore(impact)}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/30">
            Impact
          </p>
        </div>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#071B2A]/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isHighExposure
              ? "bg-[#F3F1EA]/25"
              : "bg-gradient-to-r from-[#D1A866]/50 to-[#D1A866]"
          }`}
          style={{ width: `${Math.max(8, stabilityRatio * 100)}%` }}
        />
      </div>
    </button>
  );
}
