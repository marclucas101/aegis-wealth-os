"use client";

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

interface AdvisorClientPillarPanelProps {
  pillarScores: PillarScores | null;
  weakestPillar: ShieldPillar | null;
  strongestPillar: ShieldPillar | null;
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-[#D1A866]";
  if (score >= 60) return "bg-[#D1A866]/70";
  if (score >= 40) return "bg-[#D1A866]/40";
  return "bg-[#D1A866]/25";
}

export default function AdvisorClientPillarPanel({
  pillarScores,
  weakestPillar,
  strongestPillar,
}: AdvisorClientPillarPanelProps) {
  return (
    <section className="relative h-full overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Pillar Analysis
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Weighted diagnostic breakdown
        </p>
      </div>

      {!pillarScores ? (
        <div className="relative px-5 py-8 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No pillar scores available yet.
          </p>
        </div>
      ) : (
        <div className="relative flex flex-col gap-3 p-5">
          {PILLAR_ORDER.map((pillar) => {
            const score = pillarScores[pillar] ?? 0;
            const weight = SHIELD_PILLAR_WEIGHTS[pillar];
            const isWeakest = pillar === weakestPillar;
            const isStrongest = pillar === strongestPillar;

            return (
              <div key={pillar}>
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
                      {(weight * 100).toFixed(0)}% wt
                    </span>
                    <span className="font-mono text-sm tabular-nums text-[#D1A866]">
                      {formatScore(score)}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-sm bg-[#071B2A]/60">
                  <div
                    className={`h-full rounded-sm transition-all ${scoreTone(score)}`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
