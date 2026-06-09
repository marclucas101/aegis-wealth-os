"use client";

import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import type { PillarScores, ShieldPillar } from "@/src/lib/scoring/types";
import { PILLAR_LABELS } from "@/lib/aegis/localProfile";

const PILLAR_ORDER: ShieldPillar[] = [
  "foundation",
  "protect",
  "grow",
  "optimise",
  "transition",
  "preserve",
  "legacy",
];

interface ShieldPillarCardsProps {
  pillarScores: PillarScores;
  weakestPillars: ShieldPillar[];
}

function scoreTone(score: number): string {
  if (score >= 80) return "from-[#D1A866]/80 to-[#D1A866]";
  if (score >= 60) return "from-[#D1A866]/50 to-[#D1A866]/70";
  if (score >= 40) return "from-[#D1A866]/25 to-[#D1A866]/45";
  return "from-[#D1A866]/10 to-[#D1A866]/30";
}

export default function ShieldPillarCards({
  pillarScores,
  weakestPillars,
}: ShieldPillarCardsProps) {
  const weakestSet = new Set(weakestPillars);

  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Pillar Diagnostic
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Seven-Pillar Preliminary Scores
        </h3>
      </div>

      <div className="grid gap-px bg-[#D1A866]/8 sm:grid-cols-2 xl:grid-cols-4">
        {PILLAR_ORDER.map((pillar) => {
          const score = pillarScores[pillar];
          const weight = SHIELD_PILLAR_WEIGHTS[pillar];
          const isWeak = weakestSet.has(pillar);

          return (
            <article
              key={pillar}
              className="flex flex-col bg-[#10283A]/80 p-5 sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-light text-[#F3F1EA]/85">
                    {PILLAR_LABELS[pillar]}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] tabular-nums text-[#F3F1EA]/30">
                    Weight {(weight * 100).toFixed(0)}%
                  </p>
                </div>
                {isWeak && (
                  <span className="shrink-0 rounded-sm border border-[#F3F1EA]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[#F3F1EA]/50">
                    Priority Gap
                  </span>
                )}
              </div>

              <p className="mb-3 font-mono text-3xl font-light tabular-nums text-[#D1A866]">
                {Math.round(score)}
              </p>

              <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-[#D1A866]/10">
                <div
                  className={`h-full bg-gradient-to-r transition-all duration-700 ${scoreTone(score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
