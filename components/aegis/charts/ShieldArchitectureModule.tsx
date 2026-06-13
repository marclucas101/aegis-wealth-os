"use client";

import { useState } from "react";

import CircularShieldArchitecture from "@/components/aegis/charts/CircularShieldArchitecture";
import ShieldArchitectureDetailPanel, {
  type ShieldSelection,
} from "@/components/aegis/charts/ShieldArchitectureDetailPanel";
import {
  PROTECTION_BENCHMARK_DISCLAIMER,
  PROTECTION_BENCHMARK_LABEL,
} from "@/src/lib/scoring/protectionBenchmarks";
import type { ProtectionCoreResult } from "@/src/lib/scoring/protectionCoreTypes";
import type { PillarScores, RoadmapItem, ShieldPillar } from "@/src/lib/scoring/types";

interface ShieldArchitectureModuleProps {
  pillarScores: PillarScores;
  protectionCore: ProtectionCoreResult;
  roadmap: RoadmapItem[];
  weakestPillar: ShieldPillar;
  strongestPillar: ShieldPillar;
}

export default function ShieldArchitectureModule({
  pillarScores,
  protectionCore,
  roadmap,
  weakestPillar,
  strongestPillar,
}: ShieldArchitectureModuleProps) {
  const [selection, setSelection] = useState<ShieldSelection | null>(null);

  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Shield Architecture
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA] sm:text-base">
          Circular AEGIS Protection Shield
        </h3>
        <p className="mt-2 max-w-2xl text-xs font-light leading-relaxed text-[#F3F1EA]/40">
          Core protection benchmarks sit at the centre; seven diagnostic pillars
          form the outer institutional ring. {PROTECTION_BENCHMARK_LABEL} —{" "}
          {PROTECTION_BENCHMARK_DISCLAIMER}
        </p>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <div className="flex min-h-[min(100vw,28rem)] items-center justify-center lg:min-h-[26rem]">
          <CircularShieldArchitecture
            pillarScores={pillarScores}
            coreMetrics={protectionCore.metrics}
            aggregateCoreScore={protectionCore.aggregateScore}
            selection={selection}
            onSelect={setSelection}
          />
        </div>

        <ShieldArchitectureDetailPanel
          selection={selection}
          coreMetrics={protectionCore.metrics}
          pillarScores={pillarScores}
          roadmap={roadmap}
          weakestPillar={weakestPillar}
          strongestPillar={strongestPillar}
        />
      </div>
    </section>
  );
}
