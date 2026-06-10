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
  estate_delay: "Estate Delay",
};

interface StressTestPreviewProps {
  stressTests: StressTestResult[];
}

type StressTestPreviewRow = StressTestResult & {
  id?: string;
  created_at?: string;
};

function stressTestKey(test: StressTestResult, index: number): string {
  const row = test as StressTestPreviewRow;

  return (
    row.id ??
    `${test.scenario}-${test.severity ?? "unknown"}-${row.created_at ?? index}-${index}`
  );
}

export default function StressTestPreview({
  stressTests,
}: StressTestPreviewProps) {
  const preview = [...stressTests]
    .sort((a, b) => a.postStressScore - b.postStressScore)
    .slice(0, 5);

  const severity = stressTests[0]?.severity ?? "moderate";

  return (
    <section className="flex h-full flex-col rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Stress Testing™
            </p>
            <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
              Resilience Under Adverse Events
            </h3>
          </div>
          <span className="rounded-sm border border-[#D1A866]/20 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#D1A866]/70">
            {severity} severity
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col divide-y divide-[#D1A866]/8">
        {preview.map((test, index) => {
          const drop = test.preStressScore - test.postStressScore;

          return (
            <div
              key={stressTestKey(test, index)}
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#F3F1EA]/85">
                  {SCENARIO_LABELS[test.scenario]}
                </p>
                <p className="mt-0.5 font-mono text-[10px] tabular-nums text-[#F3F1EA]/35">
                  Penalty {formatScore(test.stressPenalty)} · Mitigation{" "}
                  {formatScore(test.mitigationCredit)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4 text-right">
                <div className="min-w-[2.5rem]">
                  <p className="font-mono text-xs tabular-nums text-[#F3F1EA]/50">
                    {formatScore(test.preStressScore)}
                  </p>
                  <p className="text-[9px] text-[#F3F1EA]/30">Pre</p>
                </div>
                <span className="text-[#D1A866]/40">→</span>
                <div className="min-w-[2.5rem]">
                  <p className="font-mono text-xs tabular-nums text-[#F3F1EA]">
                    {formatScore(test.postStressScore)}
                  </p>
                  <p className="text-[9px] text-[#F3F1EA]/30">Post</p>
                </div>
                <div className="min-w-[2.5rem]">
                  <p className="font-mono text-xs tabular-nums text-[#D1A866]/80">
                    −{formatScore(drop)}
                  </p>
                  <p className="text-[9px] text-[#F3F1EA]/30">Drop</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-[#D1A866]/10 px-5 py-3">
        <p className="text-[10px] text-[#F3F1EA]/35">
          Showing 5 highest-exposure scenarios of {stressTests.length} modelled
          events
        </p>
      </div>
    </section>
  );
}
