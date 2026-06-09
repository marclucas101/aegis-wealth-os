"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import type { ProjectedShieldResult, RoadmapItem, ShieldScoreResult } from "@/src/lib/scoring/types";

interface BlueprintRoadmapSummaryProps {
  shield: ShieldScoreResult;
  projected: ProjectedShieldResult;
  roadmap: RoadmapItem[];
}

const STATUS_LABELS: Record<RoadmapItem["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function BlueprintRoadmapSummary({
  shield,
  projected,
  roadmap,
}: BlueprintRoadmapSummaryProps) {
  const improvement =
    projected.projectedAdjustedShieldScore - shield.adjustedShieldScore;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Section 06
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Roadmap & Shield Progression
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Priority architecture actions · Current vs projected shield
        </p>
      </div>

      <div className="relative grid gap-px border-b border-[#D1A866]/8 bg-[#D1A866]/8 sm:grid-cols-2 lg:grid-cols-4">
        <ProgressMetric
          label="Current Shield"
          value={formatScore(shield.adjustedShieldScore)}
          sublabel={`${shield.rating} · Raw ${formatScore(shield.rawShieldScore)}`}
        />
        <ProgressMetric
          label="Projected Shield"
          value={formatScore(projected.projectedAdjustedShieldScore)}
          highlight
          sublabel={`${projected.projectedRating} · Raw ${formatScore(projected.projectedRawShieldScore)}`}
        />
        <ProgressMetric
          label="Estimated Improvement"
          value={`+${formatScore(Math.max(0, improvement))}`}
          highlight={improvement > 0}
          sublabel="On roadmap completion"
        />
        <ProgressMetric
          label="Priority Actions"
          value={String(roadmap.length)}
          sublabel="Weakest pillar remediation"
        />
      </div>

      <div className="relative px-6 py-6 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Priority Actions
        </p>

        <div className="mt-4 space-y-3">
          {roadmap.map((item, index) => (
            <div
              key={item.id}
              className="rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/30 px-5 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tabular-nums text-[#D1A866]/60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p className="text-sm text-[#F3F1EA]">{item.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-[#F3F1EA]/40">
                    {PILLAR_LABELS[item.pillar]} pillar ·{" "}
                    {STATUS_LABELS[item.status]}
                  </p>
                </div>

                <div className="flex shrink-0 gap-6">
                  <ActionStat
                    label="Impact"
                    value={`+${formatScore(item.estimatedImpact)}`}
                  />
                  <ActionStat
                    label="Timeline"
                    value={`${item.timelineMonths}mo`}
                  />
                  <ActionStat
                    label="Difficulty"
                    value={item.difficulty}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgressMetric({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[#10283A]/90 px-5 py-5 sm:px-6">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-light tabular-nums tracking-tight ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-1 text-xs text-[#F3F1EA]/35">{sublabel}</p>
      )}
    </div>
  );
}

function ActionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs tabular-nums capitalize text-[#F3F1EA]/70">
        {value}
      </p>
    </div>
  );
}
