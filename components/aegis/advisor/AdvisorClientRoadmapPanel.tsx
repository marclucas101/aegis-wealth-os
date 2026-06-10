"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { RoadmapItem } from "@/src/lib/scoring/types";

interface AdvisorClientRoadmapPanelProps {
  roadmap: RoadmapItem[];
  completionPercent: number;
}

function statusStyles(status: RoadmapItem["status"]): string {
  switch (status) {
    case "completed":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
    case "in_progress":
      return "border-[#D1A866]/30 bg-[#D1A866]/10 text-[#D1A866]";
    default:
      return "border-[#F3F1EA]/15 bg-[#071B2A]/40 text-[#F3F1EA]/50";
  }
}

function priorityStyles(priority: RoadmapItem["priority"]): string {
  switch (priority) {
    case "critical":
      return "border-red-400/30 text-red-300";
    case "high":
      return "border-amber-400/30 text-amber-200";
    default:
      return "border-[#F3F1EA]/15 text-[#F3F1EA]/45";
  }
}

export default function AdvisorClientRoadmapPanel({
  roadmap,
  completionPercent,
}: AdvisorClientRoadmapPanelProps) {
  const completed = roadmap.filter((item) => item.status === "completed").length;
  const inProgress = roadmap.filter(
    (item) => item.status === "in_progress",
  ).length;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Roadmap Progress
            </p>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
              Active wealth architecture actions
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl tabular-nums text-[#D1A866]">
              {completionPercent}%
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
              {completed}/{roadmap.length} complete
            </p>
          </div>
        </div>
      </div>

      {roadmap.length === 0 ? (
        <div className="relative px-5 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D1A866]/15 bg-[#071B2A]/50">
            <span className="text-lg text-[#D1A866]/40" aria-hidden>
              ◇
            </span>
          </div>
          <p className="text-sm font-light text-[#F3F1EA]/50">
            No active roadmap items for this client.
          </p>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
            Roadmap actions are generated from Discover and Shield diagnostics.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="border-b border-[#D1A866]/8 px-5 py-3">
            <div className="flex gap-4 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
              <span>{inProgress} in progress</span>
              <span>{roadmap.length - completed - inProgress} not started</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-[#071B2A]/60">
              <div
                className="h-full rounded-sm bg-[#D1A866]"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>

          <ul className="divide-y divide-[#D1A866]/8">
            {roadmap.slice(0, 8).map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-light text-[#F3F1EA]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                      {item.pillar} · {item.timelineMonths} months
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${statusStyles(item.status)}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`inline-flex rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${priorityStyles(item.priority)}`}
                    >
                      {item.priority}
                    </span>
                  </div>
                </div>
                <p className="mt-2 font-mono text-xs tabular-nums text-[#F3F1EA]/45">
                  {formatScore(item.currentScore)} → {formatScore(item.targetScore)}{" "}
                  · impact {formatScore(item.estimatedImpact)}
                </p>
              </li>
            ))}
          </ul>

          {roadmap.length > 8 && (
            <p className="border-t border-[#D1A866]/8 px-5 py-3 text-center text-xs text-[#F3F1EA]/35">
              +{roadmap.length - 8} more roadmap items
            </p>
          )}
        </div>
      )}
    </section>
  );
}
