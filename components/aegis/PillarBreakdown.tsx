import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import type { PillarScores, ShieldPillar } from "@/src/lib/scoring/types";

const PILLAR_LABELS: Record<ShieldPillar, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

const PILLAR_ORDER: ShieldPillar[] = [
  "foundation",
  "protect",
  "grow",
  "optimise",
  "transition",
  "preserve",
  "legacy",
];

interface PillarBreakdownProps {
  pillarScores: PillarScores;
  weakestPillar: keyof PillarScores;
  strongestPillar: keyof PillarScores;
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-[#D1A866]";
  if (score >= 60) return "bg-[#D1A866]/70";
  if (score >= 40) return "bg-[#D1A866]/40";
  return "bg-[#D1A866]/25";
}

export default function PillarBreakdown({
  pillarScores,
  weakestPillar,
  strongestPillar,
}: PillarBreakdownProps) {
  return (
    <section className="flex h-full flex-col rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Pillar Breakdown
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Weighted Diagnostic Scores
        </h3>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        {PILLAR_ORDER.map((pillar) => {
          const score = pillarScores[pillar];
          const weight = SHIELD_PILLAR_WEIGHTS[pillar];
          const isWeakest = pillar === weakestPillar;
          const isStrongest = pillar === strongestPillar;

          return (
            <div key={pillar} className="group">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#F3F1EA]/85">
                    {PILLAR_LABELS[pillar]}
                  </span>
                  {isWeakest && (
                    <span className="rounded-sm border border-[#F3F1EA]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[#F3F1EA]/50">
                      Gap
                    </span>
                  )}
                  {isStrongest && (
                    <span className="rounded-sm border border-[#D1A866]/30 px-1.5 py-px text-[9px] uppercase tracking-wider text-[#D1A866]/80">
                      Strength
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] tabular-nums text-[#F3F1EA]/35">
                    {Math.round(weight * 100)}%
                  </span>
                  <span className="min-w-[2.5rem] shrink-0 text-right font-mono text-xs tabular-nums text-[#F3F1EA]">
                    {formatScore(score)}
                  </span>
                </div>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[#071B2A]">
                <div
                  className={`h-full rounded-full transition-all ${scoreTone(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
