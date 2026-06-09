"use client";

import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import { formatScore } from "@/components/aegis/ShieldScoreCard";
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

interface StressPillarImpactProps {
  affectedPillars: Partial<PillarScores>;
}

export default function StressPillarImpact({
  affectedPillars,
}: StressPillarImpactProps) {
  const entries = PILLAR_ORDER.map((pillar) => ({
    pillar,
    label: PILLAR_LABELS[pillar],
    impact: affectedPillars[pillar] ?? 0,
  })).filter((entry) => entry.impact > 0);

  const maxImpact = Math.max(...entries.map((entry) => entry.impact), 1);

  if (entries.length === 0) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/20 px-4 py-6 text-center">
        <p className="text-xs text-[#F3F1EA]/40">
          No material pillar exposure identified for this scenario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries
        .sort((a, b) => b.impact - a.impact)
        .map((entry) => {
          const width = Math.max(8, (entry.impact / maxImpact) * 100);

          return (
            <div key={entry.pillar} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#F3F1EA]/80">{entry.label}</span>
                <span className="font-mono text-[10px] tabular-nums text-[#D1A866]/80">
                  −{formatScore(entry.impact)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#071B2A]/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D1A866]/40 to-[#D1A866]/80 transition-all duration-500"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
