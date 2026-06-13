"use client";

import Link from "next/link";
import { useMemo } from "react";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import {
  PILLAR_DISPLAY_LABELS,
  PILLAR_EXPLANATIONS,
  PILLAR_MODULE_LINKS,
  pillarGapText,
  pillarRating,
  pillarStrengthText,
  pillarWeightPercent,
  recommendedPillarStep,
} from "@/lib/aegis/shieldPillarMetadata";
import {
  PROTECTION_BENCHMARK_DISCLAIMER,
  PROTECTION_BENCHMARK_LABEL,
} from "@/src/lib/scoring/protectionBenchmarks";
import type { ProtectionCoreMetricResult } from "@/src/lib/scoring/protectionCoreTypes";
import type { PillarScores, RoadmapItem, ShieldPillar } from "@/src/lib/scoring/types";

export type ShieldSelection =
  | { kind: "core"; metricId: ProtectionCoreMetricResult["id"] }
  | { kind: "pillar"; pillar: ShieldPillar };

interface ShieldArchitectureDetailPanelProps {
  selection: ShieldSelection | null;
  coreMetrics: ProtectionCoreMetricResult[];
  pillarScores: PillarScores;
  roadmap: RoadmapItem[];
  weakestPillar: ShieldPillar;
  strongestPillar: ShieldPillar;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(value);
}

function CoreMetricDetail({ metric }: { metric: ProtectionCoreMetricResult }) {
  const missing = metric.status === "data_missing";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Financial Core
        </p>
        <h3 className="mt-1 text-lg font-light text-[#F3F1EA]">{metric.label}</h3>
        <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          {metric.explanation}
        </p>
      </div>

      {missing ? (
        <div className="rounded-sm border border-[#F3F1EA]/10 bg-[#071B2A]/50 px-4 py-5">
          <p className="text-sm font-light text-[#F3F1EA]/60">
            {metric.actual === null && metric.target !== null
              ? "Data required"
              : "Complete your profile to calculate"}
          </p>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/35">
            Source: {metric.dataSource}
          </p>
        </div>
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
              Current amount
            </dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-[#F3F1EA]">
              {formatCurrency(metric.actual ?? 0)}
            </dd>
          </div>
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
              Target amount
            </dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-[#F3F1EA]">
              {formatCurrency(metric.target ?? 0)}
            </dd>
          </div>
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
              Completion
            </dt>
            <dd className="mt-1 font-mono text-sm tabular-nums text-[#D1A866]">
              {Math.round((metric.completionRatio ?? 0) * 100)}%
            </dd>
          </div>
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
            <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
              Gap / surplus
            </dt>
            <dd
              className={`mt-1 font-mono text-sm tabular-nums ${
                (metric.gap ?? 0) >= 0 ? "text-emerald-300/90" : "text-[#F3F1EA]/70"
              }`}
            >
              {(metric.gap ?? 0) >= 0 ? "+" : ""}
              {formatCurrency(metric.gap ?? 0)}
            </dd>
          </div>
        </dl>
      )}

      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 px-4 py-3 text-xs font-light leading-relaxed text-[#F3F1EA]/40">
        <p>
          <span className="text-[#D1A866]/80">{PROTECTION_BENCHMARK_LABEL}:</span>{" "}
          {metric.benchmarkFormula}
        </p>
        <p className="mt-2">Source: {metric.dataSource}</p>
        <p className="mt-2">{PROTECTION_BENCHMARK_DISCLAIMER}</p>
      </div>
    </div>
  );
}

function PillarDetail({
  pillar,
  score,
  roadmap,
  isWeakest,
  isStrongest,
}: {
  pillar: ShieldPillar;
  score: number;
  roadmap: RoadmapItem[];
  isWeakest: boolean;
  isStrongest: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Shield Pillar
        </p>
        <h3 className="mt-1 text-lg font-light text-[#F3F1EA]">
          {PILLAR_DISPLAY_LABELS[pillar]}
        </h3>
        <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          {PILLAR_EXPLANATIONS[pillar]}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Score
          </dt>
          <dd className="mt-1 font-mono text-2xl tabular-nums text-[#D1A866]">
            {formatScore(score)}
          </dd>
        </div>
        <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Rating
          </dt>
          <dd className="mt-1 font-mono text-lg tabular-nums text-[#F3F1EA]">
            {pillarRating(score)}
          </dd>
        </div>
        <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Shield weight
          </dt>
          <dd className="mt-1 font-mono text-sm tabular-nums text-[#F3F1EA]/80">
            {pillarWeightPercent(pillar)}%
          </dd>
        </div>
        <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Signal
          </dt>
          <dd className="mt-1 text-sm font-light text-[#F3F1EA]/70">
            {isWeakest ? "Priority gap" : isStrongest ? "Core strength" : "Balanced"}
          </dd>
        </div>
      </dl>

      <div className="space-y-2 text-sm font-light leading-relaxed text-[#F3F1EA]/50">
        <p>
          <span className="text-[#D1A866]/80">Strength:</span>{" "}
          {pillarStrengthText(score)}
        </p>
        <p>
          <span className="text-[#F3F1EA]/70">Gap:</span> {pillarGapText(score)}
        </p>
        <p>
          <span className="text-[#F3F1EA]/70">Next step:</span>{" "}
          {recommendedPillarStep(pillar, roadmap)}
        </p>
      </div>

      <Link
        href={PILLAR_MODULE_LINKS[pillar]}
        className="inline-flex rounded-sm border border-[#D1A866]/30 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/10"
      >
        Open {PILLAR_DISPLAY_LABELS[pillar]} module →
      </Link>
    </div>
  );
}

export default function ShieldArchitectureDetailPanel({
  selection,
  coreMetrics,
  pillarScores,
  roadmap,
  weakestPillar,
  strongestPillar,
}: ShieldArchitectureDetailPanelProps) {
  const content = useMemo(() => {
    if (!selection) {
      return (
        <p className="text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          Select a core protection metric or outer pillar segment to inspect
          scores, benchmarks, and recommended next steps.
        </p>
      );
    }

    if (selection.kind === "core") {
      const metric = coreMetrics.find((item) => item.id === selection.metricId);
      if (!metric) return null;
      return <CoreMetricDetail metric={metric} />;
    }

    return (
      <PillarDetail
        pillar={selection.pillar}
        score={pillarScores[selection.pillar]}
        roadmap={roadmap}
        isWeakest={selection.pillar === weakestPillar}
        isStrongest={selection.pillar === strongestPillar}
      />
    );
  }, [
    selection,
    coreMetrics,
    pillarScores,
    roadmap,
    weakestPillar,
    strongestPillar,
  ]);

  return (
    <div
      className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-5 sm:p-6"
      aria-live="polite"
    >
      <div
        key={
          selection
            ? selection.kind === "core"
              ? selection.metricId
              : selection.pillar
            : "empty"
        }
        className="animate-[shieldDetailIn_0.55s_ease-out]"
      >
        {content}
      </div>
    </div>
  );
}
