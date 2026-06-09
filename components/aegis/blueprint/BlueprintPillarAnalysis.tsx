"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import type { PillarScores, ShieldPillar } from "@/src/lib/scoring/types";

const PILLAR_ORDER: ShieldPillar[] = [
  "foundation",
  "protect",
  "grow",
  "optimise",
  "transition",
  "preserve",
  "legacy",
];

interface WeakestPillar {
  pillar: ShieldPillar;
  label: string;
  score: number;
}

interface BlueprintPillarAnalysisProps {
  pillarScores: PillarScores;
  weakestPillars: WeakestPillar[];
}

function scoreTone(score: number): string {
  if (score >= 80) return "bg-[#D1A866]";
  if (score >= 60) return "bg-[#D1A866]/70";
  if (score >= 40) return "bg-[#D1A866]/40";
  return "bg-[#D1A866]/25";
}

export default function BlueprintPillarAnalysis({
  pillarScores,
  weakestPillars,
}: BlueprintPillarAnalysisProps) {
  const weakestSet = new Set(weakestPillars.map((p) => p.pillar));

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Section 04
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Pillar Analysis
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Seven-pillar diagnostic breakdown · Weighted architecture scores
        </p>
      </div>

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-3">
          {PILLAR_ORDER.map((pillar) => {
            const score = pillarScores[pillar];
            const weight = SHIELD_PILLAR_WEIGHTS[pillar];
            const isWeakest = weakestSet.has(pillar);

            return (
              <div key={pillar}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#F3F1EA]/85">
                      {PILLAR_LABELS[pillar]}
                    </span>
                    {isWeakest && (
                      <span className="rounded-sm border border-[#F3F1EA]/15 px-1.5 py-px text-[9px] uppercase tracking-wider text-[#F3F1EA]/50">
                        Priority
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
                    className={`h-full rounded-full ${scoreTone(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <aside className="rounded-sm border border-[#D1A866]/12 bg-[#1A2A2B]/40 p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Top 3 Weakest Pillars
          </p>
          <p className="mt-1 text-xs text-[#F3F1EA]/40">
            Primary architecture gaps
          </p>

          <ol className="mt-5 space-y-4">
            {weakestPillars.map((item, index) => (
              <li key={item.pillar} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-[#D1A866]/20 font-mono text-[10px] tabular-nums text-[#D1A866]/70">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-[#F3F1EA]">{item.label}</p>
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-[#F3F1EA]/45">
                    Score {formatScore(item.score)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}
