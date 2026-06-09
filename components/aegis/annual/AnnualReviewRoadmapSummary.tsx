"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import type { RoadmapItem } from "@/src/lib/scoring/types";

const STATUS_LABELS: Record<RoadmapItem["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

interface AnnualReviewRoadmapSummaryProps {
  roadmap: RoadmapItem[];
}

export default function AnnualReviewRoadmapSummary({
  roadmap,
}: AnnualReviewRoadmapSummaryProps) {
  const totalImpact = roadmap.reduce(
    (sum, item) => sum + item.estimatedImpact,
    0
  );
  const avgTimeline =
    roadmap.length > 0
      ? Math.round(
          roadmap.reduce((sum, item) => sum + item.timelineMonths, 0) /
            roadmap.length
        )
      : 0;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#1A2A2B]/30">
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Roadmap Progress
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Priority action summary
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Architecture actions driving the four-year shield projection
        </p>
      </div>

      <div className="grid gap-px border-b border-[#D1A866]/8 bg-[#D1A866]/8 sm:grid-cols-3">
        <SummaryMetric label="Priority Actions" value={String(roadmap.length)} />
        <SummaryMetric
          label="Combined Impact"
          value={`+${formatScore(totalImpact)}`}
          highlight
        />
        <SummaryMetric
          label="Avg. Timeline"
          value={`${avgTimeline}mo`}
        />
      </div>

      <div className="space-y-3 px-6 py-6 sm:px-8">
        {roadmap.map((item, index) => (
          <div
            key={item.id}
            className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40 px-5 py-4"
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
                  {PILLAR_LABELS[item.pillar]} · {STATUS_LABELS[item.status]} ·{" "}
                  {item.priority} priority
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
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[#10283A]/90 px-5 py-5">
      <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-light tabular-nums ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ActionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs tabular-nums text-[#F3F1EA]/70">
        {value}
      </p>
    </div>
  );
}
