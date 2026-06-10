"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_LABELS, type RoadmapItemStatus } from "@/lib/aegis/localProfile";
import { ROADMAP_PRIORITY_LABELS, ROADMAP_STATUS_LABELS } from "@/lib/aegis/clientJourney";
import type { RoadmapItem } from "@/src/lib/scoring/types";

const PRIORITY_STYLES: Record<RoadmapItem["priority"], string> = {
  critical: "border-[#D1A866]/50 text-[#D1A866] bg-[#D1A866]/10",
  high: "border-[#D1A866]/35 text-[#D1A866]/90 bg-[#D1A866]/5",
  medium: "border-[#F3F1EA]/20 text-[#F3F1EA]/70 bg-[#F3F1EA]/5",
  low: "border-[#F3F1EA]/15 text-[#F3F1EA]/50 bg-transparent",
};

const DIFFICULTY_STYLES: Record<RoadmapItem["difficulty"], string> = {
  low: "text-[#F3F1EA]/55",
  medium: "text-[#D1A866]/75",
  high: "text-[#D1A866]",
};

const STATUS_OPTIONS: { value: RoadmapItemStatus; label: string }[] = [
  { value: "not_started", label: ROADMAP_STATUS_LABELS.not_started },
  { value: "in_progress", label: ROADMAP_STATUS_LABELS.in_progress },
  { value: "completed", label: ROADMAP_STATUS_LABELS.completed },
];

interface RoadmapActionCardProps {
  item: RoadmapItem;
  index: number;
  onStatusChange: (
    id: string,
    status: RoadmapItemStatus,
    previousStatus: RoadmapItemStatus,
  ) => void;
}

export default function RoadmapActionCard({
  item,
  index,
  onStatusChange,
}: RoadmapActionCardProps) {
  const isCompleted = item.status === "completed";

  return (
    <article
      className={`rounded-sm border bg-[#10283A]/70 transition-colors ${
        isCompleted
          ? "border-[#D1A866]/25 bg-[#1A2A2B]/40"
          : "border-[#D1A866]/12"
      }`}
    >
      <div className="border-b border-[#D1A866]/8 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-[#D1A866]/50">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span
                className={`rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-wider ${PRIORITY_STYLES[item.priority]}`}
              >
                {ROADMAP_PRIORITY_LABELS[item.priority] ?? item.priority}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                {PILLAR_LABELS[item.pillar]}
              </span>
            </div>
            <h4
              className={`text-base font-light leading-snug ${
                isCompleted
                  ? "text-[#F3F1EA]/55 line-through decoration-[#D1A866]/30"
                  : "text-[#F3F1EA]"
              }`}
            >
              {item.title}
            </h4>
          </div>

          <label className="flex shrink-0 flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
              Status
            </span>
            <select
              value={item.status}
              onChange={(event) =>
                onStatusChange(
                  item.id,
                  event.target.value as RoadmapItemStatus,
                  item.status,
                )
              }
              className="rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/80 px-3 py-2 text-xs text-[#F3F1EA] outline-none transition-colors focus:border-[#D1A866]/40"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-px bg-[#D1A866]/6 sm:grid-cols-2 lg:grid-cols-4">
        <DetailCell label="Current Score" value={formatScore(item.currentScore)} />
        <DetailCell label="Target Score" value={formatScore(item.targetScore)} />
        <DetailCell
          label="Shield Improvement"
          value={`+${formatScore(item.estimatedImpact)}`}
          highlight
        />
        <DetailCell
          label="Difficulty"
          value={item.difficulty}
          className={DIFFICULTY_STYLES[item.difficulty]}
        />
        <DetailCell
          label="Timeline"
          value={`${item.timelineMonths} months`}
        />
        <DetailCell label="Gap Severity" value={String(item.gapSeverity ?? "—")} />
        <DetailCell
          label="Stress Exposure"
          value={String(item.stressExposure ?? "—")}
        />
        <DetailCell
          label="Impact Potential"
          value={String(item.impactPotential ?? item.estimatedImpact)}
        />
      </div>
    </article>
  );
}

function DetailCell({
  label,
  value,
  highlight = false,
  className = "",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className="bg-[#10283A]/80 px-4 py-3 sm:px-5">
      <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-sm capitalize tabular-nums ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]/80"
        } ${className}`}
      >
        {value}
      </p>
    </div>
  );
}
